/** Small math / random helpers shared across the engine. */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;

/** Deterministic PRNG (mulberry32) — used for sprite variety. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted random pick: entries = [[value, weight], ...]. */
export function weighted(entries) {
  let total = 0;
  for (const e of entries) total += e[1];
  let r = Math.random() * total;
  for (const e of entries) {
    r -= e[1];
    if (r <= 0) return e[0];
  }
  return entries[entries.length - 1][0];
}

/** Creates an offscreen canvas (sprites, patterns). */
export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

/** Axis-aligned overlap test between two {x,y,w,h} centered boxes. */
export function overlap(a, b) {
  const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
  if (ox <= 0) return null;
  const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
  if (oy <= 0) return null;
  return { ox, oy };
}
