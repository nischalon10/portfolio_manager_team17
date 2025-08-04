import yfinance as yf
import asyncio
import websockets
import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
import logging
from concurrent.futures import ThreadPoolExecutor
import aiomysql
import threading
import queue
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MySQL connection configuration for aiomysql
DB_CONFIG = {
    'host': os.getenv('MYSQL_HOST', 'localhost'),
    'user': os.getenv('MYSQL_USER', 'root'),
    'password': os.getenv('MYSQL_PASSWORD', ''),
    'db': os.getenv('MYSQL_DATABASE', 'portfolio_manager'),  # aiomysql uses 'db' not 'database'
    'port': int(os.getenv('MYSQL_PORT', 3306))
}

# Predefined stock symbols and names
TRACKED_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
    {"symbol": "GOOGL", "name": "Alphabet Inc. (Class A)"},
    {"symbol": "AMZN", "name": "Amazon.com, Inc."},
    {"symbol": "TSLA", "name": "Tesla, Inc."},
    {"symbol": "NVDA", "name": "NVIDIA Corporation"},
    {"symbol": "META", "name": "Meta Platforms, Inc."},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc. (Class B)"},  # Fixed symbol format
    {"symbol": "UNH", "name": "UnitedHealth Group Incorporated"},
    {"symbol": "V", "name": "Visa Inc."},
    {"symbol": "JNJ", "name": "Johnson & Johnson"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co."},
    {"symbol": "PG", "name": "Procter & Gamble Company"},
    {"symbol": "MA", "name": "Mastercard Incorporated"},
    {"symbol": "HD", "name": "The Home Depot, Inc."},
    {"symbol": "XOM", "name": "Exxon Mobil Corporation"},
    {"symbol": "KO", "name": "The Coca-Cola Company"},
    {"symbol": "PEP", "name": "PepsiCo, Inc."},
    {"symbol": "LLY", "name": "Eli Lilly and Company"},
    {"symbol": "MRK", "name": "Merck & Co., Inc."},
    {"symbol": "WMT", "name": "Walmart Inc."},
    {"symbol": "DIS", "name": "The Walt Disney Company"},
    {"symbol": "BAC", "name": "Bank of America Corporation"},
    {"symbol": "NFLX", "name": "Netflix, Inc."},
    {"symbol": "INTC", "name": "Intel Corporation"}
]


class AsyncStockPriceUpdater:
    """Asynchronous stock price updater using yfinance WebSocket for real-time data."""
    
    def __init__(self):
        self.websocket_clients = set()  # Connected WebSocket clients
        self.running = False
        self.price_queue = asyncio.Queue()
        self.latest_prices = {}  # Cache for latest prices
        self.yf_websocket = None
        self.websocket_thread = None
        
    async def get_db_connection(self):
        """Create async database connection."""
        try:
            return await aiomysql.connect(**DB_CONFIG)
        except Exception as e:
            logger.error(f"Database connection error: {e}")
            raise

    async def initialize_stocks(self):
        """Initialize the stocks table with predefined stocks and ensure schema is correct."""
        conn = await self.get_db_connection()
        try:
            async with conn.cursor() as cursor:
                # Check if last_updated column exists, if not add it
                await cursor.execute("""
                    SELECT COUNT(*) 
                    FROM information_schema.columns 
                    WHERE table_schema = %s 
                    AND table_name = 'stocks' 
                    AND column_name = 'last_updated'
                """, (os.getenv('MYSQL_DATABASE', 'portfolio_manager'),))
                
                result = await cursor.fetchone()
                if result[0] == 0:
                    # Add last_updated column
                    await cursor.execute("""
                        ALTER TABLE stocks 
                        ADD COLUMN last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    """)
                    logger.info("Added last_updated column to stocks table")
                
                # Insert/update our tracked stocks
                for stock in TRACKED_STOCKS:
                    await cursor.execute(
                        '''INSERT INTO stocks (symbol, name, current_price) 
                           VALUES (%s, %s, %s) 
                           ON DUPLICATE KEY UPDATE name = VALUES(name)''',
                        (stock["symbol"], stock["name"], 100.0)
                    )
                await conn.commit()
                logger.info(f"Initialized {len(TRACKED_STOCKS)} stocks in database")
        except Exception as e:
            logger.error(f"Error initializing stocks: {e}")
            raise
        finally:
            conn.close()

    def yfinance_message_handler(self, message):
        """Handle messages from yfinance WebSocket."""
        try:
            if isinstance(message, dict):
                symbol = message.get('id', '')
                price = message.get('price')
                
                if symbol and price is not None:
                    price_data = {
                        'symbol': symbol,
                        'price': round(float(price), 2),
                        'timestamp': datetime.now().isoformat(),
                        'volume': message.get('dayVolume'),
                        'change': message.get('change'),
                        'changePercent': message.get('changePercent')
                    }
                    
                    # Update cache
                    self.latest_prices[symbol] = price_data
                    
                    # Put in queue for async processing
                    try:
                        asyncio.create_task(self.process_price_update(price_data))
                    except RuntimeError:
                        # If we're not in an async context, we'll handle this in the main loop
                        pass
                    
                    logger.debug(f"Received price update: {symbol} = ${price}")
        except Exception as e:
            logger.error(f"Error processing yfinance message: {e}")

    async def process_price_update(self, price_data: Dict):
        """Process a single price update."""
        try:
            # Update database
            await self.update_single_stock_price(price_data)
            
            # Broadcast to WebSocket clients
            await self.broadcast_price_update(price_data)
            
        except Exception as e:
            logger.error(f"Error processing price update for {price_data.get('symbol')}: {e}")

    async def update_single_stock_price(self, price_data: Dict):
        """Update a single stock price in the database."""
        conn = await self.get_db_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    '''UPDATE stocks 
                       SET current_price = %s, last_updated = NOW() 
                       WHERE symbol = %s''',
                    (price_data['price'], price_data['symbol'])
                )
                await conn.commit()
        except Exception as e:
            logger.error(f"Database update error for {price_data['symbol']}: {e}")
        finally:
            conn.close()

    async def broadcast_price_update(self, price_data: Dict):
        """Broadcast price update to all connected WebSocket clients."""
        if not self.websocket_clients:
            return
            
        message = json.dumps({
            'type': 'price_update',
            'data': {price_data['symbol']: price_data},
            'timestamp': datetime.now().isoformat()
        })
        
        disconnected = set()
        for client in self.websocket_clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.add(client)
        
        # Remove disconnected clients
        for client in disconnected:
            self.websocket_clients.discard(client)

    def start_yfinance_websocket(self):
        """Start yfinance WebSocket in a separate thread."""
        def websocket_runner():
            try:
                symbols = [stock["symbol"] for stock in TRACKED_STOCKS]
                logger.info(f"Attempting to start yfinance WebSocket for symbols: {symbols}")
                
                # Check if WebSocket is available
                if not hasattr(yf, 'WebSocket'):
                    logger.warning("yfinance WebSocket not available, falling back to polling mode")
                    # Fall back to polling mode
                    self.start_polling_mode()
                    return
                
                with yf.WebSocket() as ws:
                    self.yf_websocket = ws
                    ws.subscribe(symbols)
                    ws.listen(self.yfinance_message_handler)
                    
            except Exception as e:
                logger.error(f"yfinance WebSocket error: {e}")
                logger.info("Falling back to polling mode")
                self.start_polling_mode()
        
        self.websocket_thread = threading.Thread(target=websocket_runner, daemon=True)
        self.websocket_thread.start()
        logger.info("yfinance WebSocket thread started")

    def start_polling_mode(self):
        """Start polling mode as fallback when WebSocket is not available."""
        def polling_runner():
            try:
                symbols = [stock["symbol"] for stock in TRACKED_STOCKS]
                logger.info(f"Starting polling mode for symbols: {symbols}")
                
                while True:
                    for symbol in symbols:
                        try:
                            # Fetch current price
                            ticker = yf.Ticker(symbol)
                            
                            # Try multiple methods to get price
                            price = None
                            try:
                                # Try fast_info first
                                fast_info = ticker.fast_info
                                price = getattr(fast_info, 'last_price', None)
                            except:
                                try:
                                    # Try regular info
                                    info = ticker.info
                                    price = info.get('regularMarketPrice') or info.get('currentPrice')
                                except:
                                    # Try history
                                    try:
                                        history = ticker.history(period="1d")
                                        if not history.empty:
                                            price = history['Close'].iloc[-1]
                                    except:
                                        pass
                            
                            if price:
                                # Create price data similar to WebSocket format
                                price_data = {
                                    'symbol': symbol,
                                    'price': round(float(price), 2),
                                    'timestamp': datetime.now().isoformat()
                                }
                                
                                # Update cache
                                self.latest_prices[symbol] = price_data
                                logger.debug(f"Polled price update: {symbol} = ${price}")
                            
                        except Exception as e:
                            logger.debug(f"Error polling {symbol}: {e}")
                        
                        # Small delay between symbols to avoid rate limiting
                        time.sleep(0.1)
                    
                    # Wait before next polling cycle (every 30 seconds)
                    time.sleep(30)
                    
            except Exception as e:
                logger.error(f"Polling mode error: {e}")
        
        polling_thread = threading.Thread(target=polling_runner, daemon=True)
        polling_thread.start()
        logger.info("Polling mode started")

    async def register_client(self, websocket):
        """Register a new WebSocket client."""
        self.websocket_clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.websocket_clients)}")

    async def unregister_client(self, websocket):
        """Unregister a WebSocket client."""
        self.websocket_clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.websocket_clients)}")

    async def websocket_handler(self, websocket):
        """Handle WebSocket connections from clients."""
        await self.register_client(websocket)
        try:
            # Send current prices to newly connected client
            if self.latest_prices:
                await websocket.send(json.dumps({
                    'type': 'initial_prices',
                    'data': self.latest_prices,
                    'timestamp': datetime.now().isoformat()
                }))
            
            # Keep connection alive and handle any incoming messages
            async for message in websocket:
                try:
                    data = json.loads(message)
                    if data.get('type') == 'ping':
                        await websocket.send(json.dumps({'type': 'pong'}))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from client: {message}")
                
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error(f"WebSocket handler error: {e}")
        finally:
            await self.unregister_client(websocket)

    async def get_current_prices_from_db(self) -> Dict[str, Dict]:
        """Get current prices from database."""
        conn = await self.get_db_connection()
        try:
            async with conn.cursor() as cursor:
                await cursor.execute(
                    'SELECT symbol, current_price, last_updated FROM stocks WHERE symbol IN (%s)' % 
                    ','.join(['%s'] * len(TRACKED_STOCKS)),
                    [stock["symbol"] for stock in TRACKED_STOCKS]
                )
                results = await cursor.fetchall()
                
                prices = {}
                for symbol, price, last_updated in results:
                    prices[symbol] = {
                        'price': float(price) if price else 0.0,
                        'timestamp': last_updated.isoformat() if last_updated else datetime.now().isoformat()
                    }
                return prices
        except Exception as e:
            logger.error(f"Error getting prices from database: {e}")
            return {}
        finally:
            conn.close()

    async def start_websocket_server(self, host: str = 'localhost', port: int = 8765):
        """Start the WebSocket server for clients."""
        logger.info(f"Starting WebSocket server on ws://{host}:{port}")
        
        async with websockets.serve(self.websocket_handler, host, port):
            # Keep server running
            await asyncio.Future()

    async def periodic_db_sync(self):
        """Periodically sync cached prices to database (fallback)."""
        while self.running:
            try:
                if self.latest_prices:
                    conn = await self.get_db_connection()
                    try:
                        async with conn.cursor() as cursor:
                            for symbol, price_data in self.latest_prices.items():
                                await cursor.execute(
                                    '''UPDATE stocks 
                                       SET current_price = %s, last_updated = NOW() 
                                       WHERE symbol = %s''',
                                    (price_data['price'], symbol)
                                )
                            await conn.commit()
                            logger.debug(f"Periodic sync: Updated {len(self.latest_prices)} prices")
                    finally:
                        conn.close()
            except Exception as e:
                logger.error(f"Periodic DB sync error: {e}")
            
            await asyncio.sleep(30)  # Sync every 30 seconds

    async def start(self, websocket_host: str = 'localhost', websocket_port: int = 8765):
        """Start the complete async worker system."""
        self.running = True
        
        try:
            # Initialize stocks in database
            await self.initialize_stocks()
            
            # Start yfinance WebSocket in separate thread
            self.start_yfinance_websocket()
            
            # Wait a moment for WebSocket to initialize
            await asyncio.sleep(2)
            
            # Start periodic DB sync task
            sync_task = asyncio.create_task(self.periodic_db_sync())
            
            # Start WebSocket server for clients
            server_task = asyncio.create_task(
                self.start_websocket_server(websocket_host, websocket_port)
            )
            
            logger.info("✓ Async stock price updater started successfully")
            logger.info("✓ Real-time price updates via yfinance WebSocket")
            logger.info(f"✓ Client WebSocket server running on ws://{websocket_host}:{websocket_port}")
            
            # Wait for both tasks
            await asyncio.gather(sync_task, server_task)
            
        except KeyboardInterrupt:
            logger.info("Received shutdown signal")
        except Exception as e:
            logger.error(f"Error in main worker: {e}")
        finally:
            await self.stop()

    async def stop(self):
        """Stop the worker system."""
        logger.info("Stopping async stock price updater...")
        self.running = False
        
        # Stop yfinance WebSocket
        if self.yf_websocket:
            try:
                self.yf_websocket.close()
            except:
                pass
        
        # Disconnect all WebSocket clients
        for client in self.websocket_clients.copy():
            try:
                await client.close()
            except:
                pass
        
        logger.info("Async stock price updater stopped")


async def main():
    """Main entry point for the async worker."""
    updater = AsyncStockPriceUpdater()
    
    try:
        await updater.start()
    except KeyboardInterrupt:
        logger.info("Shutting down...")


if __name__ == "__main__":
    print("=== Real-Time Stock Price Updater with yfinance WebSocket ===")
    print("This worker will:")
    print("1. Connect to yfinance WebSocket for real-time price updates")
    print("2. Update MySQL database with live prices")
    print("3. Broadcast updates via WebSocket on ws://localhost:8765")
    print("4. Track 25 major stocks in real-time")
    print("\nPress Ctrl+C to stop\n")
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown complete!")
