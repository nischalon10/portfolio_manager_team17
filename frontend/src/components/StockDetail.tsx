import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Table, Alert, Spinner, Button, Modal, Form, Badge } from 'react-bootstrap';
import portfolioAPI from '../api';
import { StockDetail, Portfolio, TradeRequest } from '../types';

const StockDetailComponent: React.FC = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const [stockDetail, setStockDetail] = useState<StockDetail | null>(null);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [showSellModal, setShowSellModal] = useState(false);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null);
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  
  const [buyForm, setBuyForm] = useState({
    portfolio_id: '',
    quantity: '',
    price: ''
  });
  
  const [sellForm, setSellForm] = useState({
    portfolio_id: '',
    quantity: '',
    price: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!symbol) return;
      
      try {
        setLoading(true);
        const [stockData, portfolioData] = await Promise.all([
          portfolioAPI.getStockDetail(symbol),
          portfolioAPI.getPortfolios()
        ]);
        setStockDetail(stockData);
        setPortfolios(portfolioData);
        
        // Set current price in forms
        setBuyForm(prev => ({ ...prev, price: stockData.stock.current_price.toString() }));
        setSellForm(prev => ({ ...prev, price: stockData.stock.current_price.toString() }));
      } catch (err) {
        setError('Failed to fetch stock details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [symbol]);

  const handleBuy = async () => {
    if (!symbol || !buyForm.portfolio_id || !buyForm.quantity || !buyForm.price) {
      setTradeError('Please fill in all fields');
      return;
    }

    try {
      setTradeLoading(true);
      setTradeError(null);
      
      const tradeData: TradeRequest = {
        portfolio_id: parseInt(buyForm.portfolio_id),
        quantity: parseInt(buyForm.quantity),
        price: parseFloat(buyForm.price)
      };
      
      const response = await portfolioAPI.buyStock(symbol, tradeData);
      setTradeSuccess(response.message);
      setShowBuyModal(false);
      
      // Refresh stock detail
      const updatedStock = await portfolioAPI.getStockDetail(symbol);
      setStockDetail(updatedStock);
      
      // Reset form
      setBuyForm({
        portfolio_id: '',
        quantity: '',
        price: updatedStock.stock.current_price.toString()
      });
    } catch (err: any) {
      setTradeError(err.response?.data?.error || 'Failed to buy stock');
    } finally {
      setTradeLoading(false);
    }
  };

  const handleSell = async () => {
    if (!symbol || !sellForm.portfolio_id || !sellForm.quantity || !sellForm.price) {
      setTradeError('Please fill in all fields');
      return;
    }

    try {
      setTradeLoading(true);
      setTradeError(null);
      
      const tradeData: TradeRequest = {
        portfolio_id: parseInt(sellForm.portfolio_id),
        quantity: parseInt(sellForm.quantity),
        price: parseFloat(sellForm.price)
      };
      
      const response = await portfolioAPI.sellStock(symbol, tradeData);
      setTradeSuccess(response.message);
      setShowSellModal(false);
      
      // Refresh stock detail
      const updatedStock = await portfolioAPI.getStockDetail(symbol);
      setStockDetail(updatedStock);
      
      // Reset form
      setSellForm({
        portfolio_id: '',
        quantity: '',
        price: updatedStock.stock.current_price.toString()
      });
    } catch (err: any) {
      setTradeError(err.response?.data?.error || 'Failed to sell stock');
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
          <h1>{stockDetail.stock.symbol} - {stockDetail.stock.name}</h1>
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

      {/* Trading Buttons */}
      <Row className="mb-4">
        <Col>
          <Button variant="success" className="me-2" onClick={() => setShowBuyModal(true)}>
            Buy Stock
          </Button>
          <Button variant="danger" className="me-2" onClick={() => setShowSellModal(true)} disabled={totalHoldings === 0}>
            Sell Stock
          </Button>
          <Button 
            variant={stockDetail.stock.watchlist ? "outline-danger" : "outline-success"} 
            onClick={handleWatchlistToggle}
            disabled={watchlistLoading}
            className="me-2"
          >
            {watchlistLoading ? (
              'Updating...'
            ) : stockDetail.stock.watchlist ? (
              '★ Remove from Watchlist'
            ) : (
              '☆ Add to Watchlist'
            )}
          </Button>
          <Badge bg={stockDetail.stock.watchlist ? "success" : "secondary"}>
            {stockDetail.stock.watchlist ? "In Watchlist" : "Not in Watchlist"}
          </Badge>
        </Col>
      </Row>

      <Row>
        {/* Holdings */}
        <Col lg={8}>
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
        </Col>

        {/* Recent Transactions */}
        <Col lg={4}>
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

      {/* Buy Modal */}
      <Modal show={showBuyModal} onHide={() => setShowBuyModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Buy {stockDetail.stock.symbol}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Portfolio</Form.Label>
              <Form.Select
                value={buyForm.portfolio_id}
                onChange={(e) => setBuyForm({ ...buyForm, portfolio_id: e.target.value })}
              >
                <option value="">Select Portfolio</option>
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                type="number"
                value={buyForm.quantity}
                onChange={(e) => setBuyForm({ ...buyForm, quantity: e.target.value })}
                min="1"
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Price per Share</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={buyForm.price}
                onChange={(e) => setBuyForm({ ...buyForm, price: e.target.value })}
                min="0.01"
              />
            </Form.Group>
            {buyForm.quantity && buyForm.price && (
              <Alert variant="info">
                Total Cost: {formatCurrency(parseFloat(buyForm.quantity) * parseFloat(buyForm.price))}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBuyModal(false)}>
            Cancel
          </Button>
          <Button variant="success" onClick={handleBuy} disabled={tradeLoading}>
            {tradeLoading ? 'Processing...' : 'Buy'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Sell Modal */}
      <Modal show={showSellModal} onHide={() => setShowSellModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Sell {stockDetail.stock.symbol}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Portfolio</Form.Label>
              <Form.Select
                value={sellForm.portfolio_id}
                onChange={(e) => setSellForm({ ...sellForm, portfolio_id: e.target.value })}
              >
                <option value="">Select Portfolio</option>
                {stockDetail.holdings.map((holding) => (
                  <option key={holding.portfolio_id} value={holding.portfolio_id}>
                    {holding.portfolio_name} ({holding.quantity} shares)
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Quantity</Form.Label>
              <Form.Control
                type="number"
                value={sellForm.quantity}
                onChange={(e) => setSellForm({ ...sellForm, quantity: e.target.value })}
                min="1"
                max={stockDetail.holdings.find(h => h.portfolio_id?.toString() === sellForm.portfolio_id)?.quantity || 0}
              />
              {sellForm.portfolio_id && (
                <Form.Text className="text-muted">
                  Available: {stockDetail.holdings.find(h => h.portfolio_id?.toString() === sellForm.portfolio_id)?.quantity || 0} shares
                </Form.Text>
              )}
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Price per Share</Form.Label>
              <Form.Control
                type="number"
                step="0.01"
                value={sellForm.price}
                onChange={(e) => setSellForm({ ...sellForm, price: e.target.value })}
                min="0.01"
              />
            </Form.Group>
            {sellForm.quantity && sellForm.price && (
              <Alert variant="info">
                Total Proceeds: {formatCurrency(parseFloat(sellForm.quantity) * parseFloat(sellForm.price))}
              </Alert>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSellModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleSell} disabled={tradeLoading}>
            {tradeLoading ? 'Processing...' : 'Sell'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StockDetailComponent;
