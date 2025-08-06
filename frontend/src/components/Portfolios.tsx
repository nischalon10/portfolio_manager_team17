import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Alert, Spinner, Button, Modal, Form } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import portfolioAPI from '../api';
import { Portfolio } from '../types';
import { useTheme } from '../contexts/ThemeContext';

const Portfolios: React.FC = () => {
  const { isDarkMode } = useTheme();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [portfoliosWithPL, setPortfoliosWithPL] = useState<PortfolioWithPL[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    fetchPortfolios();
  }, []);

  const handleCreatePortfolio = async () => {
    if (!createForm.name.trim()) {
      setFormError('Portfolio name is required');
      return;
    }

    try {
      setFormLoading(true);
      setFormError(null);

      await portfolioAPI.createPortfolio({
        name: createForm.name.trim(),
        description: createForm.description.trim()
      });

      // Refresh portfolios list
      await fetchPortfolios();

      // Reset form and close modal
      setCreateForm({ name: '', description: '' });
      setShowCreateModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create portfolio');
    } finally {
      setFormLoading(false);
    }
  };

  const fetchPortfolios = async () => {
    try {
      setLoading(true);
      const data = await portfolioAPI.getPortfolios();
      setPortfolios(data);

      // Get detailed portfolio data for P&L calculation
      const portfoliosWithHoldings = data.filter(
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
            return {
              ...portfolio,
              profit_loss: 0,
              profit_loss_percentage: 0,
              top_stocks: [],
            };
          }
        })
      );

      // Include portfolios without holdings as well
      const portfoliosWithoutHoldings = data.filter(
        (p) => p.holdings_count === 0
      ).map(portfolio => ({
        ...portfolio,
        profit_loss: 0,
        profit_loss_percentage: 0,
        top_stocks: [],
      }));

      setPortfoliosWithPL([...portfolioDetails, ...portfoliosWithoutHoldings]);
    } catch (err) {
      setError('Failed to fetch portfolios');
      console.error(err);
    } finally {
      setLoading(false);
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

  const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;
  const formatPercentage = (percent: number) => `${percent.toFixed(2)}%`;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>📂 My Portfolios</h2>
        <Button 
          variant="primary" 
          onClick={() => setShowCreateModal(true)}
          size="lg"
          className="rounded-pill px-4"
        >
          + Create Portfolio
        </Button>
      </div>
      
      {portfoliosWithPL.length === 0 ? (
        <Alert variant="info">No portfolios found</Alert>
      ) : (
        <Row>
          {portfoliosWithPL.map((portfolio) => {
            // Generate mock chart data for the mini graph
            const chartData = Array.from({ length: 7 }, (_, i) => ({
              value: portfolio.total_value * (0.95 + Math.random() * 0.1),
            }));

            return (
              <Col lg={6} className="mb-4" key={portfolio.id}>
                <Link
                  to={`/portfolio/${portfolio.id}`}
                  className="text-decoration-none"
                >
                  <Card
                    style={{
                      cursor: "pointer",
                      transition: "all 0.3s ease",
                      height: "220px",
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
                      className="px-3 py-3"
                      style={{ 
                        position: "relative",
                        backgroundColor: isDarkMode ? "#2d2d2d" : "#f8f9fa",
                        borderBottom: isDarkMode ? "1px solid #404040" : "1px solid #e9ecef",
                        height: "80px",
                      }}
                    >
                      <div className="d-flex justify-content-between align-items-start">
                        <div style={{ flex: 1 }}>
                          <h6 className={`mb-1 fw-bold ${isDarkMode ? 'text-info' : 'text-primary'}`}>{portfolio.name}</h6>
                          <p className={`mb-0 ${isDarkMode ? 'text-light' : 'text-muted'}`} style={{ fontSize: "0.8rem", lineHeight: "1.3" }}>
                            {portfolio.description || "No description available"}
                          </p>
                        </div>
                        
                        {/* Top 5 Stock Icons */}
                        <div className="d-flex align-items-center" style={{ marginLeft: "10px" }}>
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
                    
                    <Card.Body className="p-3" style={{ height: "140px" }}>
                      <div className="d-flex h-100 align-items-center">
                        {/* Left Side - Mini Chart */}
                        <div style={{ width: "40%", height: "110px" }}>
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
                            
                            {portfolio.holdings_count > 0 && (
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
              </Col>
            );
          })}
        </Row>
      )}

      {/* Create Portfolio Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Create New Portfolio</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {formError && (
            <Alert variant="danger" className="mb-3">
              {formError}
            </Alert>
          )}
          
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Portfolio Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter portfolio name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                disabled={formLoading}
                autoFocus
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Description (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                placeholder="Enter portfolio description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                disabled={formLoading}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowCreateModal(false)}
            disabled={formLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreatePortfolio}
            disabled={formLoading || !createForm.name.trim()}
          >
            {formLoading ? 'Creating...' : 'Create Portfolio'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Portfolios;
