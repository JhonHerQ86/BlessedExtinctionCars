import React from 'react';
import Logo from './Logo.jsx';

export default function Credits({ onBack }) {
  return (
    <div className="screen panel-screen">
      <div className="panel">
        <Logo size="small" />
        <h2>CREDITS</h2>
        <p>Game design &amp; direction — Blessed Extinction</p>
        <p>Engine, gameplay &amp; procedural art — built with React + HTML5 Canvas</p>
        <p>Audio — synthesized in real time with the Web Audio API (royalty free)</p>
        <p className="muted">Drop your own art and audio in <code>public/assets/</code> to replace the placeholders.</p>
        <button className="btn" onClick={onBack} autoFocus>BACK</button>
      </div>
    </div>
  );
}
