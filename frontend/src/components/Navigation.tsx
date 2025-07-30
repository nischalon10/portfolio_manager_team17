import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';

const Navigation: React.FC = () => {
  const location = useLocation();

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
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navigation;
