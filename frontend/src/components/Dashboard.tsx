import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner } from 'react-bootstrap';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import portfolioAPI from '../api';
import { DashboardData, NetWorthHistoryItem, Stock } from '../types';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistStocks, setWatchlistStocks] = useState<Stock[]>([]);
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, history, watchlist] = await Promise.all([
          portfolioAPI.getDashboard(),
          portfolioAPI.getNetWorthHistory(30),
          portfolioAPI.getWatchlist()
        ]);
        setDashboardData(dashboard);
        setNetWorthHistory(history);
        
        // Calculate P&L percentage for each stock if they have holdings
        const watchlistWithPnL = watchlist.map(stock => {
          let profit_loss_percentage = undefined;
          
          if (stock.total_shares_held > 0 && stock.total_cost_basis && stock.total_cost_basis > 0) {
            // Calculate average cost basis from original purchase prices
            const avgCostBasis = stock.total_cost_basis / stock.total_shares_held;
            const currentValue = stock.current_price;
            
            // Calculate P&L percentage: ((current_price - avg_cost) / avg_cost) * 100
            profit_loss_percentage = ((currentValue - avgCostBasis) / avgCostBasis) * 100;
          }
          
          return {
            ...stock,
            profit_loss_percentage
          };
        });
        
        setWatchlistStocks(watchlistWithPnL);

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
<div style={{ marginBottom: '62px' }}></div>

      <Row>
{/* Watchlist Table  */}
        <Col lg={3}>
          <Card>
            <Card.Header>
              <h5 className="mb-0">Watchlist</h5>
            </Card.Header>
            <Card.Body style={{ padding: '0' }}>
              {watchlistStocks.length === 0 ? (
                <div className="text-center text-muted py-3">
                  <p>No stocks in watchlist</p>
                  <small>Visit stock pages to add stocks to your watchlist</small>
                </div>
              ) : (
                <Table striped hover size="sm" className="mb-0">
                  <thead>
                    <tr>
                      <th>Stock</th>
                      <th className="text-end">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistStocks.map((stock) => (
                      <tr key={stock.symbol}>
                        <td>
                          <div className="text-muted" style={{ fontSize: '0.85rem' }}>{stock.name}</div>
                          <Link to={`/stock/${stock.symbol}`} className="text-decoration-none">
                            <strong>{stock.symbol}</strong>
                          </Link>
                        </td>
                        <td className="text-end">
                          {stock.profit_loss_percentage !== undefined ? (
                            <div className="small" style={{ 
                              color: stock.profit_loss_percentage >= 0 ? 'green' : 'red',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {stock.profit_loss_percentage >= 0 ? '+' : ''}{stock.profit_loss_percentage.toFixed(2)}%
                            </div>
                          ) : (
                            <div className="small text-muted" style={{ fontSize: '0.8rem' }}>
                              No holdings
                            </div>
                          )}
                          <div className="fw-bold">
                            {formatCurrency(stock.current_price)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Net Worth Chart */}
       <Col lg={5}>
  <Card className="mb-4" style={{ maxWidth: '600px', margin: '0 auto' }}>
    <Card.Header style={{ minHeight: '56px', display: 'flex', alignItems: 'center' }}>
      <h5 style={{ fontSize: '1.25rem', margin: 0 }}>Net Worth History (Last 30 Days)</h5>
    </Card.Header>
    <Card.Body style={{ padding: '12px' }}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={netWorthHistory}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="timestamp"
            tickFormatter={(value, index) => {
              const dataLength = netWorthHistory.length;
              
              if (index === 0) return "1 Day";
              else if (index < dataLength / 6) return "2 Days";
              else if (index < (2 * dataLength) / 6) return "5 Days";
              else if (index < (3 * dataLength) / 6) return "10 Days";
              else if (index < (4 * dataLength) / 6) return "15 Days";
              else if (index < (5 * dataLength) / 6) return "1M";
              else return "1M";
            }}
            interval="preserveStartEnd"
            tick={{ fontSize: 10 }}
          />
          <YAxis />
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />

          {/* Net Worth - Area with shaded fill */}
          <Area
            type="natural"
            dataKey="total_net_worth"
            stroke="#8884d8"
            fill="#8884d8"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            name="Net Worth"
          />

          {/* Portfolio Value - Area with shaded fill */}
          <Area
            type="natural"
            dataKey="portfolio_value"
            stroke="#82ca9d"
            fill="#82ca9d"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            name="Portfolio Value"
          />

          {/* Account Balance - Area with shaded fill */}
          <Area
            type="natural"
            dataKey="account_balance"
            stroke="#ffc658"
            fill="#ffc658"
            fillOpacity={0.3}
            strokeWidth={2}
            dot={false}
            name="Account Balance"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card.Body>
  </Card>
</Col>

        {/* Donut Chart for Portfolios */}
       <Col lg={4}>
  <Card className="mb-4" style={{ minHeight: '200px', maxWidth: '400px', margin: '0 auto' }}>
    <Card.Header style={{ minHeight: '56px', display: 'flex', alignItems: 'center' }}>
      <h5 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>Market Value</h5>
    </Card.Header>
    <Card.Body style={{ padding: '0 10px',paddingTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <ResponsiveContainer width="100%" height={243}>
        <PieChart>
          {(() => {
            const portfolios = dashboardData.portfolios.slice(0, 4);
            const totalValue = portfolios.reduce((sum, p) => sum + p.total_value, 0);
            const data = portfolios.map(p => ({
              name: p.name,
              percent: totalValue ? (p.total_value / totalValue) * 100 : 0,
            }));
            return (
              <Pie
                data={data}
                dataKey="percent"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={120}
                label={false}
              >
                {data.map((entry, idx) => (
                  <Cell
                    key={`cell-${idx}`}
                    fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF", "#FF6F91"][idx % 6]}
                  />
                ))}
              </Pie>
            );
          })()}
          <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
        </PieChart>
      </ResponsiveContainer>

      {/* Manual Legend Below Chart */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
        {dashboardData.portfolios.slice(0, 4).map((p, idx) => (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', margin: '4px 8px' }}>
            <div style={{
              width: 12,
              height: 12,
              backgroundColor: ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"][idx % 4],
              marginRight: 6,
              borderRadius: 2
            }} />
            <span style={{ fontSize: '0.8rem' }}>{p.name}</span>
          </div>
        ))}
      </div>
    </Card.Body>
  </Card>
</Col>


      </Row>

      {/* Portfolio Tiles */}
      <Row className="justify-content-center">

       {/* Aggressive Growth Portfolio Tile */}
        <Col xs={12} sm={6} md={4} lg={3}>
          <Card className="mb-4 text-center" style={{ minHeight: '180px', maxWidth: '250px', borderRadius: '16px', marginLeft: '0' }}>
            <Card.Header>
              <h5>Aggressive Growth Portfolio</h5>
            </Card.Header>
            <Card.Body>
              <p>
                This portfolio is ...
              </p>
              {/* Example stats */}
              <div>
                <div><strong>Value:</strong> $25,000</div>
                <div><strong>Stocks:</strong> 12</div>
                <div><strong>Performance:</strong> <span style={{ color: 'green' }}>+8.5%</span></div>
              </div>
            </Card.Body>
          </Card>
        </Col>

   {/* Dividend Income Portfolio */}
  <Col xs={12} sm={6} md={4} lg={3}>
    <Card className="mb-4 text-center" style={{ minHeight: '180px', maxWidth: '250px', borderRadius: '16px', marginLeft: '0' }}>
      <Card.Header>
        <h5>Dividend Income Portfolio</h5>
      </Card.Header>
      <Card.Body>
        <p>
          This portfolio is ...
        </p>
        {/* Example stats */}
        <div>
          <div><strong>Value:</strong> $30,000</div>
          <div><strong>Stocks:</strong> 10</div>
          <div><strong>Performance:</strong> <span style={{ color: 'green' }}>+6.8%</span></div>
        </div>
      </Card.Body>
    </Card>
  </Col>


      </Row>
    </div>
  );
};

export default Dashboard;
