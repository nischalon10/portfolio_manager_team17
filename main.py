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

def init_db():
    """Initialize database if it doesn't exist"""
    if not os.path.exists(DB_PATH):
        from Database.create_database import create_database
        create_database()

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