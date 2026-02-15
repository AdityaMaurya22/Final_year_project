import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import authService from '../services/authService';
import './navbar.css';

function NavBar() {
    const navigate = useNavigate();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
        const checkAuth = () => {
            setIsAuthenticated(authService.isAuthenticated());
            setCurrentUser(authService.getCurrentUser());
        };

        checkAuth();
        // Re-run when local storage changes
        window.addEventListener('storage', checkAuth);
        return () => window.removeEventListener('storage', checkAuth);
    }, []);

    const handleLogout = () => {
        authService.logout();
        setIsAuthenticated(false);
        setCurrentUser(null);
        navigate('/');
    };

    return (
        <nav className="navbar navbar-expand-sm sticky-top">
            <div className="container-fluid">
                <Link className="navbar-brand" to="/">TRANSLANOVA</Link>

                <button
                    className="navbar-toggler"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapsibleNavbar"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className="collapse navbar-collapse" id="collapsibleNavbar">
                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item">
                            <Link className="nav-link" to="/">Home</Link>
                        </li>
                        <li className="nav-item dropdown">
                            <Link
                                className="nav-link dropdown-toggle text-decoration-none"
                                to="#"
                                role="button"
                                data-bs-toggle="dropdown"
                            >
                                Services
                            </Link>
                            <ul className="dropdown-menu">
                                <li>
                                    <Link className="dropdown-item" to="/audio">Translate Audio</Link>
                                </li>
                                <li>
                                    <Link className="dropdown-item" to="/video">Translate Video</Link>
                                </li>
                            </ul>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/about">About</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/testimonial">Testimonial</Link>
                        </li>
                        <li className="nav-item">
                            <Link className="nav-link" to="/contact">Contact</Link>
                        </li>
                    </ul>
                </div>

                {isAuthenticated ? (
                    <div className="nav-auth-buttons">
                        <button className="profile_btn">
                            <Link className="profile_link" to="/profile">
                                <i className="fa fa-user" aria-hidden="true"></i>
                                <span className="username">{currentUser?.username}</span>
                            </Link>
                        </button>
                        <button className="logout_btn" onClick={handleLogout}>
                            <i className="fa fa-sign-out" aria-hidden="true"></i>
                        </button>
                    </div>
                ) : (
                    <button className="login_btn">
                        <Link className="login_link" to="/login">
                            <i className="fa fa-sign-in" aria-hidden="true"></i>
                            <span>Login</span>
                        </Link>
                    </button>
                )}
            </div>
        </nav>
    );
}

export default NavBar;