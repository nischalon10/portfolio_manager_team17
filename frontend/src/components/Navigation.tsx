import React, { useState, useEffect, useRef } from 'react';
import { Navbar, Nav, Container, Card, Row, Col } from 'react-bootstrap';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUserCircle, FaSearch } from 'react-icons/fa';
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
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
    // Form submission is handled by the search results display
    // No need to navigate away, just let the search results show
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand as={Link} to="/">Portfolio Manager</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link
              as={Link}
              to="/"
              active={location.pathname === '/'}
            >
              Dashboard
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/portfolios"
              active={location.pathname === '/portfolios'}
            >
              Portfolios
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/stocks"
              active={location.pathname === '/stocks'}
            >
              Stocks
            </Nav.Link>
            <Nav.Link
              as={Link}
              to="/transactions"
              active={location.pathname === '/transactions'}
            >
              Transactions
            </Nav.Link>
          </Nav>
          {/* Search bar and profile icon */}
          <div className="d-flex align-items-center ms-auto">
            {/* Search Bar */}
            <div ref={searchRef} className="position-relative" style={{ marginRight: '16px' }}>
              <form className="d-flex" onSubmit={handleSearchSubmit}>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="Search stocks..."
                    className="form-control"
                    style={{ width: '300px' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className="btn btn-outline-secondary">
                    <FaSearch />
                  </button>
                </div>
              </form>

              {/* Search Results - Dropdown Style */}
              {searchQuery.trim() !== '' && (
                <div
                  className="position-absolute w-100 bg-white border rounded shadow-sm"
                  style={{
                    top: '100%',
                    zIndex: 1000,
                    marginTop: '2px',
                    maxHeight: 'calc(100vh - 120px)',
                    overflowY: 'auto'
                  }}
                >
                  {loading ? (
                    <div className="p-2 text-center text-muted">
                      <div className="spinner-border spinner-border-sm" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : filteredStocks.length > 0 ? (
                    filteredStocks.map((stock, index) => (
                      <div
                        key={stock.id}
                        className={`p-2 border-bottom ${index === filteredStocks.length - 1 ? 'border-bottom-0' : ''}`}
                        style={{
                          cursor: 'pointer',
                          transition: 'background-color 0.2s ease'
                        }}
                        onClick={() => handleStockSelect(stock)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div className="d-flex justify-content-between align-items-center">
                          <div className="d-flex align-items-center">
                            <SearchStockLogo symbol={stock.symbol} name={stock.name} />
                            <div>
                              <div className="fw-bold text-primary mb-0" style={{ fontSize: '14px' }}>
                                {stock.symbol}
                              </div>
                              <div className="text-muted" style={{ fontSize: '12px' }}>
                                {stock.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-end">
                            <div className="fw-bold" style={{ fontSize: '14px' }}>
                              ${stock.current_price.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-2 text-center text-muted">
                      <small>No stocks found matching "{searchQuery}"</small>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Profile Icon and Name */}
            <Link to="/profile" className="d-flex align-items-center text-decoration-none">
              <FaUserCircle size={30} />
              <span style={{ marginLeft: '8px', color: 'white' }}>John Doe</span>
            </Link>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
