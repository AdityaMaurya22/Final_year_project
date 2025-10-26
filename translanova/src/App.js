import React from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Home from './pages/home.js';
import About from './pages/about.js';
import Video from './pages/video.js';
import Audio from './pages/audio.js';
import Testimonial from './pages/testimonial.js';
import Contact from './pages/contact.js';
import Login from './pages/login.js';
import Profile from './pages/profile.js';
import NavBar from './components/navbar.js';
import Footer from './components/footer.js';
import PrivateRoute from './components/PrivateRoute.js';

function Layout() {
  const location = useLocation(); 
  const hideHeaderFooter = location.pathname === "/login";

  return (
    <div>
      {!hideHeaderFooter && <NavBar />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/testimonial" element={<Testimonial />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/video" element={
          <PrivateRoute>
            <Video />
          </PrivateRoute>
        } />
        <Route path="/audio" element={
          <PrivateRoute>
            <Audio />
          </PrivateRoute>
        } />
        <Route path="/profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
      </Routes>
      {!hideHeaderFooter && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
