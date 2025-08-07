import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface StockUpdate {
  symbol: string;
  price: number;
  change_percent: number;
  volume: number;
  market_hours: number;
  status: string;
  timestamp: string;
}

interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  stockUpdates: { [symbol: string]: StockUpdate };
  subscribeToStocks: (symbols: string[]) => void;
  error: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

interface WebSocketProviderProps {
  children: React.ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stockUpdates, setStockUpdates] = useState<{ [symbol: string]: StockUpdate }>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:5001', {
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server');
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setError('Failed to connect to real-time data service');
      setIsConnected(false);
    });

    // Stock update handler
    newSocket.on('stock_update', (data: StockUpdate) => {
      console.log('Received stock update:', data);
      setStockUpdates(prev => ({
        ...prev,
        [data.symbol]: data
      }));
    });

    // Status message handler
    newSocket.on('status', (data: { message: string }) => {
      console.log('Status:', data.message);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const subscribeToStocks = useCallback((symbols: string[]) => {
    if (socket && isConnected) {
      socket.emit('subscribe_stocks', { symbols });
      console.log('Subscribed to stocks:', symbols);
    }
  }, [socket, isConnected]);

  const value: WebSocketContextType = {
    socket,
    isConnected,
    stockUpdates,
    subscribeToStocks,
    error,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
