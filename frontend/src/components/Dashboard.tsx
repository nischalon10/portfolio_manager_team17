import React, { useState, useEffect } from "react";
import { Row, Col, Card, Table, Alert, Spinner } from "react-bootstrap";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import portfolioAPI from "../api";
import { DashboardData, NetWorthHistoryItem, Stock } from "../types";

const Dashboard: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthHistoryItem[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [watchlistStocks, setWatchlistStocks] = useState<Stock[]>([]);
  const [portfoliosWithPL, setPortfoliosWithPL] = useState<PortfolioWithPL[]>([]);
  const [hoveredData, setHoveredData] = useState<any>(null);
  const [visibleLines, setVisibleLines] = useState({
    total_net_worth: true,
    portfolio_value: true,
    account_balance: true,
  });

  // Define interface for enhanced portfolio
  interface PortfolioWithPL {
    id: number;
    name: string;
    description: string;
    holdings_count: number;
    total_value: number;
    profit_loss: number;
    profit_loss_percentage: number;
    top_stocks?: {
      symbol: string;
      name: string;
      value: number;
    }[];
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, history, watchlist] = await Promise.all([
          portfolioAPI.getDashboard(),
          portfolioAPI.getNetWorthHistory(30),
          portfolioAPI.getWatchlist(),
        ]);
        setDashboardData(dashboard);
        setNetWorthHistory(history);

        // Get detailed portfolio data for P&L calculation
        const portfoliosWithHoldings = dashboard.portfolios.filter(
          (p) => p.holdings_count > 0
        );
        const portfolioDetails = await Promise.all(
          portfoliosWithHoldings.map(async (portfolio) => {
            try {
              const detail = await portfolioAPI.getPortfolioDetail(
                portfolio.id
              );

              // Calculate total P&L for this portfolio
              let totalProfitLoss = 0;
              let totalCostBasis = 0;
              let totalCurrentValue = 0;

              detail.holdings.forEach((holding) => {
                const costBasis = holding.quantity * holding.avg_buy_price;
                const currentValue = holding.current_value;
                const profitLoss = currentValue - costBasis;

                totalProfitLoss += profitLoss;
                totalCostBasis += costBasis;
                totalCurrentValue += currentValue;
              });

              const profitLossPercentage =
                totalCostBasis > 0
                  ? (totalProfitLoss / totalCostBasis) * 100
                  : 0;

              // Get top 5 stocks by value
              const topStocks = detail.holdings
                .sort((a, b) => b.current_value - a.current_value)
                .slice(0, 5)
                .map((holding) => ({
                  symbol: holding.symbol,
                  name: holding.name,
                  value: holding.current_value,
                }));

              return {
                ...portfolio,
                profit_loss: totalProfitLoss,
                profit_loss_percentage: profitLossPercentage,
                top_stocks: topStocks,
              };
            } catch (err) {
              console.error(`Error fetching portfolio ${portfolio.id}:`, err);
              return portfolio; // Return original portfolio if detail fetch fails
            }
          })
        );

        setPortfoliosWithPL(portfolioDetails);

        // Get watchlist stocks with real daily market changes
        const watchlistWithMarketChanges = await Promise.all(
          watchlist.map(async (stock) => {
            try {
              // Fetch real market data for daily changes from our backend
              const response = await fetch(`http://localhost:5001/api/stocks/${stock.symbol}/market-data`);

              if (response.ok) {
                const marketData = await response.json();

                return {
                  ...stock,
                  daily_change_percentage: marketData.daily_change_percentage,
                  previous_close_price: marketData.previous_close_price,
                  current_price: marketData.current_price, // Update with real-time price
                };
              } else {
                console.error(`Failed to fetch market data for ${stock.symbol}:`, response.statusText);

                // Fallback: keep original stock data but without daily change
                return {
                  ...stock,
                  daily_change_percentage: undefined,
                };
              }
            } catch (error) {
              console.error(`Failed to fetch market data for ${stock.symbol}:`, error);

              // Fallback: keep original stock data but without daily change
              return {
                ...stock,
                daily_change_percentage: undefined,
              };
            }
          })
        );

        setWatchlistStocks(watchlistWithMarketChanges);
      } catch (err) {
        setError("Failed to fetch dashboard data");
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
      <style>
        {`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}
      </style>
      <h2 className="mb-4">Good Morning <span className="text-primary">TheRoaringKitty</span>!</h2>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Account Balance</Card.Title>
              <h3 className="text-primary">
                {formatCurrency(dashboardData.account_balance)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Portfolio Value</Card.Title>
              <h3 className="text-success">
                {formatCurrency(dashboardData.total_value)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>Total P&L</Card.Title>
              <h3
                className={
                  dashboardData.total_profit_loss >= 0
                    ? "text-success"
                    : "text-danger"
                }
              >
                {formatCurrency(dashboardData.total_profit_loss)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3}>
          <Card className="text-center h-100">
            <Card.Body>
              <Card.Title>P&L %</Card.Title>
              <h3
                className={
                  dashboardData.profit_loss_percentage >= 0
                    ? "text-success"
                    : "text-danger"
                }
              >
                {formatPercentage(dashboardData.profit_loss_percentage)}
              </h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <div style={{ marginBottom: "62px" }}></div>

      <Row>
        {/* Left Column - Watchlist */}
        <Col lg={3}>

          <Card style={{ position: "sticky", top: "20px" }}>
            <Card.Header>
              <h5 className="mb-0">👀 My Watchlist</h5>
            </Card.Header>
            <Card.Body
              className="hide-scrollbar"
              style={{
                padding: "0",
                maxHeight: "70vh",
                overflowY: "auto",
                scrollbarWidth: "none" /* Firefox */,
                msOverflowStyle: "none" /* Internet Explorer 10+ */,
              }}
            >
              {watchlistStocks.length === 0 ? (
                <div className="text-center text-muted py-3">
                  <p>No stocks in watchlist</p>
                  <small>
                    Visit stock pages to add stocks to your watchlist
                  </small>
                </div>
              ) : (
                <Table striped hover size="sm" className="mb-0">
                  <thead
                    style={{
                      position: "sticky",
                      top: "0",
                      backgroundColor: "white",
                      zIndex: 1,
                    }}
                  >
                    <tr>
                      <th>Stock</th>
                      <th className="text-end">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlistStocks.map((stock) => (
                      <tr key={stock.symbol}>
                        <td>
                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            <img
                              src={`https://financialmodelingprep.com/image-stock/${stock.symbol}.png`}
                              alt={`${stock.symbol} logo`}
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "4px",
                                margin: ".5em",
                                objectFit: "contain",
                              }}
                              onError={(e) => {
                                e.currentTarget.src = `https://via.placeholder.com/32x32/6c757d/ffffff?text=${stock.symbol.charAt(
                                  0
                                )}`;
                              }}
                            />
                            <div>
                              <div
                                className="text-muted"
                                style={{ fontSize: "0.85rem" }}
                              >
                                {stock.name}
                              </div>
                              <Link
                                to={`/stock/${stock.symbol}`}
                                className="text-decoration-none"
                              >
                                <strong>{stock.symbol}</strong>
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="text-end">
                          {stock.daily_change_percentage !== undefined ? (
                            <div
                              className="small"
                              style={{
                                color:
                                  stock.daily_change_percentage >= 0
                                    ? "green"
                                    : "red",
                                fontWeight: "bold",
                                fontSize: "1rem",
                              }}
                            >
                              {stock.daily_change_percentage >= 0 ? "+" : ""}
                              {stock.daily_change_percentage.toFixed(2)}%
                            </div>
                          ) : (
                            <div
                              className="small text-muted"
                              style={{ fontSize: "0.8rem" }}
                            >
                              Loading...
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

        {/* Middle Column - Portfolio Cards */}
        <Col lg={5}>
          <div
            style={{
              maxHeight: "72vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* <p className="mb-3">📂 My Portfolios</p> */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                scrollbarWidth: "none" /* Firefox */,
                msOverflowStyle: "none" /* Internet Explorer 10+ */,
              }}
            >
              {portfoliosWithPL.map((portfolio, index) => {
                // Generate mock chart data for the mini graph
                const chartData = Array.from({ length: 7 }, (_, i) => ({
                  value: portfolio.total_value * (0.95 + Math.random() * 0.1),
                }));

                return (
                  <Link
                    key={portfolio.id}
                    to={`/portfolio/${portfolio.id}`}
                    className="text-decoration-none"
                  >
                    <Card
                      className="mb-3"
                      style={{
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        height: "170px",
                        border: isDarkMode ? "1px solid #404040" : "1px solid #e9ecef",
                        backgroundColor: isDarkMode ? "#1e1e1e" : "#ffffff",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow =
                          "0 4px 15px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = "";
                      }}
                    >
                      <Card.Header
                        className="px-3 py-2"
                        style={{
                          position: "relative",
                          backgroundColor: isDarkMode ? "#2d2d2d" : "#f8f9fa",
                          borderBottom: isDarkMode ? "1px solid #404040" : "1px solid #e9ecef",
                        }}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <h6 className={`mb-0 fw-bold ${isDarkMode ? 'text-info' : 'text-primary'}`}>{portfolio.name}</h6>

                          {/* Top 5 Stock Icons */}
                          <div className="d-flex align-items-center">
                            {portfolio.top_stocks && portfolio.top_stocks.length > 0 ? (
                              portfolio.top_stocks.slice(0, 5).map((stock, idx) => (
                                <img
                                  key={idx}
                                  src={`https://financialmodelingprep.com/image-stock/${stock.symbol}.png`}
                                  alt={stock.symbol}
                                  title={stock.symbol}
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    marginLeft: idx > 0 ? "-6px" : "0",
                                    border: "2px solid white",
                                    backgroundColor: "white",
                                    zIndex: 5 - idx,
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.src = `https://via.placeholder.com/22x22/6c757d/ffffff?text=${stock.symbol.charAt(0)}`;
                                  }}
                                />
                              ))
                            ) : (
                              <span className={`small ${isDarkMode ? 'text-light' : 'text-muted'}`}>No holdings</span>
                            )}
                          </div>
                        </div>
                      </Card.Header>

                      <Card.Body className="p-3" style={{ height: "130px" }}>
                        <div className="d-flex h-100 align-items-center">
                          {/* Left Side - Mini Chart */}
                          <div style={{ width: "40%", height: "90px" }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                                <Area
                                  type="monotone"
                                  dataKey="value"
                                  stroke={portfolio.profit_loss_percentage >= 0 ? "#28a745" : "#dc3545"}
                                  fill={portfolio.profit_loss_percentage >= 0 ? "#28a745" : "#dc3545"}
                                  fillOpacity={0.2}
                                  strokeWidth={2}
                                />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>

                          {/* Right Side - Portfolio Info */}
                          <div
                            className="d-flex flex-column justify-content-between h-100"
                            style={{ width: "60%", paddingLeft: "20px" }}
                          >
                            {/* Portfolio Value */}
                            <div className="mb-2">
                              <small className={`d-block ${isDarkMode ? 'text-light' : 'text-muted'}`} style={{ fontSize: "0.75rem" }}>
                                Portfolio Value
                              </small>
                              <div className={`fw-bold ${isDarkMode ? 'text-white' : 'text-dark'}`} style={{ fontSize: "1.25rem", lineHeight: "1.2" }}>
                                {formatCurrency(portfolio.total_value)}
                              </div>
                            </div>

                            {/* Holdings Count and P&L */}
                            <div className="d-flex justify-content-between align-items-end">
                              <div>
                                <small className={`d-block ${isDarkMode ? 'text-light' : 'text-muted'}`} style={{ fontSize: "0.75rem" }}>
                                  Holdings
                                </small>
                                <div className={`fw-bold ${isDarkMode ? 'text-info' : 'text-secondary'}`}>
                                  {portfolio.holdings_count} stocks
                                </div>
                              </div>

                              {portfolio.profit_loss_percentage !== undefined && (
                                <div className="text-end">
                                  <small className={`d-block ${isDarkMode ? 'text-light' : 'text-muted'}`} style={{ fontSize: "0.75rem" }}>
                                    P&L
                                  </small>
                                  <div
                                    className={
                                      portfolio.profit_loss_percentage >= 0
                                        ? "text-success fw-bold"
                                        : "text-danger fw-bold"
                                    }
                                    style={{ fontSize: "0.95rem" }}
                                  >
                                    {portfolio.profit_loss_percentage >= 0 ? "+" : ""}
                                    {formatPercentage(portfolio.profit_loss_percentage)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card.Body>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </Col>

        {/* Right Column - Charts */}
        <Col lg={4}>
          <div style={{ position: "sticky", top: "20px" }}>
            {/* Net Worth Chart */}
            <Card className="mb-4">
              <Card.Header>
                <div className="d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">📈 My Networth</h5>
                </div>
              </Card.Header>
              <Card.Body style={{ padding: "8px" }}>
                <div className="d-flex gap-2 justify-content-center">
                  <button
                    onClick={() => setVisibleLines(prev => ({ ...prev, total_net_worth: !prev.total_net_worth }))}
                    style={{
                      backgroundColor: visibleLines.total_net_worth ? "#8884d8" : "#e9ecef",
                      color: visibleLines.total_net_worth ? "white" : "#6c757d",
                      border: "none",
                      borderRadius: "15px",
                      padding: "4px 12px",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Net Worth
                  </button>
                  <button
                    onClick={() => setVisibleLines(prev => ({ ...prev, portfolio_value: !prev.portfolio_value }))}
                    style={{
                      backgroundColor: visibleLines.portfolio_value ? "#82ca9d" : "#e9ecef",
                      color: visibleLines.portfolio_value ? "white" : "#6c757d",
                      border: "none",
                      borderRadius: "15px",
                      padding: "4px 12px",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Portfolio
                  </button>
                  <button
                    onClick={() => setVisibleLines(prev => ({ ...prev, account_balance: !prev.account_balance }))}
                    style={{
                      backgroundColor: visibleLines.account_balance ? "#ffc658" : "#e9ecef",
                      color: visibleLines.account_balance ? "white" : "#6c757d",
                      border: "none",
                      borderRadius: "15px",
                      padding: "4px 12px",
                      fontSize: "0.75rem",
                      fontWeight: "500",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      outline: "none"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "0.8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "1";
                    }}
                  >
                    Account
                  </button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={netWorthHistory}
                    margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#404040" : "#f0f0f0"} strokeOpacity={0.5} />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: isDarkMode ? '#adb5bd' : '#888' }}
                      interval="preserveStartEnd"
                      tickCount={4}
                      tickFormatter={(value, index) => {
                        const totalTicks = netWorthHistory.length;
                        if (index === 0) return "";
                        if (index === totalTicks - 1) return "";
                        if (index === Math.floor(totalTicks / 2)) return "";
                        return "";
                      }}
                    />
                    <YAxis hide />

                    {/* Custom Tooltip that updates our state */}
                    <Tooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          setHoveredData(payload[0].payload);
                        } else {
                          setHoveredData(null);
                        }
                        return null; // Don't render the tooltip
                      }}
                    />

                    {/* Net Worth - Area with shaded fill */}
                    {visibleLines.total_net_worth && (
                      <Area
                        type="natural"
                        dataKey="total_net_worth"
                        stroke="#8884d8"
                        fill="url(#colorNetWorth)"
                        fillOpacity={0.4}
                        strokeWidth={2}
                        dot={false}
                        name="Net Worth"
                        activeDot={{ r: 4, stroke: '#8884d8', strokeWidth: 2, fill: isDarkMode ? '#121212' : '#fff' }}
                      />
                    )}

                    {/* Portfolio Value - Area with shaded fill */}
                    {visibleLines.portfolio_value && (
                      <Area
                        type="natural"
                        dataKey="portfolio_value"
                        stroke="#82ca9d"
                        fill="url(#colorPortfolio)"
                        fillOpacity={0.4}
                        strokeWidth={2}
                        dot={false}
                        name="Portfolio Value"
                        activeDot={{ r: 4, stroke: '#82ca9d', strokeWidth: 2, fill: isDarkMode ? '#121212' : '#fff' }}
                      />
                    )}

                    {/* Account Balance - Area with shaded fill */}
                    {visibleLines.account_balance && (
                      <Area
                        type="natural"
                        dataKey="account_balance"
                        stroke="#ffc658"
                        fill="url(#colorAccount)"
                        fillOpacity={0.4}
                        strokeWidth={2}
                        dot={false}
                        name="Account Balance"
                        activeDot={{ r: 4, stroke: '#ffc658', strokeWidth: 2, fill: isDarkMode ? '#121212' : '#fff' }}
                      />
                    )}

                    {/* Define gradients */}
                    <defs>
                      <linearGradient id="colorNetWorth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorPortfolio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#82ca9d" stopOpacity={0.1} />
                      </linearGradient>
                      <linearGradient id="colorAccount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#ffc658" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>

                {/* Data Display Below Chart */}
                <div
                  style={{
                    padding: "8px 12px",
                    backgroundColor: isDarkMode ? "#2d2d2d" : "#f8f9fa",
                    borderTop: isDarkMode ? "1px solid #404040" : "1px solid #e9ecef",
                    minHeight: "60px",
                    display: "flex",
                    alignItems: "center"
                  }}
                >
                  {hoveredData ? (
                    <div className="d-flex justify-content-between w-100">
                      <div className="text-center" style={{ minWidth: "60px" }}>
                        <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Date</small>
                        <div className="fw-bold" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                          {new Date(hoveredData.date).toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit'
                          })}
                        </div>
                      </div>
                      {visibleLines.total_net_worth && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Net Worth</small>
                          <div className="fw-bold text-primary" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                            ${(hoveredData.total_net_worth / 1000).toFixed(1)}K
                          </div>
                        </div>
                      )}
                      {visibleLines.portfolio_value && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Portfolio Value</small>
                          <div className="fw-bold text-success" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                            ${(hoveredData.portfolio_value / 1000).toFixed(1)}K
                          </div>
                        </div>
                      )}
                      {visibleLines.account_balance && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Account Balance</small>
                          <div className="fw-bold text-warning" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>
                            ${(hoveredData.account_balance / 1000).toFixed(1)}K
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="d-flex justify-content-between w-100">
                      <div className="text-center" style={{ minWidth: "60px" }}>
                        <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Date</small>
                        <div className="text-muted" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>--/--</div>
                      </div>
                      {visibleLines.total_net_worth && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Net Worth</small>
                          <div className="text-muted" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>--.-K</div>
                        </div>
                      )}
                      {visibleLines.portfolio_value && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Portfolio Value</small>
                          <div className="text-muted" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>--.-K</div>
                        </div>
                      )}
                      {visibleLines.account_balance && (
                        <div className="text-center" style={{ minWidth: "80px" }}>
                          <small className="text-muted d-block" style={{ fontSize: "0.7rem" }}>Account Balance</small>
                          <div className="text-muted" style={{ fontSize: "0.8rem", fontFamily: "monospace" }}>--.-K</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>

            {/* Portfolio Distribution Chart */}
            <Card>
              <Card.Header>
                <h5 className="mb-0">📊 Portfolio Distribution</h5>
              </Card.Header>
              <Card.Body style={{ padding: "1rem" }}>
                {(() => {
                  // ✅ Get only portfolios with non-zero value
                  const validPortfolios = dashboardData.portfolios.filter(
                    (p) => p.total_value > 0
                  );
                  const totalValue = validPortfolios.reduce(
                    (sum, p) => sum + p.total_value,
                    0
                  );

                  // ✅ Map to chart-friendly format
                  const data = validPortfolios.map((p) => ({
                    name: p.name,
                    percent: totalValue
                      ? (p.total_value / totalValue) * 100
                      : 0,
                  }));

                  const colors = [
                    "#0088FE",
                    "#00C49F",
                    "#FFBB28",
                    "#FF8042",
                    "#A28DFF",
                    "#FF6F91",
                  ];

                  return (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={data}
                            dataKey="percent"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            label={false}
                          >
                            {data.map((_, idx) => (
                              <Cell
                                key={`cell-${idx}`}
                                fill={colors[idx % colors.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: number) =>
                              `${value.toFixed(1)}%`
                            }
                            contentStyle={{
                              backgroundColor: "transparent",
                              border: "none",
                              boxShadow: "none",
                              color: "#333",
                              fontStyle: "italic",
                            }}
                            labelStyle={{
                              color: "#333",
                              fontWeight: "bold",
                              fontStyle: "italic",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Legend */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          marginTop: "1rem",
                          width: "100%",
                        }}
                      >
                        {data.map((entry, idx) => (
                          <div
                            key={entry.name}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              width: "100%",
                              margin: "0.2rem 0",
                              padding: "0.2rem",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                flex: "1",
                              }}
                            >
                              <div
                                style={{
                                  width: 12,
                                  height: 12,
                                  backgroundColor: colors[idx % colors.length],
                                  marginRight: 12,
                                  borderRadius: 2,
                                }}
                              />
                              <span style={{ fontSize: "0.85rem" }}>
                                {entry.name}
                              </span>
                              <div
                                style={{
                                  flex: "1",
                                  borderBottom: "1px dotted #ccc",
                                  marginLeft: "8px",
                                  marginRight: "8px",
                                  height: "1px",
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: "0.85rem",
                                fontWeight: "bold",
                              }}
                            >
                              {entry.percent.toFixed(1)}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
