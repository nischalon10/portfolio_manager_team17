import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner } from 'react-bootstrap';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import portfolioAPI from '../api';
import { DashboardData, NetWorthHistoryItem, Stock } from '../types';

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistStocks, setWatchlistStocks] = useState<Stock[]>([]);
  const [portfoliosWithPL, setPortfoliosWithPL] = useState<any[]>([]);

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
        
        // Get detailed portfolio data for P&L calculation
        const portfoliosWithHoldings = dashboard.portfolios.filter(p => p.holdings_count > 0);
        const portfolioDetails = await Promise.all(
          portfoliosWithHoldings.map(async (portfolio) => {
            try {
              const detail = await portfolioAPI.getPortfolioDetail(portfolio.id);
              
              // Calculate total P&L for this portfolio
              let totalProfitLoss = 0;
              let totalCostBasis = 0;
              let totalCurrentValue = 0;
              
              detail.holdings.forEach(holding => {
                const costBasis = holding.quantity * holding.avg_buy_price;
                const currentValue = holding.current_value;
                const profitLoss = currentValue - costBasis;
                
                totalProfitLoss += profitLoss;
                totalCostBasis += costBasis;
                totalCurrentValue += currentValue;
              });
              
              const profitLossPercentage = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;
              
              return {
                ...portfolio,
                profit_loss: totalProfitLoss,
                profit_loss_percentage: profitLossPercentage
              };
            } catch (err) {
              console.error(`Error fetching portfolio ${portfolio.id}:`, err);
              return portfolio; // Return original portfolio if detail fetch fails
            }
          })
        );
        
        setPortfoliosWithPL(portfolioDetails);
        
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
  interval={0}
  ticks={[
    netWorthHistory[0]?.timestamp,
    netWorthHistory[Math.floor(netWorthHistory.length / 6)]?.timestamp,
    netWorthHistory[Math.floor((2 * netWorthHistory.length) / 6)]?.timestamp,
    netWorthHistory[Math.floor((3 * netWorthHistory.length) / 6)]?.timestamp,
    netWorthHistory[Math.floor((4 * netWorthHistory.length) / 6)]?.timestamp,
    netWorthHistory[netWorthHistory.length - 1]?.timestamp,
  ]}
  tickFormatter={(value, index) =>
    ["1 Day", "2 Days", "5 Days", "10 Days", "15 Days", "1M"][index] || ""
  }
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
    <Card.Body style={{ padding: '0 10px', paddingTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {(() => {
        // ✅ Get only portfolios with non-zero value
        const validPortfolios = dashboardData.portfolios.filter(p => p.total_value > 0);
        const totalValue = validPortfolios.reduce((sum, p) => sum + p.total_value, 0);

        // ✅ Map to chart-friendly format
        const data = validPortfolios.map(p => ({
          name: p.name,
          percent: totalValue ? (p.total_value / totalValue) * 100 : 0,
        }));

        const colors = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#A28DFF", "#FF6F91"];

        return (
          <>
            <ResponsiveContainer width="100%" height={243}>
              <PieChart>
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
                  {data.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                  contentStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: '#333',
                    fontStyle: 'italic'
                  }}
                  labelStyle={{
                    color: '#333',
                    fontWeight: 'bold',
                    fontStyle: 'italic'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* ✅ Only legend for what's shown on chart */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
              {data.map((entry, idx) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', margin: '4px 8px' }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    backgroundColor: colors[idx % colors.length],
                    marginRight: 6,
                    borderRadius: 2
                  }} />
                  <span style={{ fontSize: '0.8rem' }}>{entry.name}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}
    </Card.Body>
  </Card>
</Col>



      </Row>

     {/* Portfolio Tiles */}
<Row className="justify-content-center" style={{ marginTop: '40px' }}>
  {portfoliosWithPL
    .map((portfolio, index) => (
      <Col xs={12} sm={6} md={4} lg={3} key={portfolio.id}>
        <Link to={`/portfolio/${portfolio.id}`} className="text-decoration-none">
          <Card
            className="text-center"
            style={{
              height: '210px',
              width: '250px',
              borderRadius: '16px',
              marginTop: index >= 4 ? '40px' : '0px',
              marginBottom: '0px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              display: 'flex',
              flexDirection: 'column'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '';
            }}
          >
            <Card.Header
              style={{
                height: '60px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                padding: '0.5rem',
                flex: 'none'
              }}
            >
              <h5 
                className="text-primary" 
                style={{ 
                  margin: 0, 
                  textAlign: 'center',
                  fontSize: '1.12rem',
                  lineHeight: '1.2',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '100%'
                }}
              >
                {portfolio.name}
              </h5>
            </Card.Header>

            <Card.Body 
              style={{ 
                overflow: 'hidden',
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '0.75rem'
              }}
            >
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.3',
                maxHeight: '2.6em',
                marginBottom: '10px'
              }}>
                {portfolio.description || 'Portfolio details'}
              </p>
              <div>
                <div><strong>Value:</strong> {formatCurrency(portfolio.total_value)}</div>
                <div><strong>Holdings:</strong> {portfolio.holdings_count}</div>
                {portfolio.profit_loss_percentage !== undefined && (
                  <div>
                    <strong>Performance:</strong>
                    <span
                      className={portfolio.profit_loss_percentage >= 0 ? 'text-success' : 'text-danger'}
                      style={{ marginLeft: '5px' }}
                    >
                      {formatPercentage(portfolio.profit_loss_percentage)}
                    </span>
                  </div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Link>
      </Col>
    ))}
</Row>

    </div>
  );
};

export default Dashboard;
