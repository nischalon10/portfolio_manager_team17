import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Alert, Spinner, InputGroup, FormControl } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import portfolioAPI from '../api';
import { Stock } from '../types';

// Component for stock logo with fallback
const StockLogo: React.FC<{ symbol: string; name: string; size?: number }> = ({
  symbol,
  name,
  size = 32
}) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [hasError, setHasError] = useState(false);
  const [currentSourceIndex, setCurrentSourceIndex] = useState(0);

  // Multiple logo sources with fallbacks
  const logoSources = [
    `https://financialmodelingprep.com/image-stock/${symbol}.png`,
  ];

  function getCompanyDomain(symbol: string): string {
    // Map common symbols to their domain names
    const domainMap: { [key: string]: string } = {
      'AAPL': 'apple',
      'GOOGL': 'google',
      'MSFT': 'microsoft',
      'AMZN': 'amazon',
      'TSLA': 'tesla',
      'META': 'meta',
      'NVDA': 'nvidia',
      'NFLX': 'netflix',
      'DIS': 'disney',
      'INTC': 'intel',
      'UNH': 'unitedhealthgroup',
      'V': 'visa',
      'AMD': 'amd'
    };
    return domainMap[symbol] || symbol.toLowerCase();
  }

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
      // Use custom logo first, then fallback to regular sources
      const customLogoSources = [
        customLogos[symbol],
        ...logoSources
      ];
      setImgSrc(customLogoSources[0]);
    } else {
      setImgSrc(logoSources[0]);
    }

    setHasError(false);
    setCurrentSourceIndex(0);
  }, [symbol]);

  const handleImageError = () => {
    const nextIndex = currentSourceIndex + 1;
    if (nextIndex < logoSources.length) {
      setCurrentSourceIndex(nextIndex);
      setImgSrc(logoSources[nextIndex]);
    } else {
      setHasError(true);
    }
  };

  const getInitials = (companyName: string) => {
    return companyName
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  };

  if (hasError) {
    // Fallback to initials in a circle with better contrast
    return (
      <div
        className="d-flex align-items-center justify-content-center rounded-circle text-white fw-bold"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.4,
          minWidth: size,
          minHeight: size,
          background: 'linear-gradient(45deg, #007bff, #0056b3)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
      width={size}
      height={size}
      onError={handleImageError}
      className="rounded"
      style={{
        objectFit: 'contain',
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    />
  );
}; const Stocks: React.FC = () => {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<Stock[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        setLoading(true);
        const data = await portfolioAPI.getStocks();
        setStocks(data);
        setFilteredStocks(data);

        // Check if there's a search parameter from navigation
        const urlSearchTerm = searchParams.get('search');
        if (urlSearchTerm) {
          setSearchTerm(urlSearchTerm);
          // Clear the URL parameter after setting it
          setSearchParams({});
        }
      } catch (err) {
        setError('Failed to fetch stocks');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStocks();
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredStocks(stocks);
      return;
    }

    const query = searchTerm.toLowerCase();

    // Categorize matches with priority (same logic as Navigation component)
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

    // Combine results in priority order
    const filtered = [
      ...symbolStartsWithMatches,
      ...nameStartsWithMatches,
      ...symbolContainsMatches,
      ...nameContainsMatches
    ];

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
                  <th>Logo</th>
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
                    <td className="text-center">
                      <StockLogo symbol={stock.symbol} name={stock.name} size={40} />
                    </td>
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
