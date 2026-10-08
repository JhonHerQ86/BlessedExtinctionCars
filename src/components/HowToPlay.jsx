import React from 'react';

export default function HowToPlay({ onBack }) {
  return (
    <div className="screen panel-screen">
      <div className="panel">
        <h2>HOW TO PLAY</h2>
        <p>Race 9 rivals through the ruins. Reach the finish line in <b>1st place</b> to survive the extinction.</p>
        <div className="controls-grid">
          <span className="key">W / ↑</span><span>Accelerate</span>
          <span className="key">S / ↓</span><span>Brake</span>
          <span className="key">A / ←</span><span>Steer left</span>
          <span className="key">D / →</span><span>Steer right</span>
          <span className="key">SPACE</span><span>Nitro boost (costs fuel)</span>
          <span className="key">P / ESC</span><span>Pause</span>
        </div>
        <h3 className="sub">GAMEPAD</h3>
        <div className="controls-grid">
          <span className="key">RT / A</span><span>Accelerate</span>
          <span className="key">LT / B</span><span>Brake</span>
          <span className="key">L-STICK / D-PAD</span><span>Steer (analog)</span>
          <span className="key">X / RB</span><span>Nitro</span>
          <span className="key">START</span><span>Pause</span>
        </div>
        <ul className="rules">
          <li><b>FUEL</b> drains constantly — grab red jerrycans and tanks. Run dry and you're dead meat.</li>
          <li><b>CAR CONDITION</b> is a health bar. Head-on hits at speed hurt the most; scrapes and bumps only a little.</li>
          <li>Obstacles glow <b>orange</b>. Ram rivals to wreck them: side-rams are almost free, getting rear-ended hurts.</li>
          <li>Zombie hordes cross the road every few seconds. They only slow you down: splatter them.</li>
          <li>Grab green <b>REPAIR KITS</b> (+25% car condition).</li>
          <li>The further you go, the faster, denser and deadlier the road becomes.</li>
          <li>On phones use the on-screen pedals and arrows.</li>
        </ul>
        <button className="btn" onClick={onBack} autoFocus>BACK</button>
      </div>
    </div>
  );
}
