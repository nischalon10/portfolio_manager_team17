import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner, InputGroup, FormControl, Button, Modal, Form, ButtonGroup } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import portfolioAPI from '../api';
import { Stock, Portfolio, TradeRequest } from '../types';

// Component for stock logo with fallback
const StockLogo: React.FC<{ symbol: string; name: string; size?: number }> = ({
  symbol,
  name,
  size = 32
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  // Multiple logo sources with fallbacks
  const logoSources = [
    `https://financialmodelingprep.com/image-stock/${symbol}.png`,
  ];

  function getCompanyDomain(symbol: string): string {
    // Map common symbols to their domain names
    const domainMap: { [key: string]: string } = {
      'AAPL': 'apple',
      'GOOGL': 'google',
      'MSFT': 'microsoft',
      'AMZN': 'amazon',
      'TSLA': 'tesla',
      'META': 'meta',
      'NVDA': 'nvidia',
      'NFLX': 'netflix',
      'DIS': 'disney',
      'INTC': 'intel',
      'UNH': 'unitedhealthgroup',
      'V': 'visa',
      'AMD': 'amd'
    };
    return domainMap[symbol] || symbol.toLowerCase();
  }

  useEffect(() => {
    // Check if we have a custom logo URL for this symbol
    const customLogos: { [key: string]: string } = {
      'INTC': 'https://logos-world.net/wp-content/uploads/2021/09/Intel-Logo.png',
      'DIS': 'https://www.citypng.com/public/uploads/preview/hd-the-walt-disney-blue-logo-transparent-png-701751694774911obalqyemvs.png',
      'AMZN': 'https://www.allaboutlean.com/wp-content/uploads/2019/10/Amazon-Logo.png',
      'UNH': 'https://i.pinimg.com/736x/be/1b/b5/be1bb5e50d33f4e6c7ef3bb8c178b8db.jpg',
      'V': 'https://www.edigitalagency.com.au/wp-content/uploads/new-visa-logo-white-font-blue-background-latest.png'
    };

    if (customLogos[symbol]) {
      // Use custom logo first, then fallback to regular sources
      const customLogoSources = [
        customLogos[symbol],
        ...logoSources
      ];
      setImgSrc(customLogoSources[0]);
    } else {
      setImgSrc(logoSources[0]);
    }

    setHasError(false);
    setCurrentSourceIndex(0);
  }, [symbol]);

  const handleImageError = () => {
    const nextIndex = currentSourceIndex + 1;
    if (nextIndex < logoSources.length) {
      setCurrentSourceIndex(nextIndex);
      setImgSrc(logoSources[nextIndex]);
    } else {
      setHasError(true);
    }
  };

  const getInitials = (companyName: string) => {
    return companyName
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  if (hasError) {
    // Fallback to initials in a circle with better contrast
    return (
      <div
        className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          minWidth: size,
          minHeight: size,
          background: 'linear-gradient(45deg, #007bff, #0056b3)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={`${symbol} logo`}
      width={size}
      height={size}
      onError={handleImageError}
      className="rounded"
      style={{
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    />
  );
}; 

const Stocks: React.FC = () => {
  const { isDarkMode } = useTheme();
  const { stockUpdates, isConnected, subscribeToStocks, error: wsError } = useWebSocket();
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [accountBalance, setAccountBalance] = useState<number>(0);
  
  // Track pulsing animations and previous prices
  const [pulsingStocks, setPulsingStocks] = useState<Set<string>>(new Set());
  const [previousPrices, setPreviousPrices] = useState<{ [symbol: string]: number }>({});

  // Quick trade modal state
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);

  const [tradeForm, setTradeForm] = useState({
    portfolio_id: '',
    amount: '',
    shares: '',
    inputType: 'shares' as 'amount' | 'shares'
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [stocksData, portfoliosData, balanceData] = await Promise.all([
          portfolioAPI.getStocks(),
          portfolioAPI.getPortfolios(),
          portfolioAPI.getAccountBalance()
        ]);
        setStocks(stocksData);
        setFilteredStocks(stocksData);
        setPortfolios(portfoliosData);
        setAccountBalance(balanceData.balance);

        // Check if there's a search parameter from navigation
        const urlSearchTerm = searchParams.get('search');
        if (urlSearchTerm) {
          setSearchTerm(urlSearchTerm);
          // Clear the URL parameter after setting it
          setSearchParams({});
        }
      } catch (err) {
        setError('Failed to fetch data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams, setSearchParams]);

  // Subscribe to WebSocket updates for all stocks
  useEffect(() => {
    if (stocks.length > 0) {
      const symbols = stocks.map(stock => stock.symbol);
      subscribeToStocks(symbols);
    }
  }, [stocks, subscribeToStocks]);

  // Update stock prices from WebSocket data
  useEffect(() => {
    if (Object.keys(stockUpdates).length > 0) {
      setStocks(prevStocks => 
        prevStocks.map(stock => {
          const update = stockUpdates[stock.symbol];
          if (update) {
            // Check if price changed to trigger pulse animation
            const prevPrice = previousPrices[stock.symbol];
            if (prevPrice !== undefined && prevPrice !== update.price) {
              // Trigger pulse animation
              setPulsingStocks(prev => new Set(prev).add(stock.symbol));
              
              // Remove pulse class after animation duration
              setTimeout(() => {
                setPulsingStocks(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(stock.symbol);
                  return newSet;
                });
              }, 600);
            }
            
            // Update previous price
            setPreviousPrices(prev => ({
              ...prev,
              [stock.symbol]: update.price
            }));
            
            return {
              ...stock,
              current_price: update.price,
              change_percent: update.change_percent
            };
          }
          return stock;
        })
      );
    }
  }, [stockUpdates, previousPrices]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStocks(stocks);
      return;
    }

    const query = searchTerm.toLowerCase();

    // Categorize matches with priority (same logic as Navigation component)
    const symbolStartsWithMatches = stocks.filter(stock =>
      stock.symbol.toLowerCase().startsWith(query)
    ).sort((a, b) => a.symbol.localeCompare(b.symbol));

    const nameStartsWithMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      stock.name.toLowerCase().startsWith(query)
    ).sort((a, b) => a.name.localeCompare(b.name));

    const symbolContainsMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      !stock.name.toLowerCase().startsWith(query) &&
      stock.symbol.toLowerCase().includes(query)
    ).sort((a, b) => a.symbol.localeCompare(b.symbol));

    const nameContainsMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      !stock.name.toLowerCase().startsWith(query) &&
      !stock.symbol.toLowerCase().includes(query) &&
      stock.name.toLowerCase().includes(query)
    ).sort((a, b) => a.name.localeCompare(b.name));

    // Combine results in priority order
    const filtered = [
      ...symbolStartsWithMatches,
      ...nameStartsWithMatches,
      ...symbolContainsMatches,
      ...nameContainsMatches
    ];

    setFilteredStocks(filtered);
  }, [searchTerm, stocks]);

  const openTradeModal = (stock: Stock, type: 'BUY' | 'SELL') => {
    setSelectedStock(stock);
    setTradeType(type);
    setShowTradeModal(true);
    setTradeError(null);
    setTradeSuccess(null);
    setTradeForm({
      portfolio_id: '',
      amount: '',
      shares: '',
      inputType: 'shares'
    });
  };

  const closeTradeModal = () => {
    setShowTradeModal(false);
    setSelectedStock(null);
    setTradeError(null);
    setTradeSuccess(null);
  };

  const handleTrade = async () => {
    if (!selectedStock || !tradeForm.portfolio_id) {
      setTradeError('Please fill in all required fields');
      return;
    }

    const currentPrice = selectedStock.current_price;
    let quantity = 0;
    let totalAmount = 0;

    // Calculate quantity and amount based on input type
    if (tradeForm.inputType === 'shares') {
      if (!tradeForm.shares) {
        setTradeError('Please enter number of shares');
        return;
      }
      quantity = parseInt(tradeForm.shares);
      totalAmount = quantity * currentPrice;

      if (quantity <= 0) {
        setTradeError('Number of shares must be greater than 0');
        return;
      }
    } else {
      if (!tradeForm.amount) {
        setTradeError('Please enter an amount');
        return;
      }
      totalAmount = parseFloat(tradeForm.amount);
      quantity = Math.floor(totalAmount / currentPrice);

      if (quantity <= 0) {
        setTradeError('Amount must be sufficient to buy at least 1 share');
        return;
      }
    }

    try {
      setTradeLoading(true);
      setTradeError(null);

      const tradeData: TradeRequest = {
        portfolio_id: parseInt(tradeForm.portfolio_id),
        quantity: quantity,
        price: currentPrice
      };

      let response;
      if (tradeType === 'BUY') {
        response = await portfolioAPI.buyStock(selectedStock.symbol, tradeData);
      } else {
        response = await portfolioAPI.sellStock(selectedStock.symbol, tradeData);
      }

      setTradeSuccess(response.message);

      // Refresh stocks and account balance
      const [updatedStocks, balanceData] = await Promise.all([
        portfolioAPI.getStocks(),
        portfolioAPI.getAccountBalance()
      ]);
      setStocks(updatedStocks);
      setFilteredStocks(updatedStocks.filter(stock =>
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
      setAccountBalance(balanceData.balance);

      // Reset form
      setTradeForm({
        portfolio_id: '',
        amount: '',
        shares: '',
        inputType: 'shares'
      });

      // Close modal after a delay
      setTimeout(() => {
        closeTradeModal();
      }, 2000);
    } catch (err: any) {
      setTradeError(err.response?.data?.error || `Failed to ${tradeType.toLowerCase()} stock`);
    } finally {
      setTradeLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return <Alert variant="danger">{error}</Alert>;
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div>
      {/* Header Section */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📈 All Stocks ({filteredStocks.length})</h2>
        
        {/* WebSocket Status Indicator */}
        <div className="d-flex align-items-center">
          {wsError && (
              <span className="m-2" title={wsError}>
                ❌ Connection Error
              </span>
          )}
          <span 
            className={`badge ${isConnected ? 'bg-success' : 'bg-warning'} me-2`}
            title={isConnected ? 'Connected to live data' : 'Connecting to live data...'}
          >
            {isConnected ? (
              <div className='p-2'>🟢 Live Data</div>
            ) : (
              <div className='p-2'>🟡 Connecting...</div>
            )}
          </span>
        </div>
      </div>

      {/* Stocks Content */}
      <div>
          {filteredStocks.length === 0 ? (
            <Alert variant="info">
              {searchTerm ? 'No stocks found matching your search.' : 'No stocks available.'}
            </Alert>
          ) : (
            <div 
              className="border-0 rounded-3 shadow-lg overflow-hidden"
              style={{
                backdropFilter: 'blur(20px)',
                backgroundColor: isDarkMode ? 'rgba(33,37,41,0.95)' : 'rgba(255,255,255,0.95)',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)'
              }}
            >
              <Table hover responsive className="mb-0">
                <thead style={{ 
                  borderBottom: '1px solid ' + (isDarkMode ? 'rgba(35, 34, 34, 0.3)' : 'rgba(0,0,0,0.2)')
                }}>
                  <tr className="text-center">
                    <th className={`border-0 py-3 px-4 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}></th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Symbol</th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Name</th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Current Price</th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Shares Held</th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Value Held</th>
                    <th className={`border-0 py-3 ${isDarkMode ? 'stocks-table-header-dark' : 'stocks-table-header-light'}`}>Actions</th>       
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map(stock => (
                    <tr key={stock.symbol}>
                      <td className="align-middle px-4">
                        <StockLogo symbol={stock.symbol} name={stock.name} size={32} />
                      </td>
                      <td className="align-middle fw-bold">
                        <Link 
                          to={`/stock/${stock.symbol}`} 
                          className="text-decoration-none"
                        >
                          {stock.symbol}
                        </Link>
                      </td>
                      <td className="align-middle">{stock.name}</td>
                      <td className="align-middle">
                        <div className="stock-price-container d-flex justify-content-between align-items-center">
                          <span 
                            className={`stock-price ${pulsingStocks.has(stock.symbol) ? 'pulse' : ''}`}
                          >
                            {formatCurrency(stock.current_price)}
                          </span>
                          {stockUpdates[stock.symbol] && (
                            <span 
                              className={`stock-change text-end ${
                                stockUpdates[stock.symbol].change_percent > 0 
                                  ? 'text-success' 
                                  : stockUpdates[stock.symbol].change_percent < 0 
                                    ? 'text-danger' 
                                    : 'text-muted'
                              }`}
                            >
                              {stockUpdates[stock.symbol].change_percent.toFixed(2)}%
                              {stockUpdates[stock.symbol].change_percent > 0 ? ' ↑ ' : stockUpdates[stock.symbol].change_percent < 0 ? ' ↓ ' : ' = '}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="align-middle text-end">{stock.total_shares_held || 0}</td>
                      <td 
                        className="align-middle fw-bold text-end" 
                        style={{ 
                          color: (stock.total_shares_held && stock.total_shares_held > 0) ? '#198754' : 'inherit' 
                        }}
                      >
                        {formatCurrency((stock.total_shares_held || 0) * stock.current_price)}
                      </td>
                      <td className="align-middle text-center">
                        <Button
                          variant="success"
                          size="sm"
                          className="me-2"
                          onClick={() => openTradeModal(stock, 'BUY')}
                        >
                          Buy
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={!stock.total_shares_held || stock.total_shares_held <= 0}
                          onClick={() => openTradeModal(stock, 'SELL')}
                        >
                          Sell
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
            </Table>
          </div>
        )}
      </div>

      {/* Quick Trade Modal */}
      <Modal show={showTradeModal} onHide={closeTradeModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {tradeType} {selectedStock?.symbol} - {selectedStock?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {tradeSuccess && (
            <Alert variant="success" className="mb-3">
              {tradeSuccess}
            </Alert>
          )}
          {tradeError && (
            <Alert variant="danger" className="mb-3">
              {tradeError}
            </Alert>
          )}

          {selectedStock && (
            <div>
              {/* Stock Info */}
              <Row className="mb-3">
                <Col>
                  <div className="d-flex align-items-center p-3 border rounded bg-light">
                    <StockLogo symbol={selectedStock.symbol} name={selectedStock.name} size={40} />
                    <div className="flex-grow-1">
                      <h6 className="mb-0">{selectedStock.symbol}</h6>
                      <small className="text-muted">{selectedStock.name}</small>
                    </div>
                    <div className="text-end">
                      <h5 className="mb-0">{formatCurrency(selectedStock.current_price)}</h5>
                      <small className="text-muted">Current Price</small>
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Account Balance */}
              <Row className="mb-3">
                <Col>
                  <Alert variant="info">
                    <strong>Available Balance:</strong> {formatCurrency(accountBalance)}
                    {tradeType === 'SELL' && selectedStock.total_shares_held > 0 && (
                      <span className="ms-3">
                        <strong>Shares Held:</strong> {selectedStock.total_shares_held}
                      </span>
                    )}
                  </Alert>
                </Col>
              </Row>

              {/* Input Type Toggle */}
              <Row className="mb-3">
                <Col>
                  <Form.Label>Input Type</Form.Label>
                  <ButtonGroup className="w-100">
                    <Button
                      variant={tradeForm.inputType === 'shares' ? 'primary' : 'outline-primary'}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'shares' })}
                    >
                      Number of Shares
                    </Button>
                    <Button
                      variant={tradeForm.inputType === 'amount' ? 'primary' : 'outline-primary'}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'amount' })}
                    >
                      Dollar Amount
                    </Button>
                  </ButtonGroup>
                </Col>
              </Row>

              {/* Trade Form */}
              <Row className="mb-3">
                <Col md={6}>
                  {tradeForm.inputType === 'shares' ? (
                    <Form.Group>
                      <Form.Label>Number of Shares</Form.Label>
                      <Form.Control
                        type="number"
                        value={tradeForm.shares}
                        onChange={(e) => setTradeForm({ ...tradeForm, shares: e.target.value })}
                        placeholder="Enter number of shares"
                        min="1"
                      />
                    </Form.Group>
                  ) : (
                    <Form.Group>
                      <Form.Label>Amount ($)</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.01"
                        value={tradeForm.amount}
                        onChange={(e) => setTradeForm({ ...tradeForm, amount: e.target.value })}
                        placeholder="Enter dollar amount"
                        min="0"
                      />
                    </Form.Group>
                  )}
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Portfolio</Form.Label>
                    <Form.Select
                      value={tradeForm.portfolio_id}
                      onChange={(e) => setTradeForm({ ...tradeForm, portfolio_id: e.target.value })}
                    >
                      <option value="">Select Portfolio</option>
                      {portfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>

              {/* Trade Summary */}
              {((tradeForm.inputType === 'shares' && tradeForm.shares) ||
                (tradeForm.inputType === 'amount' && tradeForm.amount)) && (
                  <Alert variant="light" className="mb-3">
                    <h6>Trade Summary:</h6>
                    {tradeForm.inputType === 'shares' ? (
                      <>
                        <div>Shares to {tradeType.toLowerCase()}: {tradeForm.shares}</div>
                        <div>Total {tradeType === 'BUY' ? 'cost' : 'proceeds'}: {formatCurrency(parseInt(tradeForm.shares) * selectedStock.current_price)}</div>
                      </>
                    ) : (
                      <>
                        <div>Estimated shares: {Math.floor(parseFloat(tradeForm.amount) / selectedStock.current_price)}</div>
                        <div>Total cost: {formatCurrency(Math.floor(parseFloat(tradeForm.amount) / selectedStock.current_price) * selectedStock.current_price)}</div>
                      </>
                    )}
                  </Alert>
                )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeTradeModal}>
            Cancel
          </Button>
          <Button
            variant={tradeType === 'BUY' ? 'success' : 'danger'}
            onClick={handleTrade}
            disabled={
              tradeLoading ||
              !tradeForm.portfolio_id ||
              (tradeForm.inputType === 'amount' && !tradeForm.amount) ||
              (tradeForm.inputType === 'shares' && !tradeForm.shares)
            }
          >
            {tradeLoading ? 'Processing...' : `${tradeType} ${selectedStock?.symbol || 'Stock'}`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Stocks;
