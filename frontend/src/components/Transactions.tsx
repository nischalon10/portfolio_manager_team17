import React, { useState, useEffect } from 'react';
import { Card, Table, Alert, Spinner, Badge, InputGroup, FormControl, Row, Col } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import portfolioAPI from '../api';
import { Transaction } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const Transactions: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const data = await portfolioAPI.getTransactions();
        setTransactions(data);
        setFilteredTransactions(data);
      } catch (err) {
        setError('Failed to fetch transactions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  useEffect(() => {
    let filtered = transactions;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.portfolio_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by type
    if (filterType !== 'ALL') {
      filtered = filtered.filter(transaction => transaction.type === filterType);
    }

    setFilteredTransactions(filtered);
  }, [searchTerm, filterType, transactions]);

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
  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getTotalValue = (transaction: Transaction) => {
    return transaction.quantity * transaction.price;
  };

  const buyTransactions = filteredTransactions.filter(t => t.type === 'BUY');
  const sellTransactions = filteredTransactions.filter(t => t.type === 'SELL');
  const totalBuyValue = buyTransactions.reduce((sum, t) => sum + getTotalValue(t), 0);
  const totalSellValue = sellTransactions.reduce((sum, t) => sum + getTotalValue(t), 0);

  return (
    <div>
      <style>
        {`
          .form-control::placeholder {
            color: ${isDarkMode ? '#adb5bd' : '#6c757d'} !important;
            opacity: 0.7;
          }
          .form-control:focus::placeholder {
            color: ${isDarkMode ? '#ced4da' : '#adb5bd'} !important;
          }
        `}
      </style>
      <h1 className="mb-4">💳 Transactions</h1>

      {/* Filters */}
      <Row className="mb-4">
        <Col md={8}>
          <InputGroup>
            <FormControl
              placeholder="Search by symbol, name, or portfolio..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
            />
          </InputGroup>
        </Col>
        <Col md={4}>
          <FormControl
            as="select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'ALL' | 'BUY' | 'SELL')}
            style={{
              textAlign: 'right' as const,
              appearance: 'none',
              backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${isDarkMode ? '%23ffffff' : '%23000000'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'left 12px center',
              backgroundSize: '16px',
              paddingLeft: '40px'
            }}
          >
            <option value="ALL">All Transactions</option>
            <option value="BUY">Buy Only</option>
            <option value="SELL">Sell Only</option>
          </FormControl>
        </Col>
      </Row>

      {/* Transactions Table */}
      <Card>
        <Card.Header>
          <h5>
            Transaction History 
            {filterType !== 'ALL' && ` - ${filterType} Transactions`}
            {searchTerm && ` - Filtered by "${searchTerm}"`}
            ({filteredTransactions.length})
          </h5>
        </Card.Header>
        <Card.Body>
          {filteredTransactions.length === 0 ? (
            <Alert variant="info">
              {searchTerm || filterType !== 'ALL' 
                ? 'No transactions found matching your filters.' 
                : 'No transactions available.'}
            </Alert>
          ) : (
            <div style={{ 
              maxHeight: 'calc(100vh - 400px)', 
              overflowY: 'auto',
              overflowX: 'auto'
            }}>
              <Table striped bordered hover responsive>
                <thead style={{ 
                  position: 'sticky', 
                  top: 0, 
                  backgroundColor: '#f8f9fa',
                  zIndex: 10
                }}>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Portfolio</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((transaction, index) => (
                    <tr key={index}>
                      <td>{formatDateTime(transaction.timestamp)}</td>
                      <td>
                        <Badge bg={transaction.type === 'BUY' ? 'success' : 'danger'}>
                          {transaction.type}
                        </Badge>
                      </td>
                      <td>
                        <Link to={`/stock/${transaction.symbol}`} className="text-decoration-none">
                          <strong>{transaction.symbol}</strong>
                        </Link>
                      </td>
                      <td>{transaction.name}</td>
                      <td>{transaction.portfolio_name}</td>
                      <td>{transaction.quantity}</td>
                      <td>{formatCurrency(transaction.price)}</td>
                      <td className={transaction.type === 'BUY' ? 'text-danger' : 'text-success'}>
                        {transaction.type === 'BUY' ? '-' : '+'}{formatCurrency(getTotalValue(transaction))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default Transactions;
