import sqlite3
import random
from datetime import datetime, timedelta

def create_database():
    """Create the portfolio manager database with tables and sample data"""
    
    # Connect to SQLite database (creates file if it doesn't exist)
    conn = sqlite3.connect('portfolio_manager.db')
    cursor = conn.cursor()
    
    # Drop tables if they exist (for clean setup)
    cursor.execute('DROP TABLE IF EXISTS transactions')
    cursor.execute('DROP TABLE IF EXISTS holdings')
    cursor.execute('DROP TABLE IF EXISTS portfolios')
    cursor.execute('DROP TABLE IF EXISTS stocks')
    cursor.execute('DROP TABLE IF EXISTS account_balance')
    cursor.execute('DROP TABLE IF EXISTS net_worth_history')
    
    # Create stocks table
    cursor.execute('''
        CREATE TABLE stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol VARCHAR(10) UNIQUE NOT NULL,
            name VARCHAR(255),
            current_price DECIMAL(10,2)
        )
    ''')
    
    # Create account balance table
    cursor.execute('''
        CREATE TABLE account_balance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            balance DECIMAL(15,2) DEFAULT 100000.00,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create net worth history table
    cursor.execute('''
        CREATE TABLE net_worth_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER DEFAULT 1,
            date DATE NOT NULL,
            account_balance DECIMAL(15,2),
            portfolio_value DECIMAL(15,2),
            total_net_worth DECIMAL(15,2),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create portfolios table
    cursor.execute('''
        CREATE TABLE portfolios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255),
            description TEXT
        )
    ''')
    
    # Create holdings table
    cursor.execute('''
        CREATE TABLE holdings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            portfolio_id INTEGER NOT NULL,
            stock_id INTEGER NOT NULL,
            quantity INTEGER,
            avg_buy_price DECIMAL(10,2),
            FOREIGN KEY (portfolio_id) REFERENCES portfolios(id),
            FOREIGN KEY (stock_id) REFERENCES stocks(id)
        )
    ''')
    
    # Create transactions table
    cursor.execute('''
        CREATE TABLE transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_id INTEGER NOT NULL,
            portfolio_id INTEGER NOT NULL,
            type VARCHAR(4) CHECK (type IN ('BUY', 'SELL')),
            quantity INTEGER,
            price DECIMAL(10,2),
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (stock_id) REFERENCES stocks(id),
            FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
        )
    ''')
    
    print("Tables created successfully!")
    
    # Insert sample data into stocks table
    stocks_data = [
        ('AAPL', 'Apple Inc.', 175.43),
        ('GOOGL', 'Alphabet Inc.', 2750.12),
        ('MSFT', 'Microsoft Corporation', 338.85),
        ('AMZN', 'Amazon.com Inc.', 3380.00),
        ('TSLA', 'Tesla Inc.', 890.75),
        ('META', 'Meta Platforms Inc.', 325.20),
        ('NVDA', 'NVIDIA Corporation', 445.67),
        ('NFLX', 'Netflix Inc.', 425.89),
        ('AMD', 'Advanced Micro Devices', 110.45),
        ('INTC', 'Intel Corporation', 55.78)
    ]
    
    cursor.executemany('''
        INSERT INTO stocks (symbol, name, current_price) 
        VALUES (?, ?, ?)
    ''', stocks_data)
    
    print("Sample stocks data inserted!")
    
    # Insert sample data into portfolios table
    portfolios_data = [
        ('Tech Growth Portfolio', 'Focused on high-growth technology companies'),
        ('Dividend Income Portfolio', 'Conservative portfolio focused on dividend-paying stocks'),
        ('Aggressive Growth Portfolio', 'High-risk, high-reward investment strategy'),
        ('Blue Chip Portfolio', 'Large-cap, established companies'),
        ('ESG Sustainable Portfolio', 'Environmentally and socially responsible investments'),
        ('Value Investing Portfolio', 'Undervalued stocks with strong fundamentals'),
        ('International Diversified', 'Global exposure with diverse sector allocation'),
        ('Small Cap Growth', 'Small-cap companies with growth potential'),
        ('REIT Portfolio', 'Real Estate Investment Trust focused portfolio'),
        ('Balanced Conservative', 'Balanced mix of growth and income investments')
    ]
    
    cursor.executemany('''
        INSERT INTO portfolios (name, description) 
        VALUES (?, ?)
    ''', portfolios_data)
    
    print("Sample portfolios data inserted!")
    
    # Insert initial account balance
    cursor.execute('''
        INSERT INTO account_balance (user_id, balance) 
        VALUES (1, 100000.00)
    ''')
    
    print("Initial account balance set to $100,000!")
    
    # Note: Holdings, transactions, and net worth history tables are created but empty
    # This allows you to start fresh and create data through the application
    
    # Display some statistics
    cursor.execute('SELECT COUNT(*) FROM stocks')
    stock_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM portfolios')
    portfolio_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM holdings')
    holdings_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM transactions')
    transactions_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM net_worth_history')
    networth_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT balance FROM account_balance WHERE user_id = 1')
    account_balance = cursor.fetchone()[0]
    
    print("\n=== Database Creation Summary ===")
    print(f"Stocks: {stock_count} records")
    print(f"Portfolios: {portfolio_count} records")
    print(f"Holdings: {holdings_count} records (empty - ready for testing)")
    print(f"Transactions: {transactions_count} records (empty - ready for testing)")
    print(f"Net Worth History: {networth_count} records (empty - will be created automatically)")
    print(f"Account Balance: ${account_balance:.2f}")
    
    # Commit changes and close connection
    conn.commit()
    conn.close()
    
    print("\nDatabase 'portfolio_manager.db' created successfully!")
    print("The database has stocks and portfolios ready for testing.")
    print("Holdings and transactions will be created when you use the application.")

def display_sample_data():
    """Display some sample data from the created database"""
    conn = sqlite3.connect('portfolio_manager.db')
    cursor = conn.cursor()
    
    print("\n=== Sample Data Preview ===")
    
    # Show sample stocks
    print("\nStocks (first 5):")
    cursor.execute('SELECT * FROM stocks LIMIT 5')
    for row in cursor.fetchall():
        print(f"  {row[1]} ({row[2]}) - ${row[3]}")
    
    # Show sample portfolios
    print("\nPortfolios (first 3):")
    cursor.execute('SELECT * FROM portfolios LIMIT 3')
    for row in cursor.fetchall():
        print(f"  {row[1]}: {row[2]}")
    
    # Show account balance
    print("\nAccount Balance:")
    cursor.execute('SELECT balance FROM account_balance WHERE user_id = 1')
    balance = cursor.fetchone()
    if balance:
        print(f"  Current Balance: ${balance[0]:.2f}")
    
    # Show that relationship tables are empty
    cursor.execute('SELECT COUNT(*) FROM holdings')
    holdings_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM transactions')
    transactions_count = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM net_worth_history')
    networth_count = cursor.fetchone()[0]
    
    print(f"\nRelationship Tables (ready for testing):")
    print(f"  Holdings: {holdings_count} records")
    print(f"  Transactions: {transactions_count} records") 
    print(f"  Net Worth History: {networth_count} records")
    
    conn.close()

if __name__ == "__main__":
    create_database()
    display_sample_data()
