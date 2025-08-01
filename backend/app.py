from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
from datetime import datetime
import threading
# from database_update import fetch_and_update_stock_prices
import time
from database_update import import_sp500
import yfinance as yf

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Database path
DB_PATH = os.path.join('..', 'Database', 'portfolio_manager.db')


def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    conn.row_factory = sqlite3.Row  # This enables column access by name
    return conn


def get_account_balance():
    """Get current account balance"""
    conn = get_db_connection()
    result = conn.execute(
        'SELECT balance FROM account_balance WHERE user_id = 1').fetchone()
    conn.close()
    return float(result['balance']) if result else 0.0


def update_account_balance(amount):
    """Update account balance by adding/subtracting amount"""
    conn = get_db_connection()
    conn.execute('''
        UPDATE account_balance 
        SET balance = balance + ?, last_updated = ?
        WHERE user_id = 1
    ''', (amount, datetime.now()))
    conn.commit()
    conn.close()


def record_net_worth_snapshot():
    """Record current net worth for historical tracking after each transaction"""
    conn = get_db_connection()

    # Get current account balance
    balance_result = conn.execute(
        'SELECT balance FROM account_balance WHERE user_id = 1').fetchone()
    account_balance = float(
        balance_result['balance']) if balance_result else 0.0

    # Get current portfolio value
    portfolio_result = conn.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''').fetchone()
    portfolio_value = float(
        portfolio_result['total']) if portfolio_result else 0.0

    total_net_worth = account_balance + portfolio_value
    current_time = datetime.now()
    today = current_time.strftime('%Y-%m-%d')

    # Always insert new entry for each transaction
    conn.execute('''
        INSERT INTO net_worth_history (user_id, date, account_balance, portfolio_value, total_net_worth, timestamp)
        VALUES (1, ?, ?, ?, ?, ?)
    ''', (today, account_balance, portfolio_value, total_net_worth, current_time))

    conn.commit()
    conn.close()


def init_db():
    """Initialize database if it doesn't exist"""
    if not os.path.exists(DB_PATH):
        # Database should already exist from the original project
        print(f"Database not found at {DB_PATH}")
        print("Please make sure the database exists at the correct path")
        return

# API Routes


@app.route('/api/portfolios', methods=['GET'])
def get_portfolios():
    """Get all portfolios with summary"""
    conn = get_db_connection()
    portfolios = conn.execute('''
        SELECT p.id, p.name, p.description, 
               COUNT(h.id) as holdings_count,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value
        FROM portfolios p
        LEFT JOIN holdings h ON p.id = h.portfolio_id
        LEFT JOIN stocks s ON h.stock_id = s.id
        GROUP BY p.id, p.name, p.description
        ORDER BY p.name
    ''').fetchall()
    conn.close()

    return jsonify([{
        'id': row['id'],
        'name': row['name'],
        'description': row['description'],
        'holdings_count': row['holdings_count'],
        'total_value': float(row['total_value'])
    } for row in portfolios])


@app.route('/api/portfolios/<int:portfolio_id>', methods=['GET'])
def get_portfolio_detail(portfolio_id):
    """Get detailed portfolio information"""
    conn = get_db_connection()

    # Get portfolio info
    portfolio = conn.execute('''
        SELECT * FROM portfolios WHERE id = ?
    ''', (portfolio_id,)).fetchone()

    if not portfolio:
        return jsonify({'error': 'Portfolio not found'}), 404

    # Get holdings with current values
    holdings = conn.execute('''
        SELECT h.id, s.symbol, s.name, h.quantity, h.avg_buy_price, s.current_price,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * (s.current_price - h.avg_buy_price)) as profit_loss
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
        WHERE h.portfolio_id = ?
        ORDER BY current_value DESC
    ''', (portfolio_id,)).fetchall()

    # Get transactions for this portfolio
    transactions = conn.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        WHERE t.portfolio_id = ?
        ORDER BY t.timestamp DESC
        LIMIT 20
    ''', (portfolio_id,)).fetchall()

    conn.close()

    return jsonify({
        'portfolio': {
            'id': portfolio['id'],
            'name': portfolio['name'],
            'description': portfolio['description']
        },
        'holdings': [{
            'id': row['id'],
            'symbol': row['symbol'],
            'name': row['name'],
            'quantity': row['quantity'],
            'avg_buy_price': float(row['avg_buy_price']),
            'current_price': float(row['current_price']),
            'current_value': float(row['current_value']),
            'profit_loss': float(row['profit_loss'])
        } for row in holdings],
        'transactions': [{
            'type': row['type'],
            'symbol': row['symbol'],
            'name': row['name'],
            'quantity': row['quantity'],
            'price': float(row['price']),
            'timestamp': row['timestamp']
        } for row in transactions]
    })


@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    """Get all stocks"""
    conn = get_db_connection()
    stocks = conn.execute('''
        SELECT s.*, 
               COALESCE(SUM(h.quantity), 0) as total_shares_held,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value_held
        FROM stocks s
        LEFT JOIN holdings h ON s.id = h.stock_id
        GROUP BY s.id, s.symbol, s.name, s.current_price
        ORDER BY s.symbol
    ''').fetchall()
    conn.close()

    return jsonify([{
        'id': row['id'],
        'symbol': row['symbol'],
        'name': row['name'],
        'current_price': float(row['current_price']),
        'total_shares_held': row['total_shares_held'],
        'total_value_held': float(row['total_value_held'])
    } for row in stocks])


@app.route('/api/stocks/<string:symbol>', methods=['GET'])
def get_stock_detail(symbol):
    """Get detailed stock information"""
    conn = get_db_connection()

    # Get stock info
    stock = conn.execute('''
        SELECT * FROM stocks WHERE symbol = ?
    ''', (symbol.upper(),)).fetchone()

    if not stock:
        return jsonify({'error': 'Stock not found'}), 404

    # Get holdings for this stock across all portfolios
    holdings = conn.execute('''
        SELECT h.*, p.name as portfolio_name,
               (h.quantity * s.current_price) as current_value,
               (h.quantity * (s.current_price - h.avg_buy_price)) as profit_loss
        FROM holdings h
        JOIN portfolios p ON h.portfolio_id = p.id
        JOIN stocks s ON h.stock_id = s.id
        WHERE s.symbol = ?
        ORDER BY p.name
    ''', (symbol.upper(),)).fetchall()

    # Get recent transactions for this stock
    transactions = conn.execute('''
        SELECT t.*, p.name as portfolio_name
        FROM transactions t
        JOIN portfolios p ON t.portfolio_id = p.id
        JOIN stocks s ON t.stock_id = s.id
        WHERE s.symbol = ?
        ORDER BY t.timestamp DESC
        LIMIT 20
    ''', (symbol.upper(),)).fetchall()

    conn.close()

    return jsonify({
        'stock': {
            'id': stock['id'],
            'symbol': stock['symbol'],
            'name': stock['name'],
            'current_price': float(stock['current_price'])
        },
        'holdings': [{
            'id': row['id'],
            'portfolio_id': row['portfolio_id'],
            'portfolio_name': row['portfolio_name'],
            'quantity': row['quantity'],
            'avg_buy_price': float(row['avg_buy_price']),
            'current_value': float(row['current_value']),
            'profit_loss': float(row['profit_loss'])
        } for row in holdings],
        'transactions': [{
            'id': row['id'],
            'type': row['type'],
            'quantity': row['quantity'],
            'price': float(row['price']),
            'timestamp': row['timestamp'],
            'portfolio_name': row['portfolio_name']
        } for row in transactions]
    })


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

        # Get stock ID
        stock = conn.execute(
            'SELECT id FROM stocks WHERE symbol = ?', (symbol.upper(),)).fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        stock_id = stock['id']

        # Insert transaction
        conn.execute('''
            INSERT INTO transactions (stock_id, portfolio_id, type, quantity, price, timestamp)
            VALUES (?, ?, 'BUY', ?, ?, ?)
        ''', (stock_id, portfolio_id, quantity, price, datetime.now()))

        # Check if holding already exists for this portfolio and stock
        existing_holding = conn.execute('''
            SELECT id, quantity, avg_buy_price FROM holdings 
            WHERE portfolio_id = ? AND stock_id = ?
        ''', (portfolio_id, stock_id)).fetchone()

        if existing_holding:
            # Update existing holding - calculate new average price
            old_quantity = existing_holding['quantity']
            old_avg_price = existing_holding['avg_buy_price']
            new_quantity = old_quantity + quantity
            new_avg_price = ((old_quantity * old_avg_price) +
                             (quantity * price)) / new_quantity

            conn.execute('''
                UPDATE holdings 
                SET quantity = ?, avg_buy_price = ?
                WHERE id = ?
            ''', (new_quantity, new_avg_price, existing_holding['id']))
        else:
            # Create new holding
            conn.execute('''
                INSERT INTO holdings (portfolio_id, stock_id, quantity, avg_buy_price)
                VALUES (?, ?, ?, ?)
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

        # Get stock ID
        stock = conn.execute(
            'SELECT id FROM stocks WHERE symbol = ?', (symbol.upper(),)).fetchone()
        if not stock:
            return jsonify({'error': 'Stock not found'}), 404

        stock_id = stock['id']

        # Check if user has enough shares to sell
        holding = conn.execute('''
            SELECT id, quantity, avg_buy_price FROM holdings 
            WHERE portfolio_id = ? AND stock_id = ?
        ''', (portfolio_id, stock_id)).fetchone()

        if not holding or holding['quantity'] < quantity:
            available = holding['quantity'] if holding else 0
            return jsonify({
                'error': f'Insufficient shares. You have {available} shares but trying to sell {quantity}'
            }), 400

        # Insert transaction
        conn.execute('''
            INSERT INTO transactions (stock_id, portfolio_id, type, quantity, price, timestamp)
            VALUES (?, ?, 'SELL', ?, ?, ?)
        ''', (stock_id, portfolio_id, quantity, price, datetime.now()))

        # Update holding
        new_quantity = holding['quantity'] - quantity

        if new_quantity == 0:
            # Remove holding if no shares left
            conn.execute('DELETE FROM holdings WHERE id = ?', (holding['id'],))
        else:
            # Update quantity
            conn.execute('''
                UPDATE holdings 
                SET quantity = ?
                WHERE id = ?
            ''', (new_quantity, holding['id']))

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
    transactions = conn.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp, p.name as portfolio_name
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        JOIN portfolios p ON t.portfolio_id = p.id
        ORDER BY t.timestamp DESC
        LIMIT 50
    ''').fetchall()
    conn.close()

    return jsonify([{
        'type': row['type'],
        'symbol': row['symbol'],
        'name': row['name'],
        'quantity': row['quantity'],
        'price': float(row['price']),
        'timestamp': row['timestamp'],
        'portfolio_name': row['portfolio_name']
    } for row in transactions])


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    """Get dashboard data"""
    conn = get_db_connection()

    # Get portfolio summary
    portfolios = conn.execute('''
        SELECT p.id, p.name, p.description, 
               COUNT(h.id) as holdings_count,
               COALESCE(SUM(h.quantity * s.current_price), 0) as total_value
        FROM portfolios p
        LEFT JOIN holdings h ON p.id = h.portfolio_id
        LEFT JOIN stocks s ON h.stock_id = s.id
        GROUP BY p.id, p.name, p.description
        ORDER BY total_value DESC
    ''').fetchall()

    # Get total portfolio value
    total_value = conn.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''').fetchone()['total']

    # Get total cost basis and profit/loss
    profit_loss_data = conn.execute('''
        SELECT 
            COALESCE(SUM(h.quantity * h.avg_buy_price), 0) as total_cost_basis,
            COALESCE(SUM(h.quantity * s.current_price), 0) as total_current_value,
            COALESCE(SUM(h.quantity * (s.current_price - h.avg_buy_price)), 0) as total_profit_loss
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
    ''').fetchone()

    total_cost_basis = float(profit_loss_data['total_cost_basis'])
    total_current_value = float(profit_loss_data['total_current_value'])
    total_profit_loss = float(profit_loss_data['total_profit_loss'])

    # Calculate profit/loss percentage
    profit_loss_percentage = 0.0
    if total_cost_basis > 0:
        profit_loss_percentage = (total_profit_loss / total_cost_basis) * 100

    # Get recent transactions
    recent_transactions = conn.execute('''
        SELECT t.type, s.symbol, s.name, t.quantity, t.price, t.timestamp, p.name as portfolio_name
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        JOIN portfolios p ON t.portfolio_id = p.id
        ORDER BY t.timestamp DESC
        LIMIT 10
    ''').fetchall()

    conn.close()

    return jsonify({
        'portfolios': [{
            'id': row['id'],
            'name': row['name'],
            'description': row['description'],
            'holdings_count': row['holdings_count'],
            'total_value': float(row['total_value'])
        } for row in portfolios],
        'total_value': float(total_value),
        'total_profit_loss': total_profit_loss,
        'profit_loss_percentage': profit_loss_percentage,
        'total_cost_basis': total_cost_basis,
        'account_balance': get_account_balance(),
        'recent_transactions': [{
            'type': row['type'],
            'symbol': row['symbol'],
            'name': row['name'],
            'quantity': row['quantity'],
            'price': float(row['price']),
            'timestamp': row['timestamp'],
            'portfolio_name': row['portfolio_name']
        } for row in recent_transactions]
    })


@app.route('/api/portfolio/<int:portfolio_id>/value')
def api_portfolio_value(portfolio_id):
    """API endpoint to get portfolio value"""
    conn = get_db_connection()
    result = conn.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as value
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
        WHERE h.portfolio_id = ?
    ''', (portfolio_id,)).fetchone()
    conn.close()

    return jsonify({'value': float(result['value'])})


@app.route('/api/stocks/prices')
def api_stock_prices():
    """API endpoint to get all stock prices"""
    conn = get_db_connection()
    stocks = conn.execute(
        'SELECT symbol, current_price FROM stocks ORDER BY symbol').fetchall()
    conn.close()

    return jsonify({stock['symbol']: float(stock['current_price']) for stock in stocks})


@app.route('/api/account/balance')
def api_account_balance():
    """API endpoint to get current account balance"""
    return jsonify({'balance': get_account_balance()})


@app.route('/api/net-worth/history')
def api_net_worth_history():
    """API endpoint to get net worth history for chart"""
    limit = request.args.get('limit', 50, type=int)

    conn = get_db_connection()
    history = conn.execute('''
        SELECT date, account_balance, portfolio_value, total_net_worth, timestamp
        FROM net_worth_history 
        WHERE user_id = 1 
        ORDER BY timestamp DESC 
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()

    # Reverse to get chronological order
    history = list(reversed(history))

    return jsonify([{
        'date': row['date'],
        'timestamp': row['timestamp'],
        'account_balance': float(row['account_balance']),
        'portfolio_value': float(row['portfolio_value']),
        'total_net_worth': float(row['total_net_worth'])
    } for row in history])


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({'error': 'Endpoint not found'}), 404


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return jsonify({'error': 'Internal server error'}), 500


if __name__ == '__main__':
    # Initialize database if needed
    init_db()
    # import_sp500(n=30)
    # keep_only_first_30_sp500()
    # start_stock_updater(interval=60)

    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5001)
