import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner, InputGroup, FormControl } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import portfolioAPI from '../api';
import { Stock } from '../types';

const Stocks: React.FC = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoading(true);
        const data = await portfolioAPI.getStocks();
        setStocks(data);
        setFilteredStocks(data);
      } catch (err) {
        setError('Failed to fetch stocks');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
  }, []);

  useEffect(() => {
    const filtered = stocks.filter(stock =>
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStocks(filtered);
  }, [searchTerm, stocks]);

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
      <h1 className="mb-4">Stocks</h1>

      {/* Search */}
      <Row className="mb-4">
        <Col md={6}>
          <InputGroup>
            <FormControl
              placeholder="Search stocks by symbol or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </InputGroup>
        </Col>
      </Row>

      {/* Stocks Table */}
      <Card>
        <Card.Header>
          <h5>All Stocks ({filteredStocks.length})</h5>
        </Card.Header>
        <Card.Body>
          {filteredStocks.length === 0 ? (
            <Alert variant="info">
              {searchTerm ? 'No stocks found matching your search.' : 'No stocks available.'}
            </Alert>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Current Price</th>
                  <th>Shares Held</th>
                  <th>Value Held</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocks.map((stock) => (
                  <tr key={stock.id}>
                    <td>
                      <Link to={`/stock/${stock.symbol}`} className="text-decoration-none">
                        <strong>{stock.symbol}</strong>
                      </Link>
                    </td>
                    <td>{stock.name}</td>
                    <td>{formatCurrency(stock.current_price)}</td>
                    <td>{stock.total_shares_held}</td>
                    <td className={stock.total_value_held > 0 ? 'text-success' : ''}>
                      {formatCurrency(stock.total_value_held)}
                    </td>
                    <td>
                      <Link to={`/stock/${stock.symbol}`} className="btn btn-sm btn-primary">
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Stocks;
