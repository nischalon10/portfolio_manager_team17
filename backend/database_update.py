import sqlite3
import yfinance as yf
import pandas as pd
import time
import threading
from datetime import datetime

DB_PATH = '../Database/portfolio_manager.db'


def get_sp500_symbols(n=30):
    """Fetch the first n S&P 500 stock symbols from Wikipedia using pandas."""
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    tables = pd.read_html(url)
    df = tables[0]
    return df['Symbol'].tolist()[:n]


def import_sp500(n=30):
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
    """Fetch and update prices for all stocks in the database."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()

    cursor.execute('SELECT symbol FROM stocks')
    symbols = [row[0] for row in cursor.fetchall()]

    if not symbols:
        print("No stock symbols found in the database.")
        conn.close()
        return

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
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Stock prices updated for all stocks.\n")


def start_stock_updater(interval=60):
    """Start a background thread to update stock prices every `interval` seconds."""
    def updater_loop():
        while True:
            fetch_and_update_stock_prices()
            print(f"Waiting {interval} seconds for next update...")
            time.sleep(interval)
    thread = threading.Thread(target=updater_loop, daemon=True)
    thread.start()


def keep_only_first_30_sp500():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()
    symbols = get_sp500_symbols(n=30)
    cursor.execute(
        "DELETE FROM stocks WHERE symbol NOT IN ({seq})".format(
            seq=','.join(['?']*len(symbols))
        ),
        symbols
    )
    conn.commit()
    conn.close()
    print("Database now contains only the first 30 S&P 500 stocks.")


if __name__ == "__main__":
    # Uncomment and run once to import the first 30 S&P 500 stocks
    # import_sp500(n=30)

    # Start the updater (every 60 seconds)
    # start_stock_updater(interval=60)
    # while True:
    # time.sleep(60)
    pass
