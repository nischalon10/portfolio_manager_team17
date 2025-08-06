// Types for the Portfolio Manager API

export interface Portfolio {
  id: number;
  name: string;
  description: string;
  holdings_count: number;
  total_value: number;
  profit_loss: number;
  profit_loss_percentage: number;
}

export interface Stock {
  id: number;
  symbol: string;
  name: string;
  current_price: number;
  watchlist: boolean;
  total_shares_held: number;
  total_value_held: number;
  total_cost_basis?: number; // Total cost basis for P&L calculation
  profit_loss_percentage?: number; //P&L percentage for watchlist display
  daily_change_percentage?: number; // Daily market change percentage
  previous_close_price?: number; // Previous day's closing price
}

export interface Holding {
  id: number;
  symbol: string;
  name: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  current_value: number;
  profit_loss: number;
  portfolio_id?: number;
  portfolio_name?: string;
}

export interface Transaction {
  id?: number;
  type: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  quantity: number;
  price: number;
  timestamp: string;
  portfolio_name: string;
}

export interface PortfolioDetail {
  portfolio: {
    id: number;
    name: string;
    description: string;
  };
  holdings: Holding[];
  transactions: Transaction[];
}

export interface StockDetail {
  stock: {
    id: number;
    symbol: string;
    name: string;
    current_price: number;
    watchlist: boolean;
  };
  holdings: Holding[];
  transactions: Transaction[];
}

export interface DashboardData {
  portfolios: Portfolio[];
  total_value: number;
  total_profit_loss: number;
  profit_loss_percentage: number;
  total_cost_basis: number;
  account_balance: number;
  recent_transactions: Transaction[];
}

export interface NetWorthHistoryItem {
  date: string;
  timestamp: string;
  account_balance: number;
  portfolio_value: number;
  total_net_worth: number;
}

export interface TradeRequest {
  portfolio_id: number;
  quantity: number;
  price: number;
}

export interface TradeResponse {
  message: string;
  transaction: {
    symbol: string;
    quantity: number;
    price: number;
    total_cost?: number;
    total_proceeds?: number;
  };
}

export interface ApiError {
  error: string;
}
