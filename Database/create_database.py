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
    
    # Create stocks table
    cursor.execute('''
        CREATE TABLE stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol VARCHAR(10) UNIQUE NOT NULL,
            name VARCHAR(255),
            current_price DECIMAL(10,2)
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
    
    # Insert sample data into holdings table
    # Generate realistic holdings data
    holdings_data = []
    for portfolio_id in range(1, 11):  # 10 portfolios
        # Each portfolio will have 3-5 different stock holdings
        num_holdings = random.randint(3, 5)
        selected_stocks = random.sample(range(1, 11), num_holdings)
        
        for stock_id in selected_stocks:
            quantity = random.randint(10, 500)
            avg_buy_price = round(random.uniform(50, 300), 2)
            holdings_data.append((portfolio_id, stock_id, quantity, avg_buy_price))
    
    cursor.executemany('''
        INSERT INTO holdings (portfolio_id, stock_id, quantity, avg_buy_price) 
        VALUES (?, ?, ?, ?)
    ''', holdings_data)
    
    print(f"Sample holdings data inserted! ({len(holdings_data)} records)")
    
    # Insert sample data into transactions table
    transactions_data = []
    
    # Generate transactions for the past 30 days
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(50):  # 50 transactions
        portfolio_id = random.randint(1, 10)
        stock_id = random.randint(1, 10)
        transaction_type = random.choice(['BUY', 'SELL'])
        quantity = random.randint(1, 100)
        price = round(random.uniform(50, 350), 2)
        
        # Random date within the last 30 days
        random_days = random.randint(0, 30)
        random_hours = random.randint(0, 23)
        random_minutes = random.randint(0, 59)
        timestamp = base_date + timedelta(days=random_days, hours=random_hours, minutes=random_minutes)
        
        transactions_data.append((stock_id, portfolio_id, transaction_type, quantity, price, timestamp))
    
    cursor.executemany('''
        INSERT INTO transactions (stock_id, portfolio_id, type, quantity, price, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?)
    ''', transactions_data)
    
    print("Sample transactions data inserted!")
    
    # Display some statistics
    cursor.execute('SELECT COUNT(*) FROM stocks')
    stock_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM portfolios')
    portfolio_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM holdings')
    holdings_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM transactions')
    transactions_count = cursor.fetchone()[0]
    
    print("\n=== Database Creation Summary ===")
    print(f"Stocks: {stock_count} records")
    print(f"Portfolios: {portfolio_count} records")
    print(f"Holdings: {holdings_count} records")
    print(f"Transactions: {transactions_count} records")
    
    # Commit changes and close connection
    conn.commit()
    conn.close()
    
    print("\nDatabase 'portfolio_manager.db' created successfully!")
    print("You can now use this database with any SQLite client or Python application.")

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
    
    # Show sample holdings with joined data
    print("\nSample Holdings:")
    cursor.execute('''
        SELECT p.name, s.symbol, h.quantity, h.avg_buy_price
        FROM holdings h
        JOIN portfolios p ON h.portfolio_id = p.id
        JOIN stocks s ON h.stock_id = s.id
        LIMIT 5
    ''')
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[2]} shares of {row[1]} @ ${row[3]}")
    
    # Show sample transactions
    print("\nRecent Transactions (last 5):")
    cursor.execute('''
        SELECT t.type, s.symbol, t.quantity, t.price, t.timestamp
        FROM transactions t
        JOIN stocks s ON t.stock_id = s.id
        ORDER BY t.timestamp DESC
        LIMIT 5
    ''')
    for row in cursor.fetchall():
        print(f"  {row[0]} {row[2]} {row[1]} @ ${row[3]} on {row[4]}")
    
    conn.close()

if __name__ == "__main__":
    create_database()
    display_sample_data()
