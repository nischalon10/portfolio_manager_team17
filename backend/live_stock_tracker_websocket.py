import yfinance as yf
import ssl
import certifi
import os
import time
import pymysql
from datetime import datetime
import threading
import queue

# Database configuration
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'database': os.getenv('MYSQL_DATABASE', 'portfolio_manager'),
    'port': int(os.getenv('MYSQL_PORT', 3306)),
    'autocommit': True
}

# Simple connection management
update_queue = queue.Queue()
db_lock = threading.Lock()

def get_db_connection():
    """Get a database connection with retry logic"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            conn = pymysql.connect(**DB_CONFIG)
            return conn
        except pymysql.Error as e:
            if attempt < max_retries - 1:
                print(f"Database connection attempt {attempt + 1} failed: {e}. Retrying...")
                time.sleep(1)
            else:
                raise e

# Global variable to hold the socketio instance
socketio_instance = None

def set_socketio_instance(socketio):
    """Set the socketio instance for emitting events"""
    global socketio_instance
    socketio_instance = socketio

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
    """Queue stock price update for batch processing"""
    update_queue.put((symbol, price))

def batch_update_worker():
    """Worker thread to process database updates in batches"""
    batch_updates = {}
    last_update_time = time.time()
    
    while True:
        try:
            # Wait for updates with timeout
            try:
                symbol, price = update_queue.get(timeout=2)
                batch_updates[symbol] = price
            except queue.Empty:
                # Process any pending updates even if queue is empty
                pass
            
            current_time = time.time()
            
            # Process batch every 5 seconds or when we have 10+ updates
            if (current_time - last_update_time >= 5) or len(batch_updates) >= 10:
                if batch_updates:
                    process_batch_updates(batch_updates)
                    batch_updates.clear()
                    last_update_time = current_time
                    
        except Exception as e:
            print(f"Error in batch update worker: {e}")
            time.sleep(1)

def process_batch_updates(updates):
    """Process a batch of stock price updates with thread safety"""
    if not updates:
        return
        
    with db_lock:  # Ensure only one thread updates database at a time
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Use a single query to update multiple stocks
            update_cases = []
            symbols_list = []
            
            for symbol, price in updates.items():
                update_cases.append(f"WHEN '{symbol}' THEN {price}")
                symbols_list.append(f"'{symbol}'")
            
            query = f"""
                UPDATE stocks 
                SET current_price = CASE symbol 
                    {' '.join(update_cases)}
                    ELSE current_price 
                END
                WHERE symbol IN ({', '.join(symbols_list)})
            """
            
            cursor.execute(query)
            updated_count = cursor.rowcount
            
            print(f"Batch database update: {updated_count} stocks updated ({', '.join(updates.keys())})")
            
            conn.close()
            
        except pymysql.Error as e:
            print(f"Batch database error: {e}")
        except Exception as e:
            print(f"Error in batch update: {e}")

# Dictionary to track last print time for each symbol
last_print_time = {}
# Dictionary to track last emit time for each symbol (emit more frequently than print)
last_emit_time = {}

# Define message callback to handle incoming data
def message_handler(message):
    """Handle incoming WebSocket messages - update database and emit to frontend clients"""
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
        
        # Update last print time for this symbol
        last_print_time[symbol] = current_time
    
    # Queue database update (will be processed in batches)
    update_stock_price_in_db(symbol, price)
    
    # Emit to frontend clients every 10 seconds (more frequent than console output)
    if symbol not in last_emit_time or (current_time - last_emit_time[symbol]) >= 10:
        if socketio_instance:
            # Prepare data for frontend
            stock_data = {
                'symbol': symbol,
                'price': round(price, 4),
                'change_percent': round(change_percent, 2),
                'volume': int(volume) if volume else 0,
                'market_hours': market_hours,
                'status': "MARKET OPEN" if market_hours == 1 else "AFTER HOURS",
                'timestamp': datetime.now().isoformat()
            }
            
            # Emit to all connected clients
            socketio_instance.emit('stock_update', stock_data)
            
        # Update last emit time for this symbol
        last_emit_time[symbol] = current_time

def get_tracked_symbols():
    """Get the list of stock symbols to track from the database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get all stock symbols from the database
        cursor.execute('SELECT symbol FROM stocks ORDER BY symbol')
        symbols = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        return symbols
        
    except pymysql.Error as e:
        print(f"Database error when fetching symbols: {e}")
        # Fallback to hard-coded list if database fails
        return [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "BRK-B",
            "UNH", "V", "JNJ", "JPM", "PG", "MA", "HD", "XOM", "KO", "PEP",
            "LLY", "MRK", "WMT", "DIS", "BAC", "NFLX", "INTC"
        ]
    except Exception as e:
        print(f"Error fetching symbols: {e}")
        # Fallback to hard-coded list
        return [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "BRK-B",
            "UNH", "V", "JNJ", "JPM", "PG", "MA", "HD", "XOM", "KO", "PEP",
            "LLY", "MRK", "WMT", "DIS", "BAC", "NFLX", "INTC"
        ]

def test_database_connection():
    """Test database connection and show current stock prices"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("Database connection successful!")
        
        # Check current stock prices in database for all stocks
        cursor.execute('''
            SELECT symbol, name, current_price 
            FROM stocks 
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

def start_stock_tracker():
    """Start the stock tracker in a separate thread"""
    def run_tracker():
        # Configure SSL certificates first
        if not fix_ssl_certificates():
            print("Failed to configure SSL certificates. Exiting...")
            return
        
        # Test database connection
        if not test_database_connection():
            print("Database connection failed. Exiting...")
            return
        
        # Start the batch update worker thread
        batch_worker_thread = threading.Thread(target=batch_update_worker, daemon=True)
        batch_worker_thread.start()
        print("Database batch update worker started")
        
        # Get symbols to track from database
        symbols = get_tracked_symbols()
        
        if not symbols:
            print("No symbols found to track. Exiting...")
            return
        
        print("\nStarting live stock tracker with WebSocket and database updates...")
        print(f"Tracking symbols: {', '.join(symbols)}")
        print(f"Total symbols: {len(symbols)}")
        print("Data will be displayed once every minute for each symbol.")
        print("Frontend clients will receive updates every 10 seconds.")
        print("Database updates will be batched every 5 seconds for efficiency.")
        print("-" * 80)
        
        try:
            # Use WebSocket with context manager (recommended approach)
            with yf.WebSocket() as ws:
                ws.subscribe(symbols)
                print("Successfully subscribed to symbols. Listening for live data...")
                print("-" * 80)
                ws.listen(message_handler)
                
        except KeyboardInterrupt:
            print("\nStopping live stock tracker...")
        except Exception as e:
            print(f"WebSocket connection failed: {e}")
            print("Make sure you have an active internet connection and try again.")
    
    # Start the tracker in a daemon thread
    tracker_thread = threading.Thread(target=run_tracker, daemon=True)
    tracker_thread.start()
    print("Stock tracker started in background thread")
    return tracker_thread

if __name__ == "__main__":
    # For testing purposes - run standalone
    start_stock_tracker()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nShutting down...")
