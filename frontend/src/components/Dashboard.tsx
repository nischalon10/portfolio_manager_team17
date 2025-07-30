import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner } from 'react-bootstrap';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import portfolioAPI from '../api';
import { DashboardData, NetWorthHistoryItem } from '../types';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, history] = await Promise.all([
          portfolioAPI.getDashboard(),
          portfolioAPI.getNetWorthHistory(30)
        ]);
        setDashboardData(dashboard);
        setNetWorthHistory(history);
      } catch (err) {
        setError('Failed to fetch dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  if (!dashboardData) {
    return <Alert variant="info">No dashboard data available</Alert>;
  }

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatPercentage = (percent: number) => `${percent.toFixed(2)}%`;

  return (
    <div>
      <h1 className="mb-4">Portfolio Dashboard</h1>
      
      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Account Balance</Card.Title>
              <h3 className="text-primary">{formatCurrency(dashboardData.account_balance)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Portfolio Value</Card.Title>
              <h3 className="text-success">{formatCurrency(dashboardData.total_value)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Total P&L</Card.Title>
              <h3 className={dashboardData.total_profit_loss >= 0 ? 'text-success' : 'text-danger'}>
                {formatCurrency(dashboardData.total_profit_loss)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>P&L %</Card.Title>
              <h3 className={dashboardData.profit_loss_percentage >= 0 ? 'text-success' : 'text-danger'}>
                {formatPercentage(dashboardData.profit_loss_percentage)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row>
        {/* Net Worth Chart */}
        <Col lg={8}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Net Worth History (Last 30 Days)</h5>
            </Card.Header>
            <Card.Body>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={netWorthHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="total_net_worth" stroke="#8884d8" name="Net Worth" />
                  <Line type="monotone" dataKey="portfolio_value" stroke="#82ca9d" name="Portfolio Value" />
                  <Line type="monotone" dataKey="account_balance" stroke="#ffc658" name="Account Balance" />
                </LineChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Portfolio Summary */}
        <Col lg={4}>
          <Card className="mb-4">
            <Card.Header>
              <h5>Portfolios</h5>
            </Card.Header>
            <Card.Body>
              {dashboardData.portfolios.length === 0 ? (
                <p>No portfolios found</p>
              ) : (
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.portfolios.map((portfolio) => (
                      <tr key={portfolio.id}>
                        <td>
                          <a href={`/portfolio/${portfolio.id}`} className="text-decoration-none">
                            {portfolio.name}
                          </a>
                        </td>
                        <td>{formatCurrency(portfolio.total_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Transactions */}
      <Row>
        <Col>
          <Card>
            <Card.Header>
              <h5>Recent Transactions</h5>
            </Card.Header>
            <Card.Body>
              {dashboardData.recent_transactions.length === 0 ? (
                <p>No recent transactions</p>
              ) : (
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Symbol</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Portfolio</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.recent_transactions.map((transaction, index) => (
                      <tr key={index}>
                        <td>
                          <span className={`badge ${transaction.type === 'BUY' ? 'bg-success' : 'bg-danger'}`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td>
                          <a href={`/stock/${transaction.symbol}`} className="text-decoration-none">
                            {transaction.symbol}
                          </a>
                        </td>
                        <td>{transaction.quantity}</td>
                        <td>{formatCurrency(transaction.price)}</td>
                        <td>{transaction.portfolio_name}</td>
                        <td>{new Date(transaction.timestamp).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
