import React from 'react';
import Logo from './Logo.jsx';

/** In-race HUD. Receives a snapshot from the engine ~12 times per second. */
export default function GameHUD({ hud }) {
  const fuelPct = Math.round(hud.fuel * 100);
  const hpPct = Math.round(hud.health * 100);
  const hpClass = hpPct > 60 ? 'ok' : hpPct > 30 ? 'mid' : 'low';
  const ordinal = ['ST', 'ND', 'RD'][hud.position - 1] || 'TH';

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-box hud-left">
          <div className="hud-brand"><Logo size="tiny" showCars={false} /><span>CARS</span></div>
          <div className="hud-label">POSITION</div>
          <div className="hud-pos">{hud.position}<small>{ordinal}</small> <span>/ {hud.total}</span></div>
          <div className="hud-label">DISTANCE</div>
          <div className="hud-value">{hud.distanceKm.toFixed(2)} <small>/ {hud.raceKm} KM</small></div>
          <div className="race-bar"><i style={{ width: `${Math.min(100, (hud.distanceKm / hud.raceKm) * 100)}%` }} /></div>
        </div>

        <div className="hud-box hud-right">
          <div className="hud-label">SPEED</div>
          <div className={`hud-speed ${hud.boost ? 'boost' : ''}`}>{hud.speed}<small> KM/H</small></div>
          <div className="hud-label">FUEL</div>
          <div className={`fuel-bar ${fuelPct < 20 ? 'low' : ''}`}><i style={{ width: `${fuelPct}%` }} /></div>
          <div className="hud-label">CAR CONDITION <b className={`hp-num ${hpClass}`}>{hpPct}%</b></div>
          <div className={`hp-bar ${hpClass}`}><i style={{ width: `${hpPct}%` }} /></div>
        </div>
      </div>

      <ol className="standings">
        {hud.standings.map((c, i) => (
          <li key={c.id} className={`${c.player ? 'me' : ''} ${c.destroyed ? 'dead' : ''}`}>
            <b>{i + 1}</b>
            <span>{c.player ? 'YOU' : c.name}</span>
            {c.destroyed ? <em>✖</em> : <i style={{ width: `${Math.max(0, c.hp) * 26}px` }} />}
          </li>
        ))}
      </ol>

      {hud.countdown !== null && (
        <div className="countdown" key={hud.countdown}>{hud.countdown > 0 ? hud.countdown : 'GO!'}</div>
      )}
      {hud.state === 'destroyed' && <div className="big-alert">CAR DESTROYED</div>}
      {hud.state === 'outOfFuel' && <div className="big-alert">OUT OF FUEL</div>}
      {hud.fuel < 0.2 && hud.state === 'racing' && <div className="warn">LOW FUEL</div>}
    </div>
  );
}
