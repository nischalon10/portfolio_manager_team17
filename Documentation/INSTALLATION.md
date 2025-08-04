# Installation Guide - Portfolio Manager

This guide provides step-by-step instructions for setting up the Portfolio Manager application on your local development environment.

## Prerequisites

### Required Software
- **Python 3.8+** - [Download Python](https://python.org/downloads/)
- **Node.js 16+** - [Download Node.js](https://nodejs.org/)
- **MySQL 8.0+** - [Download MySQL](https://dev.mysql.com/downloads/)
- **Git** - [Download Git](https://git-scm.com/downloads)

### Verify Installation
```bash
python3 --version   # Should be 3.8+
node --version      # Should be 16+
npm --version       # Should be 8+
mysql --version     # Should be 8.0+
```

---

## Installation Steps

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/portfolio_manager_team17.git
cd portfolio_manager_team17
```

### 2. Set Up MySQL Database

#### Option A: Using MySQL Command Line
```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE portfolio_manager;

# Create user (optional, for better security)
CREATE USER 'portfolio_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON portfolio_manager.* TO 'portfolio_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Option B: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your MySQL server
3. Execute: `CREATE DATABASE portfolio_manager;`

### 3. Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your MySQL credentials
nano .env
```

Update the `.env` file:
```bash
MYSQL_HOST=localhost
MYSQL_USER=root  # or your MySQL username
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=portfolio_manager
MYSQL_PORT=3306
```

### 4. Set Up Python Environment
```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install Python dependencies
pip install -r backend/requirements.txt
```

### 5. Initialize Database
```bash
# Run database setup script
cd database
python create_database.py
cd ..
```

### 6. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

---

## Quick Start Options

### Option 1: Automated Start (Recommended)
```bash
# Make script executable (Unix/macOS)
chmod +x start.sh

# Run the startup script
./start.sh
```

### Option 2: Using Python Main Script
```bash
python main.py
```

### Option 3: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
source ../.venv/bin/activate  # if not already activated
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

---

## Verification

### Check Services
1. **Backend API**: Visit http://localhost:5001/api/dashboard
2. **Frontend App**: Visit http://localhost:3000
3. **Database**: Should show sample data in MySQL

### Test API Endpoints
```bash
# Test dashboard endpoint
curl http://localhost:5001/api/dashboard

# Test stocks endpoint
curl http://localhost:5001/api/stocks
```

---

## Common Issues & Solutions

### MySQL Connection Issues
**Problem**: `pymysql.err.OperationalError: (2003, "Can't connect to MySQL server")`

**Solutions:**
1. Ensure MySQL is running:
   ```bash
   # macOS with Homebrew
   brew services start mysql
   
   # Ubuntu/Debian
   sudo systemctl start mysql
   
   # Windows
   net start mysql
   ```

2. Check MySQL credentials in `.env` file
3. Verify database exists: `mysql -u root -p -e "SHOW DATABASES;"`

### Python Dependencies Issues
**Problem**: Package installation errors

**Solutions:**
1. Upgrade pip: `pip install --upgrade pip`
2. Use virtual environment: `python -m venv .venv && source .venv/bin/activate`
3. Install one by one if bulk install fails

### Node.js Issues
**Problem**: `npm install` fails

**Solutions:**
1. Clear npm cache: `npm cache clean --force`
2. Delete `node_modules` and `package-lock.json`, then retry
3. Use different Node.js version (try LTS version)

### Port Already in Use
**Problem**: `EADDRINUSE` error

**Solutions:**
```bash
# Find processes using ports
lsof -i :3000  # Frontend port
lsof -i :5001  # Backend port

# Kill processes
kill -9 <PID>
```

### Database Permission Issues
**Problem**: Access denied for user

**Solutions:**
1. Check MySQL user privileges
2. Reset MySQL password
3. Use root user temporarily for development

---

## Development Setup

### Code Editor Setup
**Recommended: Visual Studio Code**
- Install Python extension
- Install TypeScript extension
- Install MySQL extension for database management

### Debugging
- Backend: Use Python debugger in VS Code
- Frontend: Use browser developer tools
- Database: Use MySQL Workbench or command line

### Hot Reload
- Backend: Install `flask-dev` for auto-reload
- Frontend: Vite provides hot reload by default

---

## Production Deployment Notes

### Environment Variables
Set production values for:
- Database credentials
- Secret keys
- Debug mode (set to False)
- CORS origins

### Database
- Use PostgreSQL instead of MySQL for better performance
- Set up database connection pooling
- Enable SSL connections

### Security
- Enable authentication/authorization
- Use HTTPS
- Set up rate limiting
- Validate all inputs
- Use environment-specific configurations

---

## Next Steps

1. Read the [API Documentation](API.md)
2. Check out the [Frontend Components](../frontend/src/components/)
3. Review the [Database Schema](dbdiagram.txt)
4. Start building your portfolios!

## Support

If you encounter issues:
1. Check this installation guide
2. Review error logs in terminal
3. Check database connection
4. Ensure all services are running

For additional help, create an issue in the repository.
