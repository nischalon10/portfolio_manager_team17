from flask import Flask, render_template, request, jsonify, redirect, url_for, flash
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'

# Database path
DB_PATH = os.path.join('Database', 'portfolio_manager.db')

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This enables column access by name
    return conn

def get_account_balance():
    """Get current account balance"""
    conn = get_db_connection()
    result = conn.execute('SELECT balance FROM account_balance WHERE user_id = 1').fetchone()
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

def init_db():
    """Initialize database if it doesn't exist"""
    if not os.path.exists(DB_PATH):
        from Database.create_database import create_database
        create_database()

@app.context_processor
def inject_account_balance():
    """Make account balance available in all templates"""
    return {'account_balance': get_account_balance()}

@app.route('/')
def index():
    """Home page showing portfolio overview"""
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
    
    return render_template('index.html', 
                         portfolios=portfolios, 
                         total_value=total_value,
                         recent_transactions=recent_transactions)

@app.route('/portfolios')
def portfolios():
    """View all portfolios"""
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
    
    return render_template('portfolios.html', portfolios=portfolios)

@app.route('/portfolio/<int:portfolio_id>')
def portfolio_detail(portfolio_id):
    """View detailed portfolio information"""
    conn = get_db_connection()
    
    # Get portfolio info
    portfolio = conn.execute('''
        SELECT * FROM portfolios WHERE id = ?
    ''', (portfolio_id,)).fetchone()
    
    if not portfolio:
        flash('Portfolio not found', 'error')
        return redirect(url_for('portfolios'))
    
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
    
    return render_template('portfolio_detail.html', 
                         portfolio=portfolio, 
                         holdings=holdings,
                         transactions=transactions)

@app.route('/stocks')
def stocks():
    """View all stocks"""
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
    
    return render_template('stocks.html', stocks=stocks)

@app.route('/stock/<string:symbol>')
def stock_detail(symbol):
    """View detailed stock information with buy/sell functionality"""
    conn = get_db_connection()
    
    # Get stock info
    stock = conn.execute('''
        SELECT * FROM stocks WHERE symbol = ?
    ''', (symbol.upper(),)).fetchone()
    
    if not stock:
        flash('Stock not found', 'error')
        return redirect(url_for('stocks'))
    
    # Get all portfolios for the dropdown
    portfolios = conn.execute('SELECT id, name FROM portfolios ORDER BY name').fetchall()
    
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
    
    return render_template('stock_detail.html', 
                         stock=stock, 
                         portfolios=portfolios,
                         holdings=holdings,
                         transactions=transactions)

@app.route('/stock/<string:symbol>/buy', methods=['POST'])
def buy_stock(symbol):
    """Handle stock purchase"""
    try:
        portfolio_id = request.form.get('portfolio_id')
        quantity = int(request.form.get('quantity'))
        price = float(request.form.get('price'))
        
        if not all([portfolio_id, quantity, price]) or quantity <= 0 or price <= 0:
            flash('Please provide valid portfolio, quantity, and price', 'error')
            return redirect(url_for('stock_detail', symbol=symbol))
        
        # Check if user has sufficient balance
        total_cost = quantity * price
        current_balance = get_account_balance()
        
        if current_balance < total_cost:
            flash(f'Insufficient balance. You need ${total_cost:.2f} but only have ${current_balance:.2f}', 'error')
            return redirect(url_for('stock_detail', symbol=symbol))
        
        conn = get_db_connection()
        
        # Get stock ID
        stock = conn.execute('SELECT id FROM stocks WHERE symbol = ?', (symbol.upper(),)).fetchone()
        if not stock:
            flash('Stock not found', 'error')
            return redirect(url_for('stocks'))
        
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
            new_avg_price = ((old_quantity * old_avg_price) + (quantity * price)) / new_quantity
            
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
        
        flash(f'Successfully bought {quantity} shares of {symbol.upper()} at ${price:.2f} for ${total_cost:.2f}', 'success')
        
    except ValueError:
        flash('Invalid quantity or price format', 'error')
    except Exception as e:
        flash(f'Error processing purchase: {str(e)}', 'error')
    
    return redirect(url_for('stock_detail', symbol=symbol))

@app.route('/stock/<string:symbol>/sell', methods=['POST'])
def sell_stock(symbol):
    """Handle stock sale"""
    try:
        portfolio_id = request.form.get('portfolio_id')
        quantity = int(request.form.get('quantity'))
        price = float(request.form.get('price'))
        
        if not all([portfolio_id, quantity, price]) or quantity <= 0 or price <= 0:
            flash('Please provide valid portfolio, quantity, and price', 'error')
            return redirect(url_for('stock_detail', symbol=symbol))
        
        conn = get_db_connection()
        
        # Get stock ID
        stock = conn.execute('SELECT id FROM stocks WHERE symbol = ?', (symbol.upper(),)).fetchone()
        if not stock:
            flash('Stock not found', 'error')
            return redirect(url_for('stocks'))
        
        stock_id = stock['id']
        
        # Check if holding exists and has enough shares
        holding = conn.execute('''
            SELECT id, quantity, avg_buy_price FROM holdings 
            WHERE portfolio_id = ? AND stock_id = ?
        ''', (portfolio_id, stock_id)).fetchone()
        
        if not holding:
            flash('No holdings found for this stock in the selected portfolio', 'error')
            return redirect(url_for('stock_detail', symbol=symbol))
        
        if holding['quantity'] < quantity:
            flash(f'Insufficient shares. You only have {holding["quantity"]} shares available', 'error')
            return redirect(url_for('stock_detail', symbol=symbol))
        
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
            # Update quantity (keep same avg_buy_price)
            conn.execute('''
                UPDATE holdings SET quantity = ? WHERE id = ?
            ''', (new_quantity, holding['id']))
        
        conn.commit()
        conn.close()
        
        # Add proceeds to account balance
        total_proceeds = quantity * price
        update_account_balance(total_proceeds)
        
        flash(f'Successfully sold {quantity} shares of {symbol.upper()} at ${price:.2f} for ${total_proceeds:.2f}', 'success')
        
    except ValueError:
        flash('Invalid quantity or price format', 'error')
    except Exception as e:
        flash(f'Error processing sale: {str(e)}', 'error')
    
    return redirect(url_for('stock_detail', symbol=symbol))

@app.route('/transactions')
def transactions():
    """View all transactions"""
    conn = get_db_connection()
    transactions = conn.execute('''
        SELECT t.id, t.type, s.symbol, s.name, p.name as portfolio_name,
               t.quantity, t.price, t.timestamp,
               (t.quantity * t.price) as total_amount
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        JOIN portfolios p ON t.portfolio_id = p.id
        ORDER BY t.timestamp DESC
        LIMIT 100
    ''').fetchall()
    conn.close()
    
    return render_template('transactions.html', transactions=transactions)

@app.route('/api/portfolio/<int:portfolio_id>/value')
def api_portfolio_value(portfolio_id):
    """API endpoint to get portfolio current value"""
    conn = get_db_connection()
    result = conn.execute('''
        SELECT COALESCE(SUM(h.quantity * s.current_price), 0) as total_value
        FROM holdings h
        JOIN stocks s ON h.stock_id = s.id
        WHERE h.portfolio_id = ?
    ''', (portfolio_id,)).fetchone()
    conn.close()
    
    return jsonify({'portfolio_id': portfolio_id, 'total_value': float(result['total_value'])})

@app.route('/api/stocks/prices')
def api_stock_prices():
    """API endpoint to get all stock prices"""
    conn = get_db_connection()
    stocks = conn.execute('SELECT symbol, current_price FROM stocks ORDER BY symbol').fetchall()
    conn.close()
    
    return jsonify({stock['symbol']: float(stock['current_price']) for stock in stocks})

@app.route('/api/account/balance')
def api_account_balance():
    """API endpoint to get current account balance"""
    return jsonify({'balance': get_account_balance()})

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    return render_template('500.html'), 500

if __name__ == '__main__':
    # Initialize database if needed
    init_db()
    
    # Run the Flask app
    app.run(debug=True, host='0.0.0.0', port=5001)