import React, { useState, useEffect, useRef } from 'react';
import { Navbar, Nav, Container, Card, Row, Col, ButtonGroup, Button } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaHome, FaSun, FaMoon } from 'react-icons/fa';
import { useTheme } from '../contexts/ThemeContext';
import portfolioAPI from '../api';
import { Stock } from '../types';

// Simple stock logo component for search results
const SearchStockLogo: React.FC<{ symbol: string; name: string }> = ({ symbol, name }) => {
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState<string>('');

  useEffect(() => {
    // Check if we have a custom logo URL for this symbol
    const customLogos: { [key: string]: string } = {
      'INTC': 'https://logos-world.net/wp-content/uploads/2021/09/Intel-Logo.png',
      'DIS': 'https://www.citypng.com/public/uploads/preview/hd-the-walt-disney-blue-logo-transparent-png-701751694774911obalqyemvs.png',
      'AMZN': 'https://www.allaboutlean.com/wp-content/uploads/2019/10/Amazon-Logo.png',
      'UNH': 'https://i.pinimg.com/736x/be/1b/b5/be1bb5e50d33f4e6c7ef3bb8c178b8db.jpg',
      'V': 'https://www.edigitalagency.com.au/wp-content/uploads/new-visa-logo-white-font-blue-background-latest.png'
    };

    if (customLogos[symbol]) {
      setImgSrc(customLogos[symbol]);
    } else {
      setImgSrc(`https://financialmodelingprep.com/image-stock/${symbol}.png`);
    }

    setHasError(false);
  }, [symbol]);

  const handleImageError = () => {
    setHasError(true);
  };

  const getInitials = (companyName: string) => {
    return companyName
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  if (hasError) {
    return (
      <div
        className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold me-2"
        style={{
          width: 24,
          height: 24,
          fontSize: 10,
          minWidth: 24,
          minHeight: 24,
          background: 'linear-gradient(45deg, #6c757d, #495057)'
        }}
      >
        {getInitials(name)}
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={`${symbol} logo`}
      width={24}
      height={24}
      onError={handleImageError}
      className="rounded me-2"
      style={{
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    />
  );
};

const Navigation: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch stocks on component mount
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoading(true);
        const stocksData = await portfolioAPI.getStocks();
        setStocks(stocksData);
      } catch (error) {
        console.error('Failed to fetch stocks:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
  }, []);

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Focus search bar when "/" is pressed
      if (event.key === '/' && document.activeElement !== searchInputRef.current) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Handle clicking outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter stocks based on search query with prioritization
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredStocks([]);
      return;
    }

    const query = searchQuery.toLowerCase();

    // Categorize matches with priority
    const symbolStartsWithMatches = stocks.filter(stock =>
      stock.symbol.toLowerCase().startsWith(query)
    ).sort((a, b) => a.symbol.localeCompare(b.symbol));

    const nameStartsWithMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      stock.name.toLowerCase().startsWith(query)
    ).sort((a, b) => a.name.localeCompare(b.name));

    const symbolContainsMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      !stock.name.toLowerCase().startsWith(query) &&
      stock.symbol.toLowerCase().includes(query)
    ).sort((a, b) => a.symbol.localeCompare(b.symbol));

    const nameContainsMatches = stocks.filter(stock =>
      !stock.symbol.toLowerCase().startsWith(query) &&
      !stock.name.toLowerCase().startsWith(query) &&
      !stock.symbol.toLowerCase().includes(query) &&
      stock.name.toLowerCase().includes(query)
    ).sort((a, b) => a.name.localeCompare(b.name));

    // Combine results in priority order - show all results, no limit
    const filtered = [
      ...symbolStartsWithMatches,
      ...nameStartsWithMatches,
      ...symbolContainsMatches,
      ...nameContainsMatches
    ];

    setFilteredStocks(filtered);
  }, [searchQuery, stocks]);

  const handleStockSelect = (stock: Stock) => {
    setSearchQuery('');
    navigate(`/stock/${stock.symbol}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Select the first result when Enter is pressed
    if (filteredStocks.length > 0) {
      handleStockSelect(filteredStocks[0]);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key to select first result
    if (e.key === 'Enter' && filteredStocks.length > 0) {
      e.preventDefault();
      handleStockSelect(filteredStocks[0]);
    }
  };

  const commonPillHeight = '40px';
  const commonBorderRadius = '20px';

  return (
    <>
      {/* Top Navigation Bar */}
      <Navbar 
        expand="lg" 
        style={{
          background: isDarkMode ? 'rgba(26, 26, 26, 0.95)' : 'rgba(26, 26, 26, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.3)',
          position: 'sticky',
          top: 0,
          zIndex: 999,
          padding: '16px 0'
        }}
        variant="dark"
      >
        <Container fluid className="px-4">
          {/* Home Icon in Pill */}
          <Link
            to="/"
            className="d-flex align-items-center justify-content-center text-decoration-none me-4"
            style={{
              width: commonPillHeight,
              height: commonPillHeight,
              borderRadius: commonBorderRadius,
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <FaHome size={18} />
          </Link>
          
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            {/* Left Navigation Items - Outer Pill Container */}
            <Nav className="me-auto">
              <div
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: commonBorderRadius,
                  padding: '4px',
                  display: 'flex',
                  position: 'relative',
                  height: commonPillHeight
                }}
              >
                {/* Navigation Pills */}
                {[
                  { path: '/portfolios', label: 'Portfolios' },
                  { path: '/stocks', label: 'Stocks' },
                  { path: '/transactions', label: 'Transactions' }
                ].map((item, index) => (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      background: location.pathname === item.path 
                        ? '#007bff'
                        : 'transparent',
                      color: location.pathname === item.path 
                        ? '#fff' 
                        : 'rgba(255,255,255,0.8)',
                      border: 'none',
                      borderRadius: `${parseInt(commonBorderRadius) - 4}px`,
                      padding: '0 16px',
                      height: `${parseInt(commonPillHeight) - 8}px`,
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '90px'
                    }}
                    onMouseEnter={(e) => {
                      if (location.pathname !== item.path) {
                        e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (location.pathname !== item.path) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </Nav>

            {/* Center - Search Bar */}
            <div className="mx-auto" style={{ flex: '0 0 auto', maxWidth: '600px', width: '100%' }}>
              <div ref={searchRef} className="position-relative">
                <form className="d-flex" onSubmit={handleSearchSubmit}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Press '/' to search stocks..."
                    className="form-control"
                    style={{ 
                      width: '100%',
                      height: commonPillHeight,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      border: 'none',
                      borderRadius: commonBorderRadius,
                      padding: '0 20px',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: '400',
                      transition: 'all 0.3s ease'
                    }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    onFocus={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                    }}
                  />
                  <style>
                    {`
                      .form-control::placeholder {
                        color: rgba(255,255,255,0.5) !important;
                        font-weight: 300;
                      }
                    `}
                  </style>
                </form>

                {/* Search Results - Modern Dropdown */}
                {searchQuery.trim() !== '' && (
                  <div
                    className="position-absolute w-100 border-0 rounded-3 shadow-lg"
                    style={{
                      top: '100%',
                      zIndex: 1000,
                      marginTop: '8px',
                      maxHeight: 'calc(100vh - 140px)',
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      backdropFilter: 'blur(20px)',
                      backgroundColor: isDarkMode ? 'rgba(33,37,41,0.95)' : 'rgba(255,255,255,0.95)',
                      border: isDarkMode ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(0,0,0,0.1)'
                    }}
                  >
                    {loading ? (
                      <div className="p-3 text-center text-muted">
                        <div className="spinner-border spinner-border-sm text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                      </div>
                    ) : filteredStocks.length > 0 ? (
                      filteredStocks.map((stock, index) => (
                        <div
                          key={stock.id}
                          className={`p-3 ${index === filteredStocks.length - 1 ? '' : 'border-bottom border-light'}`}
                          style={{
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            borderRadius: index === 0 ? '12px 12px 0 0' : index === filteredStocks.length - 1 ? '0 0 12px 12px' : '0',
                            overflow: 'hidden'
                          }}
                          onClick={() => handleStockSelect(stock)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.1)' : '#f8f9fa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="d-flex align-items-center">
                              <SearchStockLogo symbol={stock.symbol} name={stock.name} />
                              <div>
                                <div className={`fw-bold mb-0 ${isDarkMode ? 'text-light' : 'text-dark'}`} style={{ fontSize: '15px' }}>
                                  {stock.symbol}
                                </div>
                                <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.2' }}>
                                  {stock.name}
                                </div>
                              </div>
                            </div>
                            <div className="text-end">
                              <div className="fw-bold text-success" style={{ fontSize: '15px' }}>
                                ${stock.current_price.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-center text-muted">
                        <small>No stocks found matching "{searchQuery}"</small>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Dark Mode Toggle and Profile */}
            <div className="d-flex align-items-center gap-3 ms-auto">
              {/* Dark Mode Toggle */}
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={toggleDarkMode}
                className="d-flex align-items-center justify-content-center"
                style={{
                  width: commonPillHeight,
                  height: commonPillHeight,
                  borderRadius: commonBorderRadius,
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isDarkMode ? <FaSun size={18} /> : <FaMoon size={18} />}
              </Button>

              {/* Profile */}
              <Link 
                to="/profile" 
                className="d-flex align-items-center text-decoration-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: commonBorderRadius,
                  padding: '0 16px',
                  height: commonPillHeight,
                  transition: 'all 0.3s ease',
                  color: '#fff'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ marginRight: '8px', fontWeight: '500' }}>TheRoaringKitty</span>
                <FaUserCircle size={24} />
              </Link>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  );
};

export default Navigation;
