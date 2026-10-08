import React from 'react';
import Logo from './Logo.jsx';

export default function MainMenu({ onStart, onNavigate }) {
  return (
    <div className="screen menu-screen">
      <Logo size="large" />
      <nav className="menu-buttons">
        <button className="btn btn-primary" onClick={onStart} autoFocus>START RACE</button>
        <button className="btn" onClick={() => onNavigate('howto')}>HOW TO PLAY</button>
        <button className="btn" onClick={() => onNavigate('options')}>OPTIONS</button>
        <button className="btn" onClick={() => onNavigate('credits')}>CREDITS</button>
      </nav>
      <p className="menu-tag">10 cars. One road. No mercy.</p>
    </div>
  );
}
