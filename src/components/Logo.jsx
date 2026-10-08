import React, { useState } from 'react';

const BASE = import.meta.env.BASE_URL || './';
// Tried in order. Put your logo at public/assets/logo.jpg (or logo.png).
const SOURCES = [`${BASE}assets/logo.jpg`, `${BASE}assets/logo.png`];

/** Game logo: uses the provided image directly, "CARS" as subtitle. */
export default function Logo({ size = 'large', showCars = true }) {
  const [idx, setIdx] = useState(0);
  const failed = idx >= SOURCES.length;
  return (
    <div className={`logo logo-${size}`}>
      {!failed ? (
        <img src={SOURCES[idx]} alt="Blessed Extinction" onError={() => setIdx((i) => i + 1)} draggable={false} />
      ) : (
        // Fallback only when no logo file exists at all.
        <div className="logo-fallback">BLESSED EXTINCTION</div>
      )}
      {showCars && <div className="logo-cars">CARS</div>}
    </div>
  );
}
