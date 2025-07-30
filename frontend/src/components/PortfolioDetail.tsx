import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Row, Col, Card, Table, Alert, Spinner, Badge } from 'react-bootstrap';
import portfolioAPI from '../api';
import { PortfolioDetail } from '../types';

const PortfolioDetailComponent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [portfolioDetail, setPortfolioDetail] = useState<PortfolioDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolioDetail = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await portfolioAPI.getPortfolioDetail(parseInt(id));
        setPortfolioDetail(data);
      } catch (err) {
        setError('Failed to fetch portfolio details');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolioDetail();
  }, [id]);

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

  const totalValue = portfolioDetail.holdings.reduce((sum, holding) => sum + holding.current_value, 0);
  const totalProfitLoss = portfolioDetail.holdings.reduce((sum, holding) => sum + holding.profit_loss, 0);

  return (
    <div>
      <Row className="mb-4">
        <Col>
          <h1>{portfolioDetail.portfolio.name}</h1>
          <p className="text-muted">{portfolioDetail.portfolio.description}</p>
          <Link to="/portfolios" className="btn btn-secondary">← Back to Portfolios</Link>
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
              <h3 className="text-primary">{portfolioDetail.holdings.length}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Holdings */}
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Holdings</h5>
            </Card.Header>
            <Card.Body>
              {portfolioDetail.holdings.length === 0 ? (
                <p>No holdings in this portfolio</p>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
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
                    {portfolioDetail.holdings.map((holding) => (
                      <tr key={holding.id}>
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
        </Col>

        {/* Recent Transactions */}
        <Col lg={4}>
          <Card>
            <Card.Header>
              <h5>Recent Transactions</h5>
            </Card.Header>
            <Card.Body>
              {portfolioDetail.transactions.length === 0 ? (
                <p>No transactions</p>
              ) : (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {portfolioDetail.transactions.map((transaction, index) => (
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
    </div>
  );
};

export default PortfolioDetailComponent;
