import sqlite3
import yfinance as yf
import pandas as pd
import time
import threading

DB_PATH = '../Database/portfolio_manager.db'


def get_sp500_symbols():
    """Fetch S&P 500 stock symbols from Wikipedia using pandas."""
    url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
    tables = pd.read_html(url)
    df = tables[0]
    return df['Symbol'].tolist()


def import_sp500():
    """Import S&P 500 companies into the stocks table."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()

    symbols = get_sp500_symbols()
    for symbol in symbols:
        try:
            stock = yf.Ticker(symbol)
            name = stock.info.get('shortName') or stock.info.get(
                'longName') or symbol
            price = stock.info.get('regularMarketPrice') or 100.0
            cursor.execute(
                'INSERT OR IGNORE INTO stocks (symbol, name, current_price) VALUES (?, ?, ?)',
                (symbol, name, price)
            )
            print(f"Added {symbol}: {name}")
        except Exception as e:
            print(f"Error adding {symbol}: {e}")

    conn.commit()
    conn.close()
    print("Imported S&P 500 companies into stocks table.")


def get_and_update_stock_prices():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('PRAGMA journal_mode=WAL;')
    cursor = conn.cursor()

    cursor.execute('SELECT symbol FROM stocks')
    symbols = [row[0] for row in cursor.fetchall()]

    if not symbols:
        print("No stock symbols found in the database.")
        conn.close()
        return

    # print(f"Updating prices for: {', '.join(symbols)}")

    for symbol in symbols:
        try:
            stock = yf.Ticker(symbol)
            price = stock.info.get('regularMarketPrice')
            if price is not None:
                cursor.execute(
                    'UPDATE stocks SET current_price = ? WHERE symbol = ?',
                    (price, symbol)
                )
                # print(f"Updated {symbol}: ${price}")
            else:
                print(f"Could not fetch price for {symbol}")
        except Exception as e:
            print(f"Error updating {symbol},{price}: {e}")

    conn.commit()
    conn.close()
    print("Stock prices updated for all stocks.\n")


def start_stock_updater():
    def updater_loop():
        while True:
            get_and_update_stock_prices()
            print("Waiting 15 minutes for next update...")
            time.sleep(60)
    thread = threading.Thread(target=updater_loop, daemon=True)
    thread.start()


if __name__ == "__main__":
    while True:
        # start_stock_updater()
        # fetch_and_update_stock_prices()
        print("Waiting 15 minutes for next update...")
        time.sleep(60)
