import sqlite3
import yfinance as yf
import pandas as pd
import time
import threading
from datetime import datetime
import asyncio
import websockets
import json

DB_PATH = '../Database/portfolio_manager.db'


def get_sp500_symbols(n=10):
    """Fetch the first n S&P 500 stock symbols from Wikipedia using pandas."""
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    tables = pd.read_html(url)
    df = tables[0]
    return df['Symbol'].tolist()[:n]


def import_sp500(n=10):
    """Import the first n S&P 500 companies into the stocks table."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()

    symbols = get_sp500_symbols(n)
    for symbol in symbols:
        try:
            stock = yf.Ticker(symbol)
            info = stock.info
            name = info.get('shortName') or info.get('longName') or symbol
            price = info.get('regularMarketPrice') or info.get(
                'currentPrice') or 100.0
            cursor.execute(
                'INSERT OR IGNORE INTO stocks (symbol, name, current_price) VALUES (?, ?, ?)',
                (symbol, name, price)
            )
            print(f"Added {symbol}: {name}")
        except Exception as e:
            print(f"Error adding {symbol}: {e}")

    conn.commit()
    conn.close()
    print(f"Imported {n} S&P 500 companies into stocks table.")


def fetch_and_update_stock_prices():
    """Fetch and update prices for the first 30 S&P 500 stocks in the database."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()

    symbols = get_sp500_symbols(n=10)
    prices = {}
    for symbol in symbols:
        try:
            ticker = yf.Ticker(symbol)
            info = ticker.info
            price = info.get('regularMarketPrice') or info.get('currentPrice')
            if price:
                cursor.execute(
                    'UPDATE stocks SET current_price = ? WHERE symbol = ?',
                    (price, symbol)
                )
                prices[symbol] = {
                    'price': round(price, 2),
                    'currency': info.get('currency', 'USD'),
                    'name': info.get('shortName', symbol)
                }
            else:
                print(f"Could not fetch price for {symbol}")
        except Exception as e:
            print(f"Error updating {symbol}: {e}")

    conn.commit()
    conn.close()
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Stock prices updated for first 30 S&P 500 stocks.\n")
    return prices

# --- WebSocket Server Section ---


class StockWebSocketServer:
    def __init__(self, interval=60):
        self.clients = set()
        self.interval = interval
        self.running = True

    async def register(self, websocket):
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")

    async def unregister(self, websocket):
        self.clients.discard(websocket)
        print(f"Client disconnected. Total clients: {len(self.clients)}")

    async def broadcast(self, prices):
        if not self.clients:
            return
        message = json.dumps({
            'type': 'price_update',
            'data': prices,
            'timestamp': datetime.now().isoformat()
        })
        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
        for client in disconnected:
            self.clients.discard(client)

    async def price_updater(self):
        while self.running:
            prices = fetch_and_update_stock_prices()
            await self.broadcast(prices)
            await asyncio.sleep(self.interval)

    async def handler(self, websocket, path):
        await self.register(websocket)
        try:
            async for _ in websocket:
                pass  # No need to handle messages from clients in this example
        finally:
            await self.unregister(websocket)

    async def start(self, host='localhost', port=8765):
        print(f"Starting WebSocket server on ws://{host}:{port}")
        asyncio.create_task(self.price_updater())
        async with websockets.serve(self.handler, host, port):
            await asyncio.Future()  # Run forever


def run_console_mode():
    print("Real-Time Stock Price Monitor (Console Mode)")
    print("=" * 50)
    symbols = get_sp500_symbols(n=30)
    print(f"Tracking: {', '.join(symbols)}")
    print("Press Ctrl+C to stop\n")
    try:
        while True:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Fetching prices...")
            prices = {}
            for symbol in symbols:
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    price = info.get('regularMarketPrice') or info.get(
                        'currentPrice')
                    if price:
                        prices[symbol] = {
                            'price': round(price, 2),
                            'currency': info.get('currency', 'USD'),
                            'name': info.get('shortName', symbol)
                        }
                        print(
                            f"{symbol}: ${price:.2f} ({info.get('shortName', symbol)})")
                    else:
                        print(f"Could not fetch price for {symbol}")
                except Exception as e:
                    print(f"Error fetching {symbol}: {e}")
            time.sleep(10)  # Update every 10 seconds
    except KeyboardInterrupt:
        print("\nStopping price monitor...")


if __name__ == "__main__":
    # Uncomment and run once to import the first 30 S&P 500 stocks
    # import_sp500(n=30)

    print("Choose mode:")
    print("1. Console mode (print prices to terminal)")
    print("2. WebSocket server mode (broadcast to clients)")
    mode = input("Enter 1 or 2: ").strip()

    if mode == "1":
        run_console_mode()
    else:
        server = StockWebSocketServer(interval=60)
        try:
            asyncio.run(server.start())
        except KeyboardInterrupt:
            print("\nShutting down WebSocket server...")
            server.running = False
