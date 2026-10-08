import React from 'react';
import Logo from './Logo.jsx';
import Stats from './Stats.jsx';

const HEADLINES = {
  destroyed: 'CAR DESTROYED',
  fuel: 'OUT OF FUEL',
  finished: 'RACE OVER',
};

export default function GameOver({ result, onRetry, onMenu }) {
  const finished = result.reason === 'finished';
  return (
    <div className="screen end-screen">
      <Logo size="small" />
      <div className="end-headline">{HEADLINES[result.reason] || 'GAME OVER'}</div>
      <div className="end-title blood">{finished ? `YOU FINISHED P${result.position}` : 'GAME OVER'}</div>
      {finished && <p className="muted">Only the first place survives the extinction.</p>}
      <Stats r={result} />
      <div className="menu-buttons row">
        <button className="btn btn-primary" onClick={onRetry} autoFocus>RETRY</button>
        <button className="btn" onClick={onMenu}>MAIN MENU</button>
      </div>
    </div>
  );
}
