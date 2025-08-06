import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import { ThemeProvider } from './contexts/ThemeContext';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Portfolios from './components/Portfolios';
import PortfolioDetail from './components/PortfolioDetail';
import Stocks from './components/Stocks';
import StockDetail from './components/StockDetail';
import Transactions from './components/Transactions';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="App">
          <Navigation />
          <Container className="mt-4">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="/portfolio/:id" element={<PortfolioDetail />} />
              <Route path="/stocks" element={<Stocks />} />
              <Route path="/stock/:symbol" element={<StockDetail />} />
              <Route path="/transactions" element={<Transactions />} />
            </Routes>
          </Container>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
