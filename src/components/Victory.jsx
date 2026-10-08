import React from 'react';
import Logo from './Logo.jsx';
import Stats from './Stats.jsx';

export default function Victory({ result, onRetry, onMenu }) {
  return (
    <div className="screen end-screen victory">
      <div className="embers" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 8) * 0.4}s`, animationDuration: `${3 + (i % 5)}s` }} />
        ))}
      </div>
      <Logo size="small" />
      <div className="victory-place">1ST PLACE</div>
      <div className="end-title">YOU SURVIVED THE EXTINCTION</div>
      <Stats r={result} />
      <div className="menu-buttons row">
        <button className="btn btn-primary" onClick={onRetry} autoFocus>RACE AGAIN</button>
        <button className="btn" onClick={onMenu}>MAIN MENU</button>
      </div>
    </div>
  );
}
