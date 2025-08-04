# Portfolio Manager - Full Stack Application

A comprehensive portfolio management application built with Flask (Python backend) and React TypeScript (frontend), featuring real-time stock tracking, portfolio analytics, and transaction management.

## 🏗️ Project Architecture

```
portfolio_manager_team17/
├── backend/                    # Flask REST API
│   ├── app.py                 # Main application server
│   ├── live_stock_tracker.py  # Real-time stock price updates
│   └── requirements.txt       # Python dependencies
├── frontend/                  # React TypeScript SPA
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── api.ts            # API client
│   │   ├── types.ts          # TypeScript interfaces
│   │   └── App.tsx           # Main app component
│   ├── package.json          # Node.js dependencies
│   ├── tsconfig.json         # TypeScript configuration
│   └── vite.config.ts        # Vite build configuration
├── database/                  # Database setup and management
│   └── create_database.py    # Database initialization script
├── Documentation/             # Project documentation
│   ├── API.md               # Complete API documentation
│   ├── INSTALLATION.md      # Detailed setup guide
│   ├── dbdiagram.txt        # Database schema diagram
│   └── *.png               # Screenshots and diagrams
├── .env.example             # Environment variables template
├── main.py                  # Alternative startup script
├── start.sh                 # Automated startup script
└── README.md               # This file
```

## 🚀 Quick Start

### Prerequisites
- **Python 3.8+** with pip
- **Node.js 16+** with npm
- **MySQL 8.0+** server
- **Git** for version control

### 🎯 Option 1: One-Command Start (Recommended)
```bash
# Clone and navigate to project
git clone <repository-url>
cd portfolio_manager_team17

# Set up environment variables
cp .env.example .env
# Edit .env with your MySQL credentials

# Run automated setup and start
./start.sh
```

### 🐍 Option 2: Python Main Script
```bash
# After setting up .env file
python main.py
```

### ⚙️ Option 3: Manual Setup
```bash
# 1. Set up Python environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# 2. Install backend dependencies
cd backend
pip install -r requirements.txt
cd ..

# 3. Set up database
cd database
python create_database.py
cd ..

# 4. Install frontend dependencies
cd frontend
npm install
cd ..

# 5. Start backend (Terminal 1)
cd backend
python app.py

# 6. Start frontend (Terminal 2)
cd frontend
npm start
```

## 📱 Application Access

- **🌐 Frontend Application**: http://localhost:3000
- **🔧 Backend API**: http://localhost:5001
- **📊 API Documentation**: [Documentation/API.md](Documentation/API.md)

## ✨ Core Features

### � Dashboard
- **Portfolio Overview**: Real-time portfolio value and performance metrics
- **Net Worth Tracking**: Historical net worth visualization with interactive charts
- **Recent Activity**: Latest transactions and portfolio changes
- **Account Balance**: Current cash balance and buying power
- **Quick Stats**: Key performance indicators and summary metrics

### 💼 Portfolio Management
- **Multiple Portfolios**: Create and manage diverse investment portfolios
- **Portfolio Analytics**: Detailed performance analysis and profit/loss tracking
- **Holdings Breakdown**: Individual stock performance within portfolios
- **Allocation Analysis**: Portfolio composition and diversification metrics
- **Historical Performance**: Track portfolio value changes over time

### � Stock Trading & Analysis
- **Stock Browser**: Search and explore 25+ major stocks (S&P 500 selections)
- **Real-time Pricing**: Live stock price updates using Yahoo Finance API
- **Trading Interface**: Buy and sell stocks with portfolio allocation
- **Stock Details**: Comprehensive stock information and holding analysis
- **Watchlist**: Track favorite stocks for monitoring and analysis

### 📋 Transaction Management
- **Complete History**: Detailed transaction log with search and filtering
- **Transaction Types**: Buy/sell operations with full audit trail
- **Portfolio Tracking**: Transaction history per portfolio
- **Performance Analytics**: Transaction-based profit/loss analysis
- **Export Capabilities**: Transaction data export for external analysis

### 🎯 Advanced Features
- **Real-time Updates**: Live stock price tracking and portfolio updates
- **Responsive Design**: Optimized for desktop and mobile devices
- **Data Visualization**: Interactive charts using Recharts library
- **Search & Filter**: Advanced search across stocks, portfolios, and transactions
- **Error Handling**: Comprehensive error handling and user feedback

## 🛠️ Technology Stack

### Backend (Flask + MySQL)
- **Flask 2.3+**: Modern Python web framework
- **MySQL 8.0+**: Robust relational database
- **PyMySQL**: MySQL database connector
- **Flask-CORS**: Cross-origin resource sharing
- **yfinance**: Yahoo Finance API for real-time stock data
- **python-dotenv**: Environment variable management

### Frontend (React + TypeScript)
- **React 19**: Latest React with modern features
- **TypeScript 5.7+**: Type-safe JavaScript development
- **Vite 6**: Fast build tool and development server
- **React Router**: Client-side routing and navigation
- **React Bootstrap**: Responsive UI components
- **Recharts**: Data visualization and charting
- **Axios**: HTTP client for API communication
- **React Icons**: Comprehensive icon library

### Development Tools
- **VS Code**: Recommended development environment
- **Git**: Version control
- **npm/pip**: Package management
- **MySQL Workbench**: Database administration (optional)

## 🔌 API Endpoints Overview

### Core Data Access
```
GET  /api/dashboard              # Dashboard overview data
GET  /api/portfolios             # All portfolios list
GET  /api/portfolios/{id}        # Specific portfolio details
GET  /api/stocks                 # All stocks with search
GET  /api/stocks/{symbol}        # Individual stock details
GET  /api/transactions           # Transaction history with filters
```

### Trading Operations
```
POST /api/stocks/{symbol}/buy    # Purchase stocks
POST /api/stocks/{symbol}/sell   # Sell stocks
GET  /api/account/balance        # Current account balance
```

### Analytics & Tracking
```
GET  /api/net-worth/history      # Historical net worth data
GET  /api/portfolio/{id}/value   # Portfolio valuation
GET  /api/stocks/prices          # Current stock prices
```

### Watchlist Management
```
GET    /api/watchlist            # User's watchlist
POST   /api/stocks/{symbol}/watchlist   # Add to watchlist
DELETE /api/stocks/{symbol}/watchlist   # Remove from watchlist
```

📖 **Complete API Documentation**: [Documentation/API.md](Documentation/API.md)

## 🗄️ Database Schema

The application uses MySQL with the following core tables:

### Core Tables
- **`stocks`**: Stock information and current prices
- **`portfolios`**: User portfolio definitions
- **`holdings`**: Stock holdings per portfolio
- **`transactions`**: Buy/sell transaction history
- **`account_balance`**: User account balance tracking
- **`net_worth_history`**: Historical net worth snapshots

### Key Features
- **Foreign Key Constraints**: Data integrity and referential consistency
- **Indexes**: Optimized queries for performance
- **Triggers**: Automatic net worth tracking on transactions
- **Sample Data**: Pre-loaded with 25 major stocks for testing

📊 **Database Diagram**: [Documentation/dbdiagram.txt](Documentation/dbdiagram.txt)

## 🔧 Development Guide

### Backend Development
```bash
cd backend

# Install development dependencies
pip install flask flask-cors pymysql yfinance python-dotenv

# Run with auto-reload
export FLASK_ENV=development
python app.py

# The API will be available at http://localhost:5001
```

### Frontend Development
```bash
cd frontend

# Install dependencies
npm install

# Start development server with hot reload
npm start

# Build for production
npm run build

# Preview production build
npm run preview
```

### Database Management
```bash
cd database

# Initialize/reset database
python create_database.py

# This will:
# - Create all tables
# - Load sample stock data
# - Set up initial account balance
# - Display setup confirmation
```

## 📊 Sample Data

The application comes pre-configured with:
- **25 Major Stocks**: Including AAPL, MSFT, GOOGL, AMZN, TSLA, etc.
- **3 Sample Portfolios**: Growth, Value, and Dividend portfolios
- **$100,000 Initial Balance**: For testing trading functionality
- **Sample Transactions**: Example buy/sell operations

## 🚢 Production Deployment

### Environment Configuration
```bash
# Production environment variables
FLASK_ENV=production
FLASK_DEBUG=False
MYSQL_HOST=production-db-host
# ... other production configs
```

### Backend Deployment
- **WSGI Server**: Use Gunicorn or uWSGI for production
- **Database**: Consider PostgreSQL for better scalability
- **Security**: Implement authentication, HTTPS, rate limiting
- **Monitoring**: Add logging, metrics, and health checks

### Frontend Deployment
```bash
# Build optimized production bundle
npm run build

# Serve static files with nginx, Apache, or CDN
# Configure proper CORS origins for API access
```

### Security Considerations
- **Authentication**: Implement user accounts and JWT tokens
- **Authorization**: Role-based access control
- **Input Validation**: Sanitize all user inputs
- **HTTPS**: Use SSL/TLS in production
- **Rate Limiting**: Prevent API abuse
- **Environment Variables**: Secure credential management

## 📚 Documentation

- **📖 [Installation Guide](Documentation/INSTALLATION.md)**: Detailed setup instructions
- **🔌 [API Documentation](Documentation/API.md)**: Complete API reference
- **�️ [Database Schema](Documentation/dbdiagram.txt)**: Database structure diagram
- **🖼️ [Screenshots](Documentation/)**: Application screenshots and ERD

## 🐛 Troubleshooting

### Common Issues

**MySQL Connection Failed**
```bash
# Check if MySQL is running
sudo systemctl status mysql  # Linux
brew services list | grep mysql  # macOS

# Verify credentials in .env file
# Check if database exists: mysql -u root -p -e "SHOW DATABASES;"
```

**Port Already in Use**
```bash
# Find and kill processes using ports
lsof -i :3000  # Frontend
lsof -i :5001  # Backend
kill -9 <PID>
```

**Python Dependencies Issues**
```bash
# Upgrade pip and reinstall
pip install --upgrade pip
pip install -r backend/requirements.txt --force-reinstall
```

## 🤝 Contributing

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Make Changes**: Implement your feature or fix
4. **Test Thoroughly**: Ensure all functionality works
5. **Commit Changes**: `git commit -m 'Add amazing feature'`
6. **Push to Branch**: `git push origin feature/amazing-feature`
7. **Submit Pull Request**: Describe your changes

### Development Guidelines
- Follow PEP 8 for Python code
- Use TypeScript for type safety
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed

## 📄 License

MIT License - see LICENSE file for details

## 🏆 Acknowledgments

- **Yahoo Finance**: Real-time stock data API
- **React Bootstrap**: UI component library
- **Recharts**: Data visualization library
- **Flask**: Python web framework
- **MySQL**: Database management system

---

**Built with ❤️ using modern full-stack technologies**

*Portfolio Manager Team 17 - A comprehensive solution for investment portfolio management and tracking*
