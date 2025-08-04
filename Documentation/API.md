# API Documentation - Portfolio Manager

This document provides detailed information about all API endpoints available in the Portfolio Manager backend.

## Base URL
```
http://localhost:5001/api
```

## Authentication
Currently, the API does not require authentication. All endpoints are publicly accessible.

## Response Format
All responses are in JSON format with appropriate HTTP status codes.

## Error Handling
Error responses follow this format:
```json
{
  "error": "Error message description"
}
```

---

## Endpoints

### Dashboard
Get overview data for the dashboard including portfolio summary and recent transactions.

**GET** `/dashboard`

**Response:**
```json
{
  "portfolio_summary": {
    "total_portfolios": 3,
    "total_stocks": 25,
    "total_value": 125000.50
  },
  "account_balance": 100000.00,
  "recent_transactions": [...]
}
```

---

### Portfolios

#### Get All Portfolios
**GET** `/portfolios`

**Response:**
```json
[
  {
    "id": 1,
    "name": "Growth Portfolio",
    "description": "Focus on growth stocks",
    "holdings_count": 5,
    "total_value": 50000.00
  }
]
```

#### Get Portfolio Details
**GET** `/portfolios/{id}`

**Parameters:**
- `id` (integer): Portfolio ID

**Response:**
```json
{
  "portfolio": {
    "id": 1,
    "name": "Growth Portfolio",
    "description": "Focus on growth stocks"
  },
  "holdings": [
    {
      "id": 1,
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "quantity": 100,
      "avg_buy_price": 150.00,
      "current_price": 175.00,
      "current_value": 17500.00,
      "profit_loss": 2500.00
    }
  ],
  "total_value": 50000.00,
  "total_cost": 45000.00,
  "total_profit_loss": 5000.00
}
```

---

### Stocks

#### Get All Stocks
**GET** `/stocks`

**Query Parameters:**
- `search` (optional): Search by symbol or company name

**Response:**
```json
[
  {
    "id": 1,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "current_price": 175.00,
    "watchlist": false,
    "total_shares_held": 100,
    "total_value_held": 17500.00
  }
]
```

#### Get Stock Details
**GET** `/stocks/{symbol}`

**Parameters:**
- `symbol` (string): Stock symbol (e.g., "AAPL")

**Response:**
```json
{
  "stock": {
    "id": 1,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "current_price": 175.00,
    "watchlist": false
  },
  "holdings": [
    {
      "portfolio_id": 1,
      "portfolio_name": "Growth Portfolio",
      "quantity": 100,
      "avg_buy_price": 150.00,
      "current_value": 17500.00,
      "profit_loss": 2500.00
    }
  ],
  "total_shares": 100,
  "total_value": 17500.00,
  "total_profit_loss": 2500.00
}
```

---

### Trading

#### Buy Stock
**POST** `/stocks/{symbol}/buy`

**Parameters:**
- `symbol` (string): Stock symbol

**Request Body:**
```json
{
  "quantity": 10,
  "portfolio_id": 1
}
```

**Response:**
```json
{
  "message": "Successfully bought 10 shares of AAPL",
  "transaction": {
    "type": "BUY",
    "symbol": "AAPL",
    "quantity": 10,
    "price": 175.00,
    "total_cost": 1750.00
  },
  "new_balance": 98250.00
}
```

#### Sell Stock
**POST** `/stocks/{symbol}/sell`

**Parameters:**
- `symbol` (string): Stock symbol

**Request Body:**
```json
{
  "quantity": 5,
  "portfolio_id": 1
}
```

**Response:**
```json
{
  "message": "Successfully sold 5 shares of AAPL",
  "transaction": {
    "type": "SELL",
    "symbol": "AAPL",
    "quantity": 5,
    "price": 175.00,
    "total_received": 875.00
  },
  "new_balance": 101125.00
}
```

---

### Transactions

#### Get Transaction History
**GET** `/transactions`

**Query Parameters:**
- `search` (optional): Search by symbol, company name, or portfolio
- `type` (optional): Filter by transaction type ("BUY" or "SELL")

**Response:**
```json
[
  {
    "id": 1,
    "type": "BUY",
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "quantity": 10,
    "price": 175.00,
    "timestamp": "2024-01-15T10:30:00",
    "portfolio_name": "Growth Portfolio"
  }
]
```

---

### Account

#### Get Account Balance
**GET** `/account/balance`

**Response:**
```json
{
  "balance": 100000.00,
  "last_updated": "2024-01-15T10:30:00"
}
```

---

### Net Worth

#### Get Net Worth History
**GET** `/net-worth/history`

**Response:**
```json
[
  {
    "date": "2024-01-15",
    "account_balance": 100000.00,
    "portfolio_value": 50000.00,
    "total_net_worth": 150000.00,
    "timestamp": "2024-01-15T10:30:00"
  }
]
```

---

### Watchlist

#### Get Watchlist
**GET** `/watchlist`

**Response:**
```json
[
  {
    "id": 1,
    "symbol": "AAPL",
    "name": "Apple Inc.",
    "current_price": 175.00
  }
]
```

#### Add to Watchlist
**POST** `/stocks/{symbol}/watchlist`

**Response:**
```json
{
  "message": "AAPL added to watchlist successfully"
}
```

#### Remove from Watchlist
**DELETE** `/stocks/{symbol}/watchlist`

**Response:**
```json
{
  "message": "AAPL removed from watchlist successfully"
}
```

---

### Utility Endpoints

#### Get Portfolio Value
**GET** `/portfolio/{id}/value`

**Response:**
```json
{
  "portfolio_id": 1,
  "total_value": 50000.00
}
```

#### Get Stock Prices
**GET** `/stocks/prices`

**Response:**
```json
{
  "AAPL": 175.00,
  "MSFT": 300.00,
  "GOOGL": 125.00
}
```

---

## Error Codes

- `400 Bad Request`: Invalid request data
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting
Currently, no rate limiting is implemented. For production deployment, consider implementing rate limiting to prevent abuse.
