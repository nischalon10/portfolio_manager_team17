import yfinance as yf
import ssl
import certifi
import os
import time
import pymysql
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'portfolio_manager'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'autocommit': True
}

# Fix SSL certificate issues for macOS
def fix_ssl_certificates():
    """Configure SSL certificates to work with yfinance WebSocket"""
    try:
        # Set the certificate file
        os.environ['SSL_CERT_FILE'] = certifi.where()
        os.environ['REQUESTS_CA_BUNDLE'] = certifi.where()
        
        # Create SSL context
        ssl_context = ssl.create_default_context(cafile=certifi.where())
        ssl._create_default_https_context = lambda: ssl_context
        
        print("SSL certificates configured successfully")
        return True
    except Exception as e:
        print(f"Failed to configure SSL certificates: {e}")
        return False

def update_stock_price_in_db(symbol, price):
    """Update stock price in the database"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Update the current_price for the given symbol
        cursor.execute('''
            UPDATE stocks 
            SET current_price = %s 
            WHERE symbol = %s
        ''', (price, symbol))
        
        if cursor.rowcount > 0:
            print(f"Database updated: {symbol} price set to ${price:.4f}")
        else:
            print(f"Warning: No stock found with symbol {symbol} in database")
        
        conn.close()
        
    except pymysql.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error updating database: {e}")

# Dictionary to track last print time for each symbol
last_print_time = {}

# Define message callback to handle incoming data
def message_handler(message):
    """Handle incoming WebSocket messages - print only once per minute per symbol and update database"""
    symbol = message.get('id', 'Unknown')
    price = message.get('price', 0)
    change_percent = message.get('change_percent', 0)
    volume = message.get('day_volume', 0)
    market_hours = message.get('market_hours', 0)
    
    # Get current time
    current_time = time.time()
    
    # Check if we should print for this symbol (once per minute)
    if symbol not in last_print_time or (current_time - last_print_time[symbol]) >= 60:
        # Format the output for better readability
        status = "MARKET OPEN" if market_hours == 1 else "AFTER HOURS"
        volume_formatted = f"{int(volume):,}" if volume else "N/A"
        timestamp = datetime.now().strftime("%H:%M:%S")
        
        print(f"[{timestamp}] [{status}] {symbol}: ${price:.4f} | Change: {change_percent:.2f}% | Volume: {volume_formatted}")
        
        # Update database with current price
        update_stock_price_in_db(symbol, price)
        
        # Update last print time for this symbol
        last_print_time[symbol] = current_time

def test_database_connection():
    """Test database connection and show current stock prices"""
    try:
        conn = pymysql.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        print("Database connection successful!")
        
        # Check current stock prices in database for our target symbols
        cursor.execute('''
            SELECT symbol, name, current_price 
            FROM stocks 
            WHERE symbol IN ('AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'BRK-B',
                           'UNH', 'V', 'JNJ', 'JPM', 'PG', 'MA', 'HD', 'XOM', 'KO', 'PEP',
                           'LLY', 'MRK', 'WMT', 'DIS', 'BAC', 'NFLX', 'INTC')
            ORDER BY symbol
        ''')
        
        stocks = cursor.fetchall()
        if stocks:
            print("\nCurrent stock prices in database:")
            for symbol, name, price in stocks:
                print(f"  {symbol}: {name} - ${price:.2f}")
        else:
            print("No target stocks found in database!")
        
        conn.close()
        return True
        
    except pymysql.Error as e:
        print(f"Database connection failed: {e}")
        return False
    except Exception as e:
        print(f"Error testing database: {e}")
        return False

def main():
    # Configure SSL certificates first
    if not fix_ssl_certificates():
        print("Failed to configure SSL certificates. Exiting...")
        return
    
    # Test database connection
    if not test_database_connection():
        print("Database connection failed. Exiting...")
        return
    
    # Define symbols to track (all portfolio stocks)
    symbols = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "BRK-B",
        "UNH", "V", "JNJ", "JPM", "PG", "MA", "HD", "XOM", "KO", "PEP",
        "LLY", "MRK", "WMT", "DIS", "BAC", "NFLX", "INTC"
    ]
    
    print("\nStarting live stock tracker with WebSocket and database updates...")
    print(f"Tracking symbols: {', '.join(symbols)}")
    print("Data will be displayed once every minute for each symbol and prices will be updated in the database.")
    print("-" * 80)
    
    try:
        # Use WebSocket with context manager (recommended approach)
        with yf.WebSocket() as ws:
            ws.subscribe(symbols)
            print("Successfully subscribed to symbols. Listening for live data...")
            print("Press Ctrl+C to stop the tracker.")
            print("-" * 80)
            ws.listen(message_handler)
            
    except KeyboardInterrupt:
        print("\nStopping live stock tracker...")
    except Exception as e:
        print(f"WebSocket connection failed: {e}")
        print("Make sure you have an active internet connection and try again.")

if __name__ == "__main__":
    main()