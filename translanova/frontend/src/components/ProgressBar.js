import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ step }) => {
  return (
    <div className="progress-container">
      <div className={`progress-dot ${step >= 1 ? 'active' : ''}`} />
      <div className="progress-line" />
      <div className={`progress-dot ${step >= 2 ? 'active' : ''}`} />
      <div className="progress-line" />
      <div className={`progress-dot ${step >= 3 ? 'active' : ''}`} />
    </div>
  );
};

export default ProgressBar;