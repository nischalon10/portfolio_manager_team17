import React from 'react';
import { Navbar, Nav, Container } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { FaUserCircle } from 'react-icons/fa'; 

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
            {/* Search bar and profile icon */}
           <div className="d-flex align-items-center ms-auto">
            {/* Search Bar */}
            <form className="d-flex" style={{ marginRight: '16px' }}>
              <input
                type="text"
                placeholder="Search stocks..."
                className="form-control"
                style={{ width: '300px', marginRight: '102px' }}
              />
            </form>
             {/* Profile Icon and Name */}
              <Link to="/profile" className="d-flex align-items-center text-decoration-none">
         
            {/* <Nav.Link as={Link} to="/profile"> */}
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
