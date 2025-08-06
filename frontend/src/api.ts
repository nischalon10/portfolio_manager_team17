import axios from 'axios';
import {
  Portfolio,
  Stock,
  PortfolioDetail,
  StockDetail,
  DashboardData,
  Transaction,
  NetWorthHistoryItem,
  TradeRequest,
  TradeResponse
} from './types';

const API_BASE_URL = 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const portfolioAPI = {
  // Portfolio endpoints
  getPortfolios: async (): Promise<Portfolio[]> => {
    const response = await api.get('/portfolios');
    return response.data;
  },

  getPortfolioDetail: async (portfolioId: number): Promise<PortfolioDetail> => {
    const response = await api.get(`/portfolios/${portfolioId}`);
    return response.data;
  },

  createPortfolio: async (portfolioData: { name: string; description?: string }): Promise<{ message: string; portfolio: { id: number; name: string; description: string } }> => {
    const response = await api.post('/portfolios', portfolioData);
    return response.data;
  },

  deletePortfolio: async (portfolioId: number): Promise<{ message: string }> => {
    const response = await api.delete(`/portfolios/${portfolioId}`);
    return response.data;
  },

  getPortfolioValue: async (portfolioId: number): Promise<{ value: number }> => {
    const response = await api.get(`/portfolio/${portfolioId}/value`);
    return response.data;
  },

  // Stock endpoints
  getStocks: async (): Promise<Stock[]> => {
    const response = await api.get('/stocks');
    return response.data;
  },

  getStockDetail: async (symbol: string): Promise<StockDetail> => {
    const response = await api.get(`/stocks/${symbol}`);
    return response.data;
  },

  getStockPrices: async (): Promise<Record<string, number>> => {
    const response = await api.get('/stocks/prices');
    return response.data;
  },

  // Trading endpoints
  buyStock: async (symbol: string, tradeData: TradeRequest): Promise<TradeResponse> => {
    const response = await api.post(`/stocks/${symbol}/buy`, tradeData);
    return response.data;
  },

  sellStock: async (symbol: string, tradeData: TradeRequest): Promise<TradeResponse> => {
    const response = await api.post(`/stocks/${symbol}/sell`, tradeData);
    return response.data;
  },

  // Transaction endpoints
  getTransactions: async (): Promise<Transaction[]> => {
    const response = await api.get('/transactions');
    return response.data;
  },

  // Dashboard endpoint
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get('/dashboard');
    return response.data;
  },

  // Account endpoints
  getAccountBalance: async (): Promise<{ balance: number }> => {
    const response = await api.get('/account/balance');
    return response.data;
  },

  // Net worth history
  getNetWorthHistory: async (limit: number = 50): Promise<NetWorthHistoryItem[]> => {
    const response = await api.get(`/net-worth/history?limit=${limit}`);
    return response.data;
  },

  // Watchlist endpoints
  getWatchlist: async (): Promise<Stock[]> => {
    const response = await api.get('/watchlist');
    return response.data;
  },

  addToWatchlist: async (symbol: string): Promise<{ message: string }> => {
    const response = await api.post(`/stocks/${symbol}/watchlist`);
    return response.data;
  },

  removeFromWatchlist: async (symbol: string): Promise<{ message: string }> => {
    const response = await api.delete(`/stocks/${symbol}/watchlist`);
    return response.data;
  },
};

export default portfolioAPI;
