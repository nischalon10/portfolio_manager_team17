import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Alert, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import portfolioAPI from '../api';
import { Portfolio } from '../types';

const Portfolios: React.FC = () => {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPortfolios = async () => {
      try {
        setLoading(true);
        const data = await portfolioAPI.getPortfolios();
        setPortfolios(data);
      } catch (err) {
        setError('Failed to fetch portfolios');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolios();
  }, []);

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
      <h1 className="mb-4">Portfolios</h1>
      
      {portfolios.length === 0 ? (
        <Alert variant="info">No portfolios found</Alert>
      ) : (
        <Row>
          {portfolios.map((portfolio) => (
            <Col lg={6} className="mb-4" key={portfolio.id}>
              <Card className="h-100">
                <Card.Header>
                  <h5>
                    <Link to={`/portfolio/${portfolio.id}`} className="text-decoration-none">
                      {portfolio.name}
                    </Link>
                  </h5>
                </Card.Header>
                <Card.Body>
                  <p className="text-muted">{portfolio.description}</p>
                  <Row>
                    <Col sm={6}>
                      <strong>Total Value:</strong>
                      <h4 className="text-success">{formatCurrency(portfolio.total_value)}</h4>
                    </Col>
                    <Col sm={6}>
                      <strong>Holdings:</strong>
                      <h4 className="text-primary">{portfolio.holdings_count}</h4>
                    </Col>
                  </Row>
                </Card.Body>
                <Card.Footer>
                  <Link to={`/portfolio/${portfolio.id}`} className="btn btn-primary">
                    View Details
                  </Link>
                </Card.Footer>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default Portfolios;
