from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import pymysql
import os
from datetime import datetime
import threading
# from database_update import fetch_and_update_stock_prices
import time
import yfinance as yf

app = Flask(__name__)
CORS(app, origins="*")  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# MySQL connection configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'portfolio_manager'),
    'port': int(os.getenv('MYSQL_PORT', 3306))
}


def get_db_connection():
    """Get database connection"""
    conn = pymysql.connect(**DB_CONFIG)
    return conn


def get_account_balance():
    """Get current account balance"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT balance FROM account_balance WHERE user_id = 1')
    result = cursor.fetchone()
    conn.close()
    return float(result[0]) if result else 0.0


def update_account_balance(amount):
    """Update account balance by adding/subtracting amount"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE account_balance 
        SET balance = balance + %s, last_updated = %s
        WHERE user_id = 1
    ''', (amount, datetime.now()))
    conn.commit()
    conn.close()


def record_net_worth_snapshot():
    """Record current net worth for historical tracking after each transaction"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get current account balance
    cursor.execute('SELECT balance FROM account_balance WHERE user_id = 1')
    balance_result = cursor.fetchone()
    account_balance = float(balance_result[0]) if balance_result else 0.0

    # Get current portfolio value
    cursor.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''')
    portfolio_result = cursor.fetchone()
    portfolio_value = float(portfolio_result[0]) if portfolio_result else 0.0

    total_net_worth = account_balance + portfolio_value
    current_time = datetime.now()
    today = current_time.strftime('%Y-%m-%d')

    # Always insert new entry for each transaction
    cursor.execute('''
        INSERT INTO net_worth_history (user_id, date, account_balance, portfolio_value, total_net_worth, timestamp)
        VALUES (1, %s, %s, %s, %s, %s)
    ''', (today, account_balance, portfolio_value, total_net_worth, current_time))

    conn.commit()
    conn.close()


def calculate_realized_pl():
    """Calculate realized profit/loss using FIFO method"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get all transactions sorted by timestamp
    cursor.execute('''
        SELECT t.type, s.symbol, t.quantity, t.price, t.timestamp
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        ORDER BY s.symbol, t.timestamp ASC
    ''')
    transactions = cursor.fetchall()
    conn.close()
    
    # Group transactions by symbol
    transactions_by_symbol = {}
    for transaction in transactions:
        symbol = transaction[1]
        if symbol not in transactions_by_symbol:
            transactions_by_symbol[symbol] = []
        transactions_by_symbol[symbol].append({
            'type': transaction[0],
            'quantity': transaction[2],
            'price': float(transaction[3]),
            'timestamp': transaction[4]
        })
    
    total_realized_pl = 0.0
    total_sold_value = 0.0
    total_sold_cost_basis = 0.0
    
    # Calculate realized P&L using FIFO method for each symbol
    for symbol, symbol_transactions in transactions_by_symbol.items():
        remaining_shares = []  # Queue of shares with their buy prices
        
        for transaction in symbol_transactions:
            if transaction['type'] == 'BUY':
                remaining_shares.append({
                    'quantity': transaction['quantity'],
                    'price': transaction['price']
                })
            elif transaction['type'] == 'SELL':
                sell_quantity = transaction['quantity']
                sell_value = sell_quantity * transaction['price']
                cost_basis = 0.0
                
                # Calculate cost basis using FIFO
                while sell_quantity > 0 and remaining_shares:
                    oldest_share = remaining_shares[0]
                    quantity_to_sell = min(sell_quantity, oldest_share['quantity'])
                    
                    cost_basis += quantity_to_sell * oldest_share['price']
                    sell_quantity -= quantity_to_sell
                    oldest_share['quantity'] -= quantity_to_sell
                    
                    if oldest_share['quantity'] == 0:
                        remaining_shares.pop(0)
                
                realized_pl = sell_value - cost_basis
                total_realized_pl += realized_pl
                total_sold_value += sell_value
                total_sold_cost_basis += cost_basis
    
    # Calculate realized P&L percentage
    realized_pl_percentage = 0.0
    if total_sold_cost_basis > 0:
        realized_pl_percentage = (total_realized_pl / total_sold_cost_basis) * 100
    
    return {
        'amount': total_realized_pl,
        'percentage': realized_pl_percentage,
        'total_sold_value': total_sold_value,
        'total_sold_cost_basis': total_sold_cost_basis
    }


def calculate_total_invested():
    """Calculate total amount invested (current cost basis + sold cost basis)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Get current cost basis
    cursor.execute('''
        SELECT COALESCE(SUM(h.quantity * h.avg_buy_price), 0) as current_cost_basis
        FROM holdings h
    ''')
    current_cost_basis = float(cursor.fetchone()[0])
    conn.close()
    
    # Get realized P&L data which includes sold cost basis
    realized_data = calculate_realized_pl()
    total_invested = current_cost_basis + realized_data['total_sold_cost_basis']
    
    return total_invested


def get_total_holdings_count():
    """Get total number of holdings across all portfolios"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM holdings')
    total_holdings = cursor.fetchone()[0]
    conn.close()
    
    return total_holdings


def init_db():
    """Initialize database if it doesn't exist"""
    try:
        conn = get_db_connection()
        conn.close()
        print("Database connection successful!")
    except pymysql.Error as err:
        print(f"Database connection failed: {err}")
        print("Please make sure MySQL is running and the database exists")

# API Routes


@app.route('/api/portfolios', methods=['GET'])
def get_portfolios():
    """Get all portfolios with summary"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT p.id, p.name, p.description, 
               COUNT(h.id) as holdings_count,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value
        FROM portfolios p
        LEFT JOIN holdings h ON p.id = h.portfolio_id
        LEFT JOIN stocks s ON h.stock_id = s.id
        GROUP BY p.id, p.name, p.description
        ORDER BY p.name
    ''')
    portfolios = cursor.fetchall()
    conn.close()

    return jsonify([{
        'id': row[0],
        'name': row[1],
        'description': row[2],
        'holdings_count': row[3],
        'total_value': float(row[4])
    } for row in portfolios])


@app.route('/api/portfolios/<int:portfolio_id>', methods=['GET'])
def get_portfolio_detail(portfolio_id):
    """Get detailed portfolio information"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get portfolio info
    cursor.execute('SELECT * FROM portfolios WHERE id = %s', (portfolio_id,))
    portfolio = cursor.fetchone()

    if not portfolio:
        return jsonify({'error': 'Portfolio not found'}), 404

    # Get holdings with current values
    cursor.execute('''
        SELECT h.id, s.symbol, s.name, h.quantity, h.avg_buy_price, s.current_price,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * (s.current_price - h.avg_buy_price)) as profit_loss
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
        WHERE h.portfolio_id = %s
        ORDER BY current_value DESC
    ''', (portfolio_id,))
    holdings = cursor.fetchall()

    # Get transactions for this portfolio
    cursor.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        WHERE t.portfolio_id = %s
        ORDER BY t.timestamp DESC
        LIMIT 20
    ''', (portfolio_id,))
    transactions = cursor.fetchall()

    conn.close()

    return jsonify({
        'portfolio': {
            'id': portfolio[0],
            'name': portfolio[1],
            'description': portfolio[2]
        },
        'holdings': [{
            'id': row[0],
            'symbol': row[1],
            'name': row[2],
            'quantity': row[3],
            'avg_buy_price': float(row[4]),
            'current_price': float(row[5]),
            'current_value': float(row[6]),
            'profit_loss': float(row[7])
        } for row in holdings],
        'transactions': [{
            'type': row[0],
            'symbol': row[1],
            'name': row[2],
            'quantity': row[3],
            'price': float(row[4]),
            'timestamp': row[5]
        } for row in transactions]
    })


@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    """Get all stocks"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, 
               COALESCE(SUM(h.quantity), 0) as total_shares_held,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value_held
        FROM stocks s
        LEFT JOIN holdings h ON s.id = h.stock_id
        GROUP BY s.id, s.symbol, s.name, s.current_price, s.watchlist
        ORDER BY s.symbol
    ''')
    stocks = cursor.fetchall()
    conn.close()

    return jsonify([{
        'id': row[0],
        'symbol': row[1],
        'name': row[2],
        'current_price': float(row[3]),
        'watchlist': bool(row[4]),
        'total_shares_held': row[5],
        'total_value_held': float(row[6])
    } for row in stocks])


@app.route('/api/stocks/<string:symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """Get detailed stock information"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get stock info
    cursor.execute(
        'SELECT id, symbol, name, current_price, watchlist FROM stocks WHERE symbol = %s', (symbol.upper(),))
    stock = cursor.fetchone()

    if not stock:
        return jsonify({'error': 'Stock not found'}), 404

    # Get holdings for this stock across all portfolios
    cursor.execute('''
        SELECT h.id, h.portfolio_id, h.stock_id, h.quantity, h.avg_buy_price,
               p.name as portfolio_name,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * (s.current_price - h.avg_buy_price)) as profit_loss
        FROM holdings h
        JOIN portfolios p ON h.portfolio_id = p.id
        JOIN stocks s ON h.stock_id = s.id
        WHERE s.symbol = %s
        ORDER BY p.name
    ''', (symbol.upper(),))
    holdings = cursor.fetchall()

    # Get recent transactions for this stock
    cursor.execute('''
        SELECT t.id, t.stock_id, t.portfolio_id, t.type, t.quantity, t.price, t.timestamp,
               p.name as portfolio_name
        FROM transactions t
        JOIN portfolios p ON t.portfolio_id = p.id
        JOIN stocks s ON t.stock_id = s.id
        WHERE s.symbol = %s
        ORDER BY t.timestamp DESC
        LIMIT 20
    ''', (symbol.upper(),))
    transactions = cursor.fetchall()

    conn.close()

    return jsonify({
        'stock': {
            'id': stock[0],
            'symbol': stock[1],
            'name': stock[2],
            'current_price': float(stock[3]),
            'watchlist': bool(stock[4])
        },
        'holdings': [{
            'id': row[0],
            'portfolio_id': row[1],
            'portfolio_name': row[5],
            'quantity': row[3],
            'avg_buy_price': float(row[4]),
            'current_value': float(row[6]),
            'profit_loss': float(row[7])
        } for row in holdings],
        'transactions': [{
            'id': row[0],
            'type': row[3],
            'quantity': row[4],
            'price': float(row[5]),
            'timestamp': row[6],
            'portfolio_name': row[7]
        } for row in transactions]
    })


@app.route('/api/stocks/<string:symbol>/market-data', methods=['GET'])
def get_stock_market_data(symbol):
    """Get market data for a stock including daily change percentage"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Get current price from database
        cursor.execute(
            'SELECT current_price FROM stocks WHERE symbol = %s', (symbol.upper(),))
        result = cursor.fetchone()

        if not result:
            conn.close()
            return jsonify({'error': 'Stock not found'}), 404

        current_price = float(result[0])

        # Use yfinance to get the previous close to calculate daily change
        try:
            stock_info = yf.Ticker(symbol.upper())
            hist = stock_info.history(period="2d")

            if len(hist) >= 1:
                previous_close = float(
                    hist['Close'].iloc[-2]) if len(hist) >= 2 else float(hist['Close'].iloc[-1])
                daily_change = current_price - previous_close
                daily_change_percentage = (
                    daily_change / previous_close) * 100 if previous_close > 0 else 0
            else:
                # Fallback if yfinance fails
                previous_close = current_price
                daily_change = 0
                daily_change_percentage = 0

        except Exception as e:
            print(f"Error fetching historical data for {symbol}: {e}")
            # Fallback values
            previous_close = current_price
            daily_change = 0
            daily_change_percentage = 0

        conn.close()

        return jsonify({
            'symbol': symbol.upper(),
            'current_price': current_price,
            'previous_close_price': previous_close,
            'daily_change': daily_change,
            'daily_change_percentage': daily_change_percentage
        })

    except Exception as e:
        return jsonify({'error': f'Failed to fetch market data: {str(e)}'}), 500


@app.route('/api/stocks/<string:symbol>/buy', methods=['POST'])
def buy_stock(symbol):
    """Handle stock purchase"""
    try:
        data = request.get_json()
        portfolio_id = data.get('portfolio_id')
        quantity = int(data.get('quantity'))
        price = float(data.get('price'))

        if not all([portfolio_id, quantity, price]) or quantity <= 0 or price <= 0:
            return jsonify({'error': 'Please provide valid portfolio, quantity, and price'}), 400

        # Check if user has sufficient balance
        total_cost = quantity * price
        current_balance = get_account_balance()

        if current_balance < total_cost:
            return jsonify({
                'error': f'Insufficient balance. You need ${total_cost:.2f} but only have ${current_balance:.2f}'
            }), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get stock ID
        cursor.execute('SELECT id FROM stocks WHERE symbol = %s',
                       (symbol.upper(),))
        stock = cursor.fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        stock_id = stock[0]

        # Insert transaction
        cursor.execute('''
            INSERT INTO transactions (stock_id, portfolio_id, type, quantity, price, timestamp)
            VALUES (%s, %s, 'BUY', %s, %s, %s)
        ''', (stock_id, portfolio_id, quantity, price, datetime.now()))

        # Check if holding already exists for this portfolio and stock
        cursor.execute('''
            SELECT id, quantity, avg_buy_price FROM holdings 
            WHERE portfolio_id = %s AND stock_id = %s
        ''', (portfolio_id, stock_id))
        existing_holding = cursor.fetchone()

        if existing_holding:
            # Update existing holding - calculate new average price
            old_quantity = existing_holding[1]
            old_avg_price = existing_holding[2]
            new_quantity = old_quantity + quantity
            new_avg_price = ((old_quantity * old_avg_price) +
                             (quantity * price)) / new_quantity

            cursor.execute('''
                UPDATE holdings 
                SET quantity = %s, avg_buy_price = %s
                WHERE id = %s
            ''', (new_quantity, new_avg_price, existing_holding[0]))
        else:
            # Create new holding
            cursor.execute('''
                INSERT INTO holdings (portfolio_id, stock_id, quantity, avg_buy_price)
                VALUES (%s, %s, %s, %s)
            ''', (portfolio_id, stock_id, quantity, price))

        conn.commit()
        conn.close()

        # Deduct amount from account balance
        update_account_balance(-total_cost)

        # Record net worth snapshot
        record_net_worth_snapshot()

        return jsonify({
            'message': f'Successfully bought {quantity} shares of {symbol.upper()} at ${price:.2f} for ${total_cost:.2f}',
            'transaction': {
                'symbol': symbol.upper(),
                'quantity': quantity,
                'price': price,
                'total_cost': total_cost
            }
        })

    except ValueError:
        return jsonify({'error': 'Invalid quantity or price format'}), 400
    except Exception as e:
        return jsonify({'error': f'Error processing purchase: {str(e)}'}), 500


@app.route('/api/stocks/<string:symbol>/sell', methods=['POST'])
def sell_stock(symbol):
    """Handle stock sale"""
    try:
        data = request.get_json()
        portfolio_id = data.get('portfolio_id')
        quantity = int(data.get('quantity'))
        price = float(data.get('price'))

        if not all([portfolio_id, quantity, price]) or quantity <= 0 or price <= 0:
            return jsonify({'error': 'Please provide valid portfolio, quantity, and price'}), 400

        conn = get_db_connection()
        cursor = conn.cursor()

        # Get stock ID
        cursor.execute('SELECT id FROM stocks WHERE symbol = %s',
                       (symbol.upper(),))
        stock = cursor.fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        stock_id = stock[0]

        # Check if user has enough shares to sell
        cursor.execute('''
            SELECT id, quantity, avg_buy_price FROM holdings 
            WHERE portfolio_id = %s AND stock_id = %s
        ''', (portfolio_id, stock_id))
        holding = cursor.fetchone()

        if not holding or holding[1] < quantity:
            available = holding[1] if holding else 0
            return jsonify({
                'error': f'Insufficient shares. You have {available} shares but trying to sell {quantity}'
            }), 400

        # Insert transaction
        cursor.execute('''
            INSERT INTO transactions (stock_id, portfolio_id, type, quantity, price, timestamp)
            VALUES (%s, %s, 'SELL', %s, %s, %s)
        ''', (stock_id, portfolio_id, quantity, price, datetime.now()))

        # Update holding
        new_quantity = holding[1] - quantity

        if new_quantity == 0:
            # Remove holding if no shares left
            cursor.execute('DELETE FROM holdings WHERE id = %s', (holding[0],))
        else:
            # Update quantity
            cursor.execute('''
                UPDATE holdings 
                SET quantity = %s
                WHERE id = %s
            ''', (new_quantity, holding[0]))

        conn.commit()
        conn.close()

        # Add amount to account balance
        total_proceeds = quantity * price
        update_account_balance(total_proceeds)

        # Record net worth snapshot
        record_net_worth_snapshot()

        return jsonify({
            'message': f'Successfully sold {quantity} shares of {symbol.upper()} at ${price:.2f} for ${total_proceeds:.2f}',
            'transaction': {
                'symbol': symbol.upper(),
                'quantity': quantity,
                'price': price,
                'total_proceeds': total_proceeds
            }
        })

    except ValueError:
        return jsonify({'error': 'Invalid quantity or price format'}), 400
    except Exception as e:
        return jsonify({'error': f'Error processing sale: {str(e)}'}), 500


@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    """Get all transactions"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp, p.name as portfolio_name
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        JOIN portfolios p ON t.portfolio_id = p.id
        ORDER BY t.timestamp DESC
        LIMIT 50
    ''')
    transactions = cursor.fetchall()
    conn.close()

    return jsonify([{
        'type': row[0],
        'symbol': row[1],
        'name': row[2],
        'quantity': row[3],
        'price': float(row[4]),
        'timestamp': row[5],
        'portfolio_name': row[6]
    } for row in transactions])


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard data with calculated P&L metrics"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get portfolio summary
    cursor.execute('''
        SELECT p.id, p.name, p.description, 
               COUNT(h.id) as holdings_count,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value
        FROM portfolios p
        LEFT JOIN holdings h ON p.id = h.portfolio_id
        LEFT JOIN stocks s ON h.stock_id = s.id
        GROUP BY p.id, p.name, p.description
        ORDER BY total_value DESC
    ''')
    portfolios = cursor.fetchall()

    # Get total portfolio value
    cursor.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''')
    total_value = cursor.fetchone()[0]

    # Get unrealized profit/loss data
    cursor.execute('''
        SELECT 
            COALESCE(SUM(h.quantity * h.avg_buy_price), 0) as total_cost_basis,
            COALESCE(SUM(h.quantity * s.current_price), 0) as total_current_value,
            COALESCE(SUM(h.quantity * (s.current_price - h.avg_buy_price)), 0) as total_profit_loss
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''')
    profit_loss_data = cursor.fetchone()

    total_cost_basis = float(profit_loss_data[0])
    total_current_value = float(profit_loss_data[1])
    unrealized_profit_loss = float(profit_loss_data[2])

    # Calculate unrealized profit/loss percentage
    unrealized_pl_percentage = 0.0
    if total_cost_basis > 0:
        unrealized_pl_percentage = (unrealized_profit_loss / total_cost_basis) * 100

    # Calculate realized P&L using FIFO method
    realized_pl_data = calculate_realized_pl()
    
    # Calculate total invested amount
    total_invested = calculate_total_invested()
    
    # Get total holdings count
    total_holdings = get_total_holdings_count()
    
    # Calculate total P&L and percentage
    total_pl_amount = unrealized_profit_loss + realized_pl_data['amount']
    total_pl_percentage = 0.0
    if total_invested > 0:
        total_pl_percentage = (total_pl_amount / total_invested) * 100

    # Get recent transactions
    cursor.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp, p.name as portfolio_name
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        JOIN portfolios p ON t.portfolio_id = p.id
        ORDER BY t.timestamp DESC
        LIMIT 10
    ''')
    recent_transactions = cursor.fetchall()

    conn.close()

    return jsonify({
        'portfolios': [{
            'id': row[0],
            'name': row[1],
            'description': row[2],
            'holdings_count': row[3],
            'total_value': float(row[4])
        } for row in portfolios],
        'total_value': float(total_value),
        # Unrealized P&L
        'total_profit_loss': unrealized_profit_loss,
        'profit_loss_percentage': unrealized_pl_percentage,
        'total_cost_basis': total_cost_basis,
        # Realized P&L
        'realized_profit_loss': realized_pl_data['amount'],
        'realized_pl_percentage': realized_pl_data['percentage'],
        # Total P&L
        'total_pl_amount': total_pl_amount,
        'total_pl_percentage': total_pl_percentage,
        # Account and investment metrics
        'account_balance': get_account_balance(),
        'total_invested': total_invested,
        'total_holdings': total_holdings,
        'recent_transactions': [{
            'type': row[0],
            'symbol': row[1],
            'name': row[2],
            'quantity': row[3],
            'price': float(row[4]),
            'timestamp': row[5],
            'portfolio_name': row[6]
        } for row in recent_transactions]
    })


@app.route('/api/portfolio/<int:portfolio_id>/value')
def api_portfolio_value(portfolio_id):
    """API endpoint to get portfolio value"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as value
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
        WHERE h.portfolio_id = %s
    ''', (portfolio_id,))
    result = cursor.fetchone()
    conn.close()

    return jsonify({'value': float(result[0])})


@app.route('/api/stocks/prices')
def api_stock_prices():
    """API endpoint to get all stock prices"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT symbol, current_price FROM stocks ORDER BY symbol')
    stocks = cursor.fetchall()
    conn.close()

    return jsonify({stock[0]: float(stock[1]) for stock in stocks})


@app.route('/api/account/balance')
def api_account_balance():
    """API endpoint to get current account balance"""
    return jsonify({'balance': get_account_balance()})


@app.route('/api/net-worth/history')
def api_net_worth_history():
    """API endpoint to get net worth history for chart"""
    limit = request.args.get('limit', 50, type=int)

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT date, account_balance, portfolio_value, total_net_worth, timestamp
        FROM net_worth_history 
        WHERE user_id = 1 
        ORDER BY timestamp DESC 
        LIMIT %s
    ''', (limit,))
    history = cursor.fetchall()
    conn.close()

    # Reverse to get chronological order
    history = list(reversed(history))

    return jsonify([{
        'date': row[0],
        'timestamp': row[4],
        'account_balance': float(row[1]),
        'portfolio_value': float(row[2]),
        'total_net_worth': float(row[3])
    } for row in history])


@app.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    """Get all stocks in watchlist"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT s.*, 
               COALESCE(SUM(h.quantity), 0) as total_shares_held,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value_held,
               COALESCE(SUM(h.quantity * h.avg_buy_price), 0) as total_cost_basis # Total cost basis for P&L calculation
        FROM stocks s
        LEFT JOIN holdings h ON s.id = h.stock_id
        WHERE s.watchlist = TRUE
        GROUP BY s.id, s.symbol, s.name, s.current_price, s.watchlist
        ORDER BY s.symbol
    ''')
    stocks = cursor.fetchall()
    conn.close()

    return jsonify([{
        'id': row[0],
        'symbol': row[1],
        'name': row[2],
        'current_price': float(row[3]),
        'watchlist': bool(row[4]),
        'total_shares_held': row[5],
        'total_value_held': float(row[6]),
        'total_cost_basis': float(row[7])
    } for row in stocks])


@app.route('/api/stocks/<string:symbol>/watchlist', methods=['POST'])
def add_to_watchlist(symbol):
    """Add stock to watchlist"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if stock exists
        cursor.execute('SELECT id FROM stocks WHERE symbol = %s',
                       (symbol.upper(),))
        stock = cursor.fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        # Add to watchlist
        cursor.execute('''
            UPDATE stocks 
            SET watchlist = TRUE 
            WHERE symbol = %s
        ''', (symbol.upper(),))

        conn.commit()
        conn.close()

        return jsonify({'message': f'{symbol.upper()} added to watchlist successfully'})

    except Exception as e:
        return jsonify({'error': f'Error adding to watchlist: {str(e)}'}), 500


@app.route('/api/stocks/<string:symbol>/watchlist', methods=['DELETE'])
def remove_from_watchlist(symbol):
    """Remove stock from watchlist"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if stock exists
        cursor.execute('SELECT id FROM stocks WHERE symbol = %s',
                       (symbol.upper(),))
        stock = cursor.fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        # Remove from watchlist
        cursor.execute('''
            UPDATE stocks 
            SET watchlist = FALSE 
            WHERE symbol = %s
        ''', (symbol.upper(),))

        conn.commit()
        conn.close()

        return jsonify({'message': f'{symbol.upper()} removed from watchlist successfully'})

    except Exception as e:
        return jsonify({'error': f'Error removing from watchlist: {str(e)}'}), 500


@app.route('/api/portfolios', methods=['POST'])
def create_portfolio():
    """Create a new portfolio"""
    data = request.json

    if not data or 'name' not in data:
        return jsonify({'error': 'Portfolio name is required'}), 400

    name = data['name'].strip()
    description = data.get('description', '').strip()

    if not name:
        return jsonify({'error': 'Portfolio name cannot be empty'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if portfolio with same name already exists
    cursor.execute('SELECT id FROM portfolios WHERE name = %s', (name,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Portfolio with this name already exists'}), 409

    try:
        cursor.execute('''
            INSERT INTO portfolios (name, description, created_at)
            VALUES (%s, %s, %s)
        ''', (name, description, datetime.now()))

        portfolio_id = cursor.lastrowid
        conn.commit()
        conn.close()

        return jsonify({
            'message': 'Portfolio created successfully',
            'portfolio': {
                'id': portfolio_id,
                'name': name,
                'description': description
            }
        }), 201

    except pymysql.Error as err:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Database error: {str(err)}'}), 500


@app.route('/api/portfolios/<int:portfolio_id>', methods=['DELETE'])
def delete_portfolio(portfolio_id):
    """Delete a portfolio and all its holdings"""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if portfolio exists
    cursor.execute('SELECT name FROM portfolios WHERE id = %s',
                   (portfolio_id,))
    portfolio = cursor.fetchone()

    if not portfolio:
        conn.close()
        return jsonify({'error': 'Portfolio not found'}), 404

    portfolio_name = portfolio[0]

    try:
        # Delete all holdings first (foreign key constraint)
        cursor.execute(
            'DELETE FROM holdings WHERE portfolio_id = %s', (portfolio_id,))

        # Delete the portfolio
        cursor.execute('DELETE FROM portfolios WHERE id = %s', (portfolio_id,))

        conn.commit()
        conn.close()

        return jsonify({
            'message': f'Portfolio "{portfolio_name}" deleted successfully'
        })

    except pymysql.Error as err:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Database error: {str(err)}'}), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500


# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f'Client connected: {request.sid}')
    emit('status', {'message': 'Connected to stock data stream'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f'Client disconnected: {request.sid}')

@socketio.on('subscribe_stocks')
def handle_subscribe_stocks(data):
    """Handle stock subscription requests"""
    symbols = data.get('symbols', [])
    print(f'Client {request.sid} subscribed to stocks: {symbols}')
    emit('status', {'message': f'Subscribed to {len(symbols)} stocks'})

# Global variable to store socketio instance for use in other modules
app.socketio = socketio


if __name__ == '__main__':
    # Initialize database if needed
    init_db()
    # import_sp500(n=30)
    # keep_only_first_30_sp500()
    # start_stock_updater(interval=60)

    # Import and start the live stock tracker
    from live_stock_tracker_websocket import start_stock_tracker, set_socketio_instance
    
    # Set the socketio instance for the stock tracker
    set_socketio_instance(socketio)
    
    # Start the stock tracker in background
    start_stock_tracker()
    print("Live stock tracker with WebSocket integration started!")

    # Run the Flask app with SocketIO
    socketio.run(app, debug=True, host='0.0.0.0', port=5001)
