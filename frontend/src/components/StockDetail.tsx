import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Table, Alert, Spinner, Button, Modal, Form, Badge } from 'react-bootstrap';
import portfolioAPI from '../api';
import { StockDetail, Portfolio, TradeRequest } from '../types';

// Component for stock logo with fallback (same as Stocks.tsx)
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
        className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold me-3"
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
      className="rounded me-3"
      style={{
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    />
  );
};

const StockDetailComponent: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');

  const [tradeForm, setTradeForm] = useState({
    portfolio_id: '',
    amount: '',
    shares: '',
    selectedStock: symbol || '',
    inputType: 'amount' as 'amount' | 'shares'
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return;

      try {
        setLoading(true);
        const [stockData, portfolioData, balanceData] = await Promise.all([
          portfolioAPI.getStockDetail(symbol),
          portfolioAPI.getPortfolios(),
          portfolioAPI.getAccountBalance()
        ]);
        setStockDetail(stockData);
        setPortfolios(portfolioData);
        setAccountBalance(balanceData.balance);

        // Set initial stock selection in trade form
        setTradeForm(prev => ({
          ...prev,
          selectedStock: symbol
        }));
      } catch (err) {
        setError('Failed to fetch stock details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  const handleTrade = async () => {
    if (!symbol || !tradeForm.portfolio_id) {
      setTradeError('Please fill in all required fields');
      return;
    }

    if (!stockDetail) {
      setTradeError('Stock details not loaded');
      return;
    }

    const currentPrice = stockDetail.stock.current_price;
    let quantity = 0;
    let totalAmount = 0;

    // Calculate quantity and amount based on input type
    if (tradeForm.inputType === 'amount') {
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
    } else {
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
    }

    // For sell orders, check if user has enough shares
    if (tradeType === 'SELL') {
      const holding = stockDetail.holdings.find(h => h.portfolio_id?.toString() === tradeForm.portfolio_id);
      if (!holding || holding.quantity < quantity) {
        setTradeError(`Insufficient shares. Available: ${holding?.quantity || 0} shares`);
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
        response = await portfolioAPI.buyStock(symbol, tradeData);
      } else {
        response = await portfolioAPI.sellStock(symbol, tradeData);
      }

      setTradeSuccess(response.message);

      // Refresh stock detail and account balance
      const [updatedStock, balanceData] = await Promise.all([
        portfolioAPI.getStockDetail(symbol),
        portfolioAPI.getAccountBalance()
      ]);
      setStockDetail(updatedStock);
      setAccountBalance(balanceData.balance);

      // Reset form
      setTradeForm({
        portfolio_id: '',
        amount: '',
        shares: '',
        selectedStock: symbol,
        inputType: 'amount'
      });
    } catch (err: any) {
      setTradeError(err.response?.data?.error || `Failed to ${tradeType.toLowerCase()} stock`);
    } finally {
      setTradeLoading(false);
    }
  };

  const handleWatchlistToggle = async () => {
    if (!symbol || !stockDetail) return;

    try {
      setWatchlistLoading(true);
      setTradeError(null);

      if (stockDetail.stock.watchlist) {
        await portfolioAPI.removeFromWatchlist(symbol);
        setTradeSuccess(`${symbol.toUpperCase()} removed from watchlist`);
      } else {
        await portfolioAPI.addToWatchlist(symbol);
        setTradeSuccess(`${symbol.toUpperCase()} added to watchlist`);
      }

      // Refresh stock detail to update watchlist status
      const updatedStock = await portfolioAPI.getStockDetail(symbol);
      setStockDetail(updatedStock);
    } catch (err: any) {
      setTradeError(err.response?.data?.error || 'Failed to update watchlist');
    } finally {
      setWatchlistLoading(false);
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

  if (!stockDetail) {
    return <Alert variant="info">Stock not found</Alert>;
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const totalHoldings = stockDetail.holdings.reduce((sum, holding) => sum + holding.quantity, 0);
  const totalValue = stockDetail.holdings.reduce((sum, holding) => sum + holding.current_value, 0);
  const totalProfitLoss = stockDetail.holdings.reduce((sum, holding) => sum + holding.profit_loss, 0);

  return (
    <div>
      {tradeSuccess && <Alert variant="success" dismissible onClose={() => setTradeSuccess(null)}>{tradeSuccess}</Alert>}
      {tradeError && <Alert variant="danger" dismissible onClose={() => setTradeError(null)}>{tradeError}</Alert>}

      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center mb-3">
            <StockLogo symbol={stockDetail.stock.symbol} name={stockDetail.stock.name} size={48} />
            <div>
              <h1 className="mb-0">{stockDetail.stock.symbol} - {stockDetail.stock.name}</h1>
            </div>
          </div>
          <Link to="/stocks" className="btn btn-secondary">← Back to Stocks</Link>
        </Col>
      </Row>

      {/* Stock Summary */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Current Price</Card.Title>
              <h3 className="text-primary">{formatCurrency(stockDetail.stock.current_price)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Holdings</Card.Title>
              <h3 className="text-info">{totalHoldings}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Value</Card.Title>
              <h3 className="text-success">{formatCurrency(totalValue)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total P&L</Card.Title>
              <h3 className={totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}>
                {formatCurrency(totalProfitLoss)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Left Side - Embedded Trade Panel */}
        <Col lg={5}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Trade {stockDetail.stock.symbol}</h5>
            </Card.Header>
            <Card.Body>
              <div style={{ padding: '12px' }}>
                {/* Tab-style Buy/Sell Toggle */}
                <div className="d-flex mb-4">
                  <Button
                    variant={tradeType === 'BUY' ? 'primary' : 'outline-secondary'}
                    className="flex-fill me-2"
                    style={{
                      borderRadius: '8px',
                      padding: '12px',
                      fontWeight: '600',
                      border: tradeType === 'BUY' ? '2px solid #007bff' : '2px solid #e9ecef'
                    }}
                    onClick={() => setTradeType('BUY')}
                  >
                    Buy
                  </Button>
                  <Button
                    variant={tradeType === 'SELL' ? 'primary' : 'outline-secondary'}
                    className="flex-fill ms-2"
                    style={{
                      borderRadius: '8px',
                      padding: '12px',
                      fontWeight: '600',
                      border: tradeType === 'SELL' ? '2px solid #007bff' : '2px solid #e9ecef'
                    }}
                    onClick={() => setTradeType('SELL')}
                  >
                    Sell
                  </Button>
                </div>

                {/* Available Balance */}
                <div className="mb-3">
                  <span className="text-muted" style={{ fontSize: '14px' }}>
                    {tradeType === 'BUY' ? 'From' : 'Available'}
                  </span>
                  <span className="float-end text-muted" style={{ fontSize: '14px' }}>
                    Available: {formatCurrency(accountBalance)}
                  </span>
                </div>

                {/* Input Type Toggle */}
                <div className="mb-3">
                  <div className="d-flex border rounded p-1" style={{ backgroundColor: '#f8f9fa' }}>
                    <Button
                      variant={tradeForm.inputType === 'amount' ? 'primary' : 'light'}
                      size="sm"
                      className="flex-fill me-1"
                      style={{
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'amount' })}
                    >
                      Dollar Amount
                    </Button>
                    <Button
                      variant={tradeForm.inputType === 'shares' ? 'primary' : 'light'}
                      size="sm"
                      className="flex-fill ms-1"
                      style={{
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'shares' })}
                    >
                      Number of Shares
                    </Button>
                  </div>
                </div>

                {/* Large Input Field - Dollar Amount or Shares */}
                <div className="mb-4">
                  {tradeForm.inputType === 'amount' ? (
                    <div className="input-group" style={{ fontSize: '28px', fontWeight: '600' }}>
                      <span className="input-group-text" style={{
                        fontSize: '28px',
                        fontWeight: '600',
                        backgroundColor: 'transparent',
                        border: 'none',
                        padding: '0'
                      }}>
                        $
                      </span>
                      <Form.Control
                        type="number"
                        step="0.01"
                        value={tradeForm.amount}
                        onChange={(e) => setTradeForm({ ...tradeForm, amount: e.target.value })}
                        placeholder="0.00"
                        style={{
                          fontSize: '28px',
                          fontWeight: '600',
                          border: 'none',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          boxShadow: 'none',
                          padding: '0',
                          borderBottom: '2px solid #dee2e6'
                        }}
                        min="0"
                      />
                    </div>
                  ) : (
                    <div className="d-flex align-items-center" style={{ fontSize: '28px', fontWeight: '600' }}>
                      <Form.Control
                        type="number"
                        value={tradeForm.shares}
                        onChange={(e) => setTradeForm({ ...tradeForm, shares: e.target.value })}
                        placeholder="0"
                        style={{
                          fontSize: '28px',
                          fontWeight: '600',
                          border: 'none',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          boxShadow: 'none',
                          padding: '0',
                          borderBottom: '2px solid #dee2e6',
                          textAlign: 'right'
                        }}
                        min="1"
                      />
                      <span className="ms-3 text-muted" style={{ fontSize: '16px' }}>
                        shares
                      </span>
                    </div>
                  )}
                </div>

                {/* Stock Info */}
                <div className="mb-3">
                  <div className="d-flex align-items-center p-2 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
                    <StockLogo symbol={stockDetail.stock.symbol} name={stockDetail.stock.name} size={24} />
                    <div className="flex-grow-1">
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {stockDetail.stock.symbol}
                      </div>
                      <div className="text-muted" style={{ fontSize: '12px' }}>
                        {stockDetail.stock.name}
                      </div>
                    </div>
                    <div className="text-end">
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {formatCurrency(stockDetail.stock.current_price)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Portfolio Selection */}
                <div className="mb-3">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    {tradeType === 'BUY' ? 'Add to Portfolio' : 'Sell from Portfolio'}
                  </Form.Label>
                  <Form.Select
                    value={tradeForm.portfolio_id}
                    onChange={(e) => setTradeForm({ ...tradeForm, portfolio_id: e.target.value })}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef'
                    }}
                  >
                    <option value="">Select Portfolio</option>
                    {tradeType === 'BUY' ? (
                      portfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>
                          {portfolio.name}
                        </option>
                      ))
                    ) : (
                      stockDetail.holdings.map((holding) => (
                        <option key={holding.portfolio_id} value={holding.portfolio_id}>
                          {holding.portfolio_name} ({holding.quantity} shares available)
                        </option>
                      ))
                    )}
                  </Form.Select>
                </div>

                {/* Trade Summary */}
                {((tradeForm.inputType === 'amount' && tradeForm.amount) ||
                  (tradeForm.inputType === 'shares' && tradeForm.shares)) && (
                    <Alert variant="light" className="mb-3" style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                      {tradeForm.inputType === 'amount' ? (
                        <>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Estimated shares:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {Math.floor(parseFloat(tradeForm.amount) / stockDetail.stock.current_price)} shares
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Total cost:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {formatCurrency(Math.floor(parseFloat(tradeForm.amount) / stockDetail.stock.current_price) * stockDetail.stock.current_price)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Shares to {tradeType.toLowerCase()}:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {tradeForm.shares} shares
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Total {tradeType === 'BUY' ? 'cost' : 'proceeds'}:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {formatCurrency(parseInt(tradeForm.shares) * stockDetail.stock.current_price)}
                            </span>
                          </div>
                        </>
                      )}
                    </Alert>
                  )}

                {/* Success Display */}
                {tradeSuccess && (
                  <Alert variant="success" className="mb-3">
                    {tradeSuccess}
                  </Alert>
                )}

                {/* Error Display */}
                {tradeError && (
                  <Alert variant="danger" className="mb-3">
                    {tradeError}
                  </Alert>
                )}

                {/* Action Button */}
                <Button
                  variant={tradeType === 'BUY' ? 'success' : 'danger'}
                  className="w-100"
                  onClick={handleTrade}
                  disabled={
                    tradeLoading ||
                    !tradeForm.portfolio_id ||
                    (tradeForm.inputType === 'amount' && !tradeForm.amount) ||
                    (tradeForm.inputType === 'shares' && !tradeForm.shares)
                  }
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}
                >
                  {tradeLoading ? 'Processing...' : tradeType === 'BUY' ? 'Buy Stock' : 'Sell Stock'}
                </Button>

                {/* Watchlist Button */}
                <div className="mt-3">
                  <Button
                    variant={stockDetail.stock.watchlist ? "outline-danger" : "outline-success"}
                    onClick={handleWatchlistToggle}
                    disabled={watchlistLoading}
                    className="w-100"
                    size="sm"
                  >
                    {watchlistLoading ? (
                      'Updating...'
                    ) : stockDetail.stock.watchlist ? (
                      '★ Remove from Watchlist'
                    ) : (
                      '☆ Add to Watchlist'
                    )}
                  </Button>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Side - Holdings and Transactions */}
        <Col lg={7}>
          {/* Holdings */}
          <Card className="mb-4">
            <Card.Header>
              <h5>Holdings by Portfolio</h5>
            </Card.Header>
            <Card.Body>
              {stockDetail.holdings.length === 0 ? (
                <p>No holdings for this stock</p>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Portfolio</th>
                      <th>Quantity</th>
                      <th>Avg Price</th>
                      <th>Current Value</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockDetail.holdings.map((holding) => (
                      <tr key={holding.id}>
                        <td>
                          <Link to={`/portfolio/${holding.portfolio_id}`} className="text-decoration-none">
                            {holding.portfolio_name}
                          </Link>
                        </td>
                        <td>{holding.quantity}</td>
                        <td>{formatCurrency(holding.avg_buy_price)}</td>
                        <td>{formatCurrency(holding.current_value)}</td>
                        <td className={holding.profit_loss >= 0 ? 'text-success' : 'text-danger'}>
                          {formatCurrency(holding.profit_loss)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <Card.Header>
              <h5>Recent Transactions</h5>
            </Card.Header>
            <Card.Body>
              {stockDetail.transactions.length === 0 ? (
                <p>No transactions</p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {stockDetail.transactions.map((transaction) => (
                    <div key={transaction.id} className="mb-3 p-2 border rounded">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>
                          <Badge bg={transaction.type === 'BUY' ? 'success' : 'danger'}>
                            {transaction.type}
                          </Badge>
                          {' '}{transaction.portfolio_name}
                        </span>
                        <small className="text-muted">
                          {new Date(transaction.timestamp).toLocaleDateString()}
                        </small>
                      </div>
                      <div>
                        <small>
                          {transaction.quantity} shares @ {formatCurrency(transaction.price)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default StockDetailComponent;
