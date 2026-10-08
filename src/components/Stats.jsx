import React from 'react';

/** Shared end-of-race statistics block. */
export default function Stats({ r }) {
  const mins = Math.floor(r.time / 60);
  const secs = Math.floor(r.time % 60).toString().padStart(2, '0');
  return (
    <div className="stats">
      <span>POSITION</span><b>{r.position} / {r.total}</b>
      <span>DISTANCE</span><b>{r.distanceKm.toFixed(2)} KM</b>
      <span>CARS DESTROYED</span><b>{r.carsDestroyed}</b>
      <span>FUEL COLLECTED</span><b>{r.fuelCollected}</b>
      <span>REPAIR KITS</span><b>{r.repairs}</b>
      <span>ZOMBIES SPLATTERED</span><b>{r.zombies}</b>
      <span>TOP SPEED</span><b>{r.topSpeed} KM/H</b>
      <span>TIME</span><b>{mins}:{secs}</b>
    </div>
  );
}
