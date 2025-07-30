# Portfolio Manager - Full Stack Application

A modern portfolio management application built with Flask (backend) and React TypeScript (frontend).

## 🏗️ Architecture

```
portfolio_manager_team17/
├── backend/              # Flask REST API
│   ├── app.py           # Main API server
│   └── requirements.txt # Python dependencies
├── frontend/            # React TypeScript app
│   ├── src/             # Source code
│   ├── package.json     # Node dependencies
│   └── vite.config.ts   # Build configuration
├── Database/            # SQLite database
│   └── portfolio_manager.db
├── Documentation/       # Project documentation
└── start.sh            # Quick start script
```

## 🚀 Quick Start

### Option 1: Automated Start
```bash
./start.sh
```

### Option 2: Manual Start

**Backend (Terminal 1):**
```bash
cd backend
pip install -r requirements.txt
python app.py
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm install
npm start
```

## 📱 Access Points

- **Frontend Application**: http://localhost:3000
- **Backend API**: http://localhost:5001

## ✨ Features

### 📊 Dashboard
- Portfolio overview with interactive charts
- Net worth history visualization  
- Recent transactions summary
- Account balance tracking

### 💼 Portfolio Management
- View all portfolios with performance metrics
- Detailed portfolio breakdowns
- Holdings analysis with profit/loss
- Portfolio-specific transaction history

### 📈 Stock Trading
- Browse and search all available stocks
- Real-time stock details and holdings
- Buy/Sell functionality with validation
- Transaction history per stock

### 📋 Transaction History
- Complete transaction log
- Filter by buy/sell operations
- Search by symbol, company, or portfolio
- Transaction summaries and analytics

## 🛠️ Technology Stack

### Backend
- **Flask**: Web framework
- **SQLite**: Database
- **Flask-CORS**: Cross-origin resource sharing

### Frontend  
- **React 19**: UI library
- **TypeScript**: Type safety
- **Vite**: Modern build tool
- **React Router**: Client-side routing
- **React Bootstrap**: UI components
- **Recharts**: Data visualization
- **Axios**: API communication

## 🔌 API Endpoints

### Core Endpoints
- `GET /api/dashboard` - Dashboard overview
- `GET /api/portfolios` - All portfolios
- `GET /api/portfolios/{id}` - Portfolio details
- `GET /api/stocks` - All stocks
- `GET /api/stocks/{symbol}` - Stock details
- `POST /api/stocks/{symbol}/buy` - Buy stock
- `POST /api/stocks/{symbol}/sell` - Sell stock
- `GET /api/transactions` - Transaction history
- `GET /api/account/balance` - Account balance
- `GET /api/net-worth/history` - Net worth tracking

## 🔧 Development

### Backend Development
```bash
cd backend
# Install dependencies
pip install flask flask-cors

# Run development server
python app.py
```

### Frontend Development
```bash
cd frontend
# Install dependencies
npm install

# Start dev server (with hot reload)
npm start

# Build for production
npm run build
```

## 📦 Database

The application uses SQLite with the following tables:
- `portfolios` - Portfolio information
- `stocks` - Stock data and prices
- `holdings` - Portfolio holdings
- `transactions` - Buy/sell transactions
- `account_balance` - User account balance
- `net_worth_history` - Historical net worth tracking

## 🚢 Production Deployment

### Backend
- Use production WSGI server (Gunicorn/uWSGI)
- Set environment variables for configuration
- Consider PostgreSQL for production database

### Frontend
- Build with `npm run build`
- Serve static files with nginx/Apache
- Configure proper CORS origins

### Security
- Implement authentication/authorization
- Use HTTPS in production
- Add rate limiting
- Validate all inputs

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ using modern web technologies**
