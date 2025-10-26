import React from 'react';
import './NavButtons.css';

const NavButtons = ({ onPrev, onNext }) => {
  return (
    <div className="nav-buttons">
      <button onClick={onPrev} aria-label="Previous">
        <i className="fa fa-chevron-left" aria-hidden="true"></i>
      </button>
      <button onClick={onNext} aria-label="Next">
        <i className="fa fa-chevron-right" aria-hidden="true"></i>
      </button>
    </div>
  );
};

export default NavButtons;