# Portfolio Manager

Full-stack portfolio management application with Flask backend and React TypeScript frontend, featuring real-time stock tracking and portfolio analytics.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+, Node.js 16+, MySQL 8.0+

### Setup Options

**Option 1: Automated (Recommended)**
```bash
git clone <repository-url>
cd portfolio_manager_team17
cp .env.example .env  # Edit with MySQL credentials
./start.sh
```

**Option 2: Manual**
```bash
# 1. Backend setup
python3 -m venv .venv && source .venv/bin/activate
cd backend && pip install -r requirements.txt && cd ..

# 2. Database setup
cd database && python create_database.py && cd ..

# 3. Frontend setup
cd frontend && npm install && cd ..

# 4. Start services (separate terminals)
cd backend && python app.py  # Backend: http://localhost:5001
cd frontend && npm start     # Frontend: http://localhost:3000
```

## ✨ Features

### Core Functionality
- **Dashboard**: Real-time portfolio overview with interactive charts
- **Portfolio Management**: Multiple portfolios with performance tracking
- **Stock Trading**: Buy/sell interface with 25+ major stocks
- **Transaction History**: Complete audit trail with filtering
- **Watchlist**: Track favorite stocks
- **Real-time Updates**: Live stock prices via Yahoo Finance API

## 🛠️ Tech Stack

**Backend:** Flask 2.3+, MySQL 8.0+, PyMySQL, yfinance, SocketIO  
**Frontend:** React 19, TypeScript 5.7+, Vite 6, Bootstrap, Recharts  
**Database:** MySQL with optimized schema and triggers

## 🔌 API Endpoints

### Core Data
```
GET  /api/dashboard              # Dashboard data
GET  /api/portfolios             # All portfolios
GET  /api/portfolios/{id}        # Portfolio details
GET  /api/stocks                 # Stock list
GET  /api/stocks/{symbol}        # Stock details
GET  /api/transactions           # Transaction history
```

### Trading
```
POST /api/stocks/{symbol}/buy    # Buy stocks
POST /api/stocks/{symbol}/sell   # Sell stocks
GET  /api/account/balance        # Account balance
```

### Analytics
```
GET  /api/net-worth/history      # Net worth history
GET  /api/portfolio/{id}/value   # Portfolio value
GET  /api/stocks/prices          # Current prices
GET  /api/watchlist              # Watchlist
```

📖 **Full API docs**: [Documentation/API.md](Documentation/API.md)

## � Database Schema

Core tables: `stocks`, `portfolios`, `holdings`, `transactions`, `account_balance`, `net_worth_history`  
Features: Foreign keys, indexes, triggers, sample data (25 stocks, $100K balance)

## 🔧 Development

**Backend:**
```bash
cd backend
export FLASK_ENV=development
python app.py  # Auto-reload enabled
```

**Frontend:**
```bash
cd frontend
npm start  # Hot reload enabled
```

**Database:**
```bash
cd database
python create_database.py  # Reset/initialize
```

## � Troubleshooting

**MySQL Issues:** Check service status, verify .env credentials  
**Port Conflicts:** Use `lsof -i :3000` / `lsof -i :5001` to find/kill processes  
**Dependencies:** `pip install --upgrade pip && pip install -r requirements.txt --force-reinstall`

---

**MIT License** | Built with Flask + React + MySQL
