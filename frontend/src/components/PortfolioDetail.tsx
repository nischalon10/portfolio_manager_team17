import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Row, Col, Card, Table, Alert, Spinner, Badge, Button, Form, ButtonGroup, Modal } from 'react-bootstrap';
import portfolioAPI from '../api';
import { PortfolioDetail, Stock, TradeRequest } from '../types';

// Component for stock logo with fallback (same as StockDetail.tsx)
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

const PortfolioDetailComponent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [portfolioDetail, setPortfolioDetail] = useState<PortfolioDetail | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [tradeType, setTradeType] = useState<'BUY' | 'SELL'>('BUY');

  // Delete portfolio states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [tradeForm, setTradeForm] = useState({
    selectedStock: '',
    amount: '',
    shares: '',
    inputType: 'shares' as 'amount' | 'shares'
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const [portfolioData, stocksData, balanceData] = await Promise.all([
          portfolioAPI.getPortfolioDetail(parseInt(id)),
          portfolioAPI.getStocks(),
          portfolioAPI.getAccountBalance()
        ]);
        setPortfolioDetail(portfolioData);
        setStocks(stocksData);
        setAccountBalance(balanceData.balance);
      } catch (err) {
        setError('Failed to fetch portfolio details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleTrade = async () => {
    if (!tradeForm.selectedStock || !portfolioDetail) {
      setTradeError('Please select a stock');
      return;
    }

    const selectedStock = stocks.find(s => s.symbol === tradeForm.selectedStock);
    if (!selectedStock) {
      setTradeError('Selected stock not found');
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

    // For sell orders, check if user has enough shares in this portfolio
    if (tradeType === 'SELL') {
      const holding = portfolioDetail.holdings.find(h => h.symbol === selectedStock.symbol);
      if (!holding || holding.quantity < quantity) {
        setTradeError(`Insufficient shares in this portfolio. Available: ${holding?.quantity || 0} shares`);
        return;
      }
    }

    try {
      setTradeLoading(true);
      setTradeError(null);

      const tradeData: TradeRequest = {
        portfolio_id: portfolioDetail.portfolio.id,
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

      // Refresh portfolio detail, stocks and account balance
      const [updatedPortfolio, updatedStocks, balanceData] = await Promise.all([
        portfolioAPI.getPortfolioDetail(portfolioDetail.portfolio.id),
        portfolioAPI.getStocks(),
        portfolioAPI.getAccountBalance()
      ]);
      setPortfolioDetail(updatedPortfolio);
      setStocks(updatedStocks);
      setAccountBalance(balanceData.balance);

      // Reset form
      setTradeForm({
        selectedStock: '',
        amount: '',
        shares: '',
        inputType: 'shares'
      });
    } catch (err: any) {
      setTradeError(err.response?.data?.error || `Failed to ${tradeType.toLowerCase()} stock`);
    } finally {
      setTradeLoading(false);
    }
  };

  const handleDeletePortfolio = async () => {
    if (!portfolioDetail || deleteConfirmName !== portfolioDetail.portfolio.name) {
      setDeleteError('Please type the exact portfolio name to confirm deletion');
      return;
    }

    try {
      setDeleteLoading(true);
      setDeleteError(null);

      await portfolioAPI.deletePortfolio(portfolioDetail.portfolio.id);

      // Navigate back to portfolios page
      navigate('/portfolios');
    } catch (err: any) {
      setDeleteError(err.response?.data?.error || 'Failed to delete portfolio');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openDeleteModal = () => {
    setShowDeleteModal(true);
    setDeleteConfirmName('');
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmName('');
    setDeleteError(null);
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

  if (!portfolioDetail) {
    return <Alert variant="info">Portfolio not found</Alert>;
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

  const totalValue = portfolioDetail?.holdings.reduce((sum, holding) => sum + holding.current_value, 0) || 0;
  const totalProfitLoss = portfolioDetail?.holdings.reduce((sum, holding) => sum + holding.profit_loss, 0) || 0;

  const selectedStock = stocks.find(s => s.symbol === tradeForm.selectedStock);

  return (
    <div>
      {tradeSuccess && <Alert variant="success" dismissible onClose={() => setTradeSuccess(null)}>{tradeSuccess}</Alert>}
      {tradeError && <Alert variant="danger" dismissible onClose={() => setTradeError(null)}>{tradeError}</Alert>}

      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h1>{portfolioDetail?.portfolio.name}</h1>
              <p className="text-muted">{portfolioDetail?.portfolio.description}</p>
              <Link to="/portfolios" className="btn btn-secondary">← Back to Portfolios</Link>
            </div>
            <div>
              <Button
                variant="outline-danger"
                onClick={openDeleteModal}
                className="mt-2"
              >
                Delete Portfolio
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Portfolio Summary */}
      <Row className="mb-4">
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total Value</Card.Title>
              <h3 className="text-success">{formatCurrency(totalValue)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Total P&L</Card.Title>
              <h3 className={totalProfitLoss >= 0 ? 'text-success' : 'text-danger'}>
                {formatCurrency(totalProfitLoss)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}>
          <Card className="text-center">
            <Card.Body>
              <Card.Title>Holdings</Card.Title>
              <h3 className="text-primary">{portfolioDetail?.holdings.length || 0}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Portfolio Composition Bar */}
      {portfolioDetail?.holdings.length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card>
              <Card.Header>
                <h5>Portfolio Composition</h5>
              </Card.Header>
              <Card.Body>
                <div className="portfolio-composition-bar" style={{
                  display: 'flex',
                  height: '80px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '2px solid #e9ecef',
                  backgroundColor: '#f8f9fa'
                }}>
                  {portfolioDetail.holdings.map((holding, index) => {
                    const percentage = (holding.current_value / totalValue) * 100;
                    const isSmallSegment = percentage < 8; // Hide text for segments smaller than 8%

                    // Generate a consistent color for each stock
                    const colors = [
                      '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
                      '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
                    ];
                    const segmentColor = colors[index % colors.length];

                    return (
                      <div
                        key={holding.id}
                        className="portfolio-segment d-flex align-items-center justify-content-center position-relative"
                        style={{
                          width: `${percentage}%`,
                          backgroundColor: segmentColor,
                          minWidth: percentage < 2 ? '2px' : 'auto', // Minimum width for very small segments
                          transition: 'all 0.3s ease',
                          cursor: 'pointer'
                        }}
                        title={`${holding.symbol}: ${percentage.toFixed(1)}% (${formatCurrency(holding.current_value)})`}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '0.8';
                          e.currentTarget.style.transform = 'scaleY(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.transform = 'scaleY(1)';
                        }}
                      >
                        {!isSmallSegment && (
                          <div className="text-white text-center" style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                            lineHeight: '1.2'
                          }}>
                            <div className="d-flex flex-column align-items-center">
                              <StockLogo
                                symbol={holding.symbol}
                                name={holding.name}
                                size={24}
                              />
                              <div style={{ fontSize: '10px', marginTop: '2px' }}>
                                {holding.symbol}
                              </div>
                              <div style={{ fontSize: '9px' }}>
                                {percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        )}
                        {isSmallSegment && percentage >= 1 && (
                          <div className="text-white text-center" style={{
                            fontSize: '8px',
                            fontWeight: '600',
                            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                            writingMode: 'vertical-rl' as any,
                            textOrientation: 'mixed'
                          }}>
                            {holding.symbol}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend below the bar */}
                <div className="mt-3">
                  <div className="d-flex flex-wrap gap-3 justify-content-center">
                    {portfolioDetail.holdings.map((holding, index) => {
                      const percentage = (holding.current_value / totalValue) * 100;
                      const colors = [
                        '#007bff', '#28a745', '#dc3545', '#ffc107', '#17a2b8',
                        '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d'
                      ];
                      const segmentColor = colors[index % colors.length];

                      return (
                        <div key={holding.id} className="d-flex align-items-center" style={{ fontSize: '12px' }}>
                          <div
                            className="me-2"
                            style={{
                              width: '12px',
                              height: '12px',
                              backgroundColor: segmentColor,
                              borderRadius: '2px'
                            }}
                          ></div>
                          <StockLogo symbol={holding.symbol} name={holding.name} size={16} />
                          <span className="me-2">
                            <strong>{holding.symbol}</strong>
                          </span>
                          <span className="text-muted">
                            {percentage.toFixed(1)}% • {formatCurrency(holding.current_value)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <Row>
        {/* Left Side - Embedded Trade Panel */}
        <Col lg={5}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Trade in {portfolioDetail?.portfolio.name}</h5>
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

                {/* Stock Selection */}
                <div className="mb-3">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', fontSize: '14px' }}>
                    Select Stock
                  </Form.Label>
                  <Form.Select
                    value={tradeForm.selectedStock}
                    onChange={(e) => setTradeForm({ ...tradeForm, selectedStock: e.target.value })}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid #e9ecef'
                    }}
                  >
                    <option value="">Choose a stock...</option>
                    {tradeType === 'BUY' ? (
                      stocks.map((stock) => (
                        <option key={stock.symbol} value={stock.symbol}>
                          {stock.symbol} - {stock.name} (${stock.current_price.toFixed(2)})
                        </option>
                      ))
                    ) : (
                      portfolioDetail?.holdings.map((holding) => (
                        <option key={holding.symbol} value={holding.symbol}>
                          {holding.symbol} - {holding.name} ({holding.quantity} shares available)
                        </option>
                      ))
                    )}
                  </Form.Select>
                </div>

                {/* Input Type Toggle */}
                <div className="mb-3">
                  <div className="d-flex border rounded p-1" style={{ backgroundColor: '#f8f9fa' }}>
                    <Button
                      variant={tradeForm.inputType === 'shares' ? 'primary' : 'light'}
                      size="sm"
                      className="flex-fill me-1"
                      style={{
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'shares' })}
                    >
                      Number of Shares
                    </Button>
                    <Button
                      variant={tradeForm.inputType === 'amount' ? 'primary' : 'light'}
                      size="sm"
                      className="flex-fill ms-1"
                      style={{
                        borderRadius: '6px',
                        fontWeight: '500',
                        fontSize: '14px'
                      }}
                      onClick={() => setTradeForm({ ...tradeForm, inputType: 'amount' })}
                    >
                      Dollar Amount
                    </Button>
                  </div>
                </div>

                {/* Large Input Field - Dollar Amount or Shares */}
                <div className="mb-4">
                  {tradeForm.inputType === 'shares' ? (
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
                  ) : (
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
                  )}
                </div>

                {/* Stock Info */}
                {selectedStock && (
                  <div className="mb-3">
                    <div className="d-flex align-items-center p-2 border rounded" style={{ backgroundColor: '#f8f9fa' }}>
                      <StockLogo symbol={selectedStock.symbol} name={selectedStock.name} size={24} />
                      <div className="flex-grow-1">
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>
                          {selectedStock.symbol}
                        </div>
                        <div className="text-muted" style={{ fontSize: '12px' }}>
                          {selectedStock.name}
                        </div>
                      </div>
                      <div className="text-end">
                        <div style={{ fontWeight: '600', fontSize: '14px' }}>
                          {formatCurrency(selectedStock.current_price)}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Trade Summary */}
                {selectedStock && ((tradeForm.inputType === 'shares' && tradeForm.shares) ||
                  (tradeForm.inputType === 'amount' && tradeForm.amount)) && (
                    <Alert variant="light" className="mb-3" style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef' }}>
                      {tradeForm.inputType === 'shares' ? (
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
                              {formatCurrency(parseInt(tradeForm.shares) * selectedStock.current_price)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Estimated shares:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {Math.floor(parseFloat(tradeForm.amount) / selectedStock.current_price)} shares
                            </span>
                          </div>
                          <div className="d-flex justify-content-between">
                            <span style={{ fontSize: '12px' }}>Total cost:</span>
                            <span style={{ fontWeight: '600', fontSize: '12px' }}>
                              {formatCurrency(Math.floor(parseFloat(tradeForm.amount) / selectedStock.current_price) * selectedStock.current_price)}
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
                    !tradeForm.selectedStock ||
                    (tradeForm.inputType === 'shares' && !tradeForm.shares) ||
                    (tradeForm.inputType === 'amount' && !tradeForm.amount)
                  }
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: '600'
                  }}
                >
                  {tradeLoading ? 'Processing...' : tradeType === 'BUY' ? `Buy ${selectedStock?.symbol || 'Stock'}` : `Sell ${selectedStock?.symbol || 'Stock'}`}
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Side - Holdings and Transactions */}
        <Col lg={7}>
          {/* Holdings */}
          <Card className="mb-4">
            <Card.Header>
              <h5>Holdings</h5>
            </Card.Header>
            <Card.Body>
              {!portfolioDetail?.holdings.length ? (
                <p>No holdings in this portfolio</p>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Logo</th>
                      <th>Symbol</th>
                      <th>Name</th>
                      <th>Quantity</th>
                      <th>Avg Price</th>
                      <th>Current Price</th>
                      <th>Current Value</th>
                      <th>P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioDetail?.holdings.map((holding) => (
                      <tr key={holding.id}>
                        <td className="text-center">
                          <StockLogo symbol={holding.symbol} name={holding.name} size={32} />
                        </td>
                        <td>
                          <Link to={`/stock/${holding.symbol}`} className="text-decoration-none">
                            {holding.symbol}
                          </Link>
                        </td>
                        <td>{holding.name}</td>
                        <td>{holding.quantity}</td>
                        <td>{formatCurrency(holding.avg_buy_price)}</td>
                        <td>{formatCurrency(holding.current_price)}</td>
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
              {!portfolioDetail?.transactions.length ? (
                <p>No transactions</p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {portfolioDetail?.transactions.map((transaction, index) => (
                    <div key={index} className="mb-3 p-2 border rounded">
                      <div className="d-flex justify-content-between align-items-center">
                        <span>
                          <Badge bg={transaction.type === 'BUY' ? 'success' : 'danger'}>
                            {transaction.type}
                          </Badge>
                          {' '}
                          <Link to={`/stock/${transaction.symbol}`} className="text-decoration-none">
                            {transaction.symbol}
                          </Link>
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

      {/* Delete Portfolio Modal */}
      <Modal show={showDeleteModal} onHide={closeDeleteModal} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Delete Portfolio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteError && (
            <Alert variant="danger" className="mb-3">
              {deleteError}
            </Alert>
          )}

          <Alert variant="warning" className="mb-4">
            <Alert.Heading>⚠️ Permanent Action</Alert.Heading>
            <p>
              You are about to permanently delete the portfolio <strong>"{portfolioDetail?.portfolio.name}"</strong>.
            </p>
            {portfolioDetail?.holdings.length > 0 && (
              <p>
                <strong>This portfolio contains {portfolioDetail.holdings.length} holdings that will be permanently removed.</strong>
              </p>
            )}
            <p className="mb-0">
              This action <strong>cannot be undone</strong>. All portfolio data, holdings, and transaction history will be lost.
            </p>
          </Alert>

          <Form.Group className="mb-3">
            <Form.Label>
              To confirm deletion, please type the portfolio name: <strong>{portfolioDetail?.portfolio.name}</strong>
            </Form.Label>
            <Form.Control
              type="text"
              placeholder={`Type "${portfolioDetail?.portfolio.name}" to confirm`}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              disabled={deleteLoading}
              autoFocus
              style={{
                fontFamily: 'monospace',
                fontSize: '14px'
              }}
            />
            <Form.Text className="text-muted">
              Portfolio names are case-sensitive
            </Form.Text>
          </Form.Group>

          {portfolioDetail?.holdings.length > 0 && (
            <div className="mb-3">
              <h6>Holdings that will be deleted:</h6>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {portfolioDetail.holdings.map((holding, index) => (
                  <div key={index} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                    <span>
                      <strong>{holding.symbol}</strong> - {holding.name}
                    </span>
                    <span>
                      {holding.quantity} shares • {formatCurrency(holding.current_value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeletePortfolio}
            disabled={deleteLoading || deleteConfirmName !== portfolioDetail?.portfolio.name}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Portfolio Permanently'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default PortfolioDetailComponent;
