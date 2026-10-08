import React from 'react';

/** On-screen controls for phones/tablets. Uses pointer events (multi-touch safe). */
function Pad({ input, k, className, children }) {
  const set = (v) => (e) => {
    e.preventDefault();
    if (input) input.setTouch(k, v);
  };
  return (
    <button
      className={`touch-btn ${className}`}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerLeave={set(false)}
      onPointerCancel={set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}

export default function TouchControls({ input }) {
  return (
    <div className="touch-controls">
      <div className="touch-left">
        <Pad input={input} k="left" className="steer">◀</Pad>
        <Pad input={input} k="right" className="steer">▶</Pad>
      </div>
      <div className="touch-right">
        <Pad input={input} k="action" className="nitro">N₂O</Pad>
        <Pad input={input} k="down" className="brake">BRAKE</Pad>
        <Pad input={input} k="up" className="gas">GAS</Pad>
      </div>
    </div>
  );
}
