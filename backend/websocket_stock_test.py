#!/usr/bin/env python3
"""
WebSocket-based real-time stock price fetcher
Test implementation for AAPL, MSFT, GOOGL
"""

import asyncio
import websockets
import json
import yfinance as yf
from datetime import datetime
import threading
import time

class RealTimeStockFetcher:
    def __init__(self):
        self.symbols = ['AAPL', 'MSFT', 'GOOGL']
        self.prices = {}
        self.clients = set()
        self.running = True
        
    async def register_client(self, websocket):
        """Register a new WebSocket client"""
        self.clients.add(websocket)
        print(f"Client connected. Total clients: {len(self.clients)}")
        
        # Send current prices to new client
        if self.prices:
            await websocket.send(json.dumps({
                'type': 'initial_prices',
                'data': self.prices,
                'timestamp': datetime.now().isoformat()
            }))
    
    async def unregister_client(self, websocket):
        """Unregister a WebSocket client"""
        self.clients.discard(websocket)
        print(f"Client disconnected. Total clients: {len(self.clients)}")
    
    async def broadcast_prices(self, prices):
        """Broadcast price updates to all connected clients"""
        if not self.clients:
            return
            
        message = json.dumps({
            'type': 'price_update',
            'data': prices,
            'timestamp': datetime.now().isoformat()
        })
        
        # Send to all clients
        disconnected_clients = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        for client in disconnected_clients:
            self.clients.discard(client)
    
    def fetch_stock_prices(self):
        """Fetch current stock prices using yfinance"""
        prices = {}
        for symbol in self.symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                price = info.get('regularMarketPrice') or info.get('currentPrice')
                
                if price:
                    prices[symbol] = {
                        'price': round(price, 2),
                        'currency': info.get('currency', 'USD'),
                        'name': info.get('shortName', symbol)
                    }
                    print(f"{symbol}: ${price:.2f} ({info.get('shortName', symbol)})")
                else:
                    print(f"Could not fetch price for {symbol}")
                    
            except Exception as e:
                print(f"Error fetching {symbol}: {e}")
        
        return prices
    
    async def price_updater(self):
        """Background task to fetch and broadcast price updates"""
        while self.running:
            try:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Fetching stock prices...")
                prices = self.fetch_stock_prices()
                
                if prices:
                    self.prices.update(prices)
                    await self.broadcast_prices(prices)
                
                # Wait 10 seconds before next update (for testing)
                await asyncio.sleep(10)
                
            except Exception as e:
                print(f"Error in price updater: {e}")
                await asyncio.sleep(5)
    
    async def handle_client(self, websocket, path):
        """Handle individual WebSocket client connections"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    
                    if data.get('type') == 'subscribe':
                        # Client wants to subscribe to specific symbols
                        requested_symbols = data.get('symbols', self.symbols)
                        print(f"Client subscribed to: {requested_symbols}")
                        
                    elif data.get('type') == 'get_current_prices':
                        # Client wants current prices immediately
                        current_prices = self.fetch_stock_prices()
                        await websocket.send(json.dumps({
                            'type': 'current_prices',
                            'data': current_prices,
                            'timestamp': datetime.now().isoformat()
                        }))
                        
                except json.JSONDecodeError:
                    await websocket.send(json.dumps({
                        'type': 'error',
                        'message': 'Invalid JSON format'
                    }))
                    
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.unregister_client(websocket)
    
    async def start_server(self, host='localhost', port=8765):
        """Start the WebSocket server"""
        print(f"Starting WebSocket server on ws://{host}:{port}")
        print(f"Tracking stocks: {', '.join(self.symbols)}")
        print("Press Ctrl+C to stop\n")
        
        # Start the price updater task
        asyncio.create_task(self.price_updater())
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, host, port):
            await asyncio.Future()  # Run forever

def run_console_mode():
    """Run in console mode without WebSocket server"""
    fetcher = RealTimeStockFetcher()
    
    print("Real-Time Stock Price Monitor (Console Mode)")
    print("=" * 50)
    print(f"Tracking: {', '.join(fetcher.symbols)}")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Fetching prices...")
            prices = fetcher.fetch_stock_prices()
            time.sleep(10)  # Update every 10 seconds
            
    except KeyboardInterrupt:
        print("\nStopping price monitor...")

async def run_websocket_mode():
    """Run WebSocket server mode"""
    fetcher = RealTimeStockFetcher()
    try:
        await fetcher.start_server()
    except KeyboardInterrupt:
        print("\nShutting down WebSocket server...")
        fetcher.running = False

if __name__ == "__main__":
    print("Real-Time Stock Price Fetcher")
    print("=" * 40)
    print("1. Console Mode (print prices to terminal)")
    print("2. WebSocket Server Mode (for web clients)")
    
    choice = input("\nChoose mode (1 or 2): ").strip()
    
    if choice == "1":
        run_console_mode()
    elif choice == "2":
        try:
            asyncio.run(run_websocket_mode())
        except KeyboardInterrupt:
            print("\nGoodbye!")
    else:
        print("Invalid choice. Running console mode...")
        run_console_mode()
