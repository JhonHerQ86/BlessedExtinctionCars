import React from 'react';
import Logo from './Logo.jsx';

export default function PauseMenu({ onResume, onRestart, onMenu }) {
  return (
    <div className="overlay">
      <div className="panel pause-panel">
        <Logo size="small" />
        <h2>PAUSED</h2>
        <button className="btn btn-primary" onClick={onResume} autoFocus>RESUME</button>
        <button className="btn" onClick={onRestart}>RESTART</button>
        <button className="btn" onClick={onMenu}>MAIN MENU</button>
      </div>
    </div>
  );
}
