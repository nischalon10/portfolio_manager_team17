# Portfolio Manager

A Python-based portfolio management system with SQLite database for tracking stocks, portfolios, holdings, and transactions.

## Setup

### Prerequisites
- Python 3.8 or higher
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd portfolio_manager_team17
```

2. Create and activate a virtual environment:
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Usage

1. **Create and populate the database:**
```bash
python create_database.py
```
This will create `portfolio_manager.db` with sample data including:
- 10 stocks with current market prices
- 10 different portfolio types
- Random holdings across portfolios
- 50 sample transactions

2. **Verify database structure and contents:**
```bash
python verify_database.py
```

### Database Schema

The database consists of four main tables:

- **stocks**: Stock information (symbol, name, current_price)
- **portfolios**: Portfolio definitions (name, description)
- **holdings**: Current positions (portfolio_id, stock_id, quantity, avg_buy_price)
- **transactions**: Transaction history (type, quantity, price, timestamp)

### Virtual Environment Management

**Activate the virtual environment:**
```bash
source venv/bin/activate  # macOS/Linux
venv\Scripts\activate     # Windows
```

**Deactivate the virtual environment:**
```bash
deactivate
```

**Update requirements.txt:**
```bash
pip freeze > requirements.txt
```

### Development

The project includes development tools in requirements.txt:
- `pytest` for testing
- `black` for code formatting
- `flake8` for linting

**Run code formatting:**
```bash
black *.py
```

**Run linting:**
```bash
flake8 *.py
```

### Files

- `create_database.py` - Creates SQLite database with sample data
- `verify_database.py` - Verifies database structure and shows statistics
- `requirements.txt` - Python dependencies
- `.gitignore` - Git ignore rules
- `portfolio_manager.db` - SQLite database (created by script)

### Database Relationships

```
portfolios 1:N holdings N:1 stocks
portfolios 1:N transactions N:1 stocks
```

Each portfolio can have multiple holdings of different stocks, and each stock can be held by multiple portfolios. Transactions track all buy/sell activities with timestamps.
