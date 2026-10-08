import { CAR_TYPES } from './config.js';
import { makeCanvas, seeded } from './utils.js';

/**
 * Procedural placeholder art, rendered once into offscreen canvases and cached.
 *
 * REPLACING ART: drop a PNG with the matching key into public/assets/<folder>/
 * (e.g. public/assets/cars/player.png, public/assets/obstacles/bus.png).
 * If the file exists it is used automatically instead of the procedural sprite.
 * Sprites are drawn top-down with the FRONT pointing UP.
 */

const RES = 2; // sprite pixels per world unit
const BASE = import.meta.env.BASE_URL || './';

/** Keys that may be overridden by image files, and their folder. */
const OVERRIDES = {
  cars: Object.keys(CAR_TYPES),
  obstacles: ['sedan', 'pickup', 'taxi', 'police', 'ambulance', 'military', 'van', 'bus', 'truck', 'flipped', 'burnt', 'barricade', 'jersey', 'concrete', 'tree', 'pole', 'rubble', 'fuel_can', 'fuel_tank', 'repair_kit'],
  zombies: ['zombie', 'corpse'],
};

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export class SpriteFactory {
  constructor() {
    this.cache = new Map();
    this.images = {};
    this.loadOverrides();
  }

  /** Try loading optional PNG overrides; missing files are silently ignored. */
  loadOverrides() {
    for (const [folder, keys] of Object.entries(OVERRIDES)) {
      for (const key of keys) {
        const img = new Image();
        img.onload = () => {
          this.images[`${folder}/${key}`] = img;
        };
        img.src = `${BASE}assets/${folder}/${key}.png`;
      }
    }
  }

  override(folder, key) {
    return this.images[`${folder}/${key}`] || null;
  }

  cached(key, w, h, draw) {
    let c = this.cache.get(key);
    if (!c) {
      c = makeCanvas(w * RES, h * RES);
      const g = c.getContext('2d');
      g.scale(RES, RES);
      draw(g, w, h);
      this.cache.set(key, c);
    }
    return c;
  }

  /* ------------------------------------------------------------ VEHICLES */

  /** Race car sprite (player & rivals). */
  car(type) {
    const img = this.override('cars', type);
    if (img) return img;
    const s = CAR_TYPES[type];
    return this.cached(`car:${type}`, s.w, s.h, (g, w, h) => drawCar(g, w, h, type, s, 'race', 1));
  }

  /** Abandoned / burnt vehicle used as obstacle. */
  wreck(type, state, seed) {
    const img = this.override('obstacles', state === 'burnt' ? 'burnt' : type);
    if (img) return img;
    const dims = WRECK_DIMS[type];
    return this.cached(`wreck:${type}:${state}:${seed}`, dims.w, dims.h, (g, w, h) => {
      if (type === 'bus') drawBus(g, w, h, seed);
      else if (type === 'truck') drawTruck(g, w, h, seed);
      else {
        const spec = WRECK_STYLES[type] || CAR_TYPES.sedan;
        drawCar(g, w, h, type, spec, 'abandoned', seed);
      }
      if (state === 'burnt') burnOverlay(g, w, h, seed);
      else grime(g, w, h, seed);
    });
  }

  flipped(seed) {
    return this.override('obstacles', 'flipped') || this.cached(`flipped:${seed}`, 48, 88, (g, w, h) => drawFlipped(g, w, h, seed));
  }

  /* ------------------------------------------------------------ PROPS */

  prop(kind, w, h, seed = 1) {
    const img = this.override('obstacles', kind);
    if (img) return img;
    return this.cached(`prop:${kind}:${w}x${h}:${seed}`, w, h, (g) => PROPS[kind](g, w, h, seeded(seed)));
  }

  zombie(frame, seed) {
    const img = this.override('zombies', 'zombie');
    if (img) return img;
    return this.cached(`zombie:${frame}:${seed % 4}`, 26, 26, (g, w, h) => drawZombie(g, w, h, frame, seed % 4));
  }

  corpse(seed) {
    const img = this.override('zombies', 'corpse');
    if (img) return img;
    return this.cached(`corpse:${seed % 6}`, 40, 40, (g, w, h) => drawCorpse(g, w, h, seed % 6));
  }

  fuel(kind) {
    if (kind === 'repair') return this.override('obstacles', 'repair_kit') || this.cached('repair_kit', 34, 34, (g, w, h) => drawRepair(g, w, h));
    const key = kind === 'tank' ? 'fuel_tank' : 'fuel_can';
    return this.override('obstacles', key) || this.cached(key, 30, 36, (g, w, h) => (kind === 'tank' ? drawTank(g, w, h) : drawCan(g, w, h)));
  }

  /** Building roof + road-facing facade. Not cached by key (unique per building). */
  building(w, h, seed, side, burnt) {
    const c = makeCanvas(w, h); // 1px per unit is enough for buildings
    drawBuilding(c.getContext('2d'), w, h, seeded(seed), side, burnt);
    return c;
  }
}

/* ======================================================================= */
/*                             DRAW ROUTINES                               */
/* ======================================================================= */

export const WRECK_DIMS = {
  sedan: { w: 46, h: 84 }, pickup: { w: 48, h: 90 }, taxi: { w: 46, h: 84 }, police: { w: 46, h: 86 },
  ambulance: { w: 52, h: 100 }, military: { w: 54, h: 96 }, van: { w: 50, h: 96 }, bus: { w: 64, h: 176 }, truck: { w: 62, h: 160 },
};
const WRECK_STYLES = {
  sedan: { body: '#55606a', accent: '#2a2f35', trim: '#99a' },
  taxi: { body: '#b89a1c', accent: '#222', trim: '#ffe066' },
  pickup: CAR_TYPES.pickup, police: CAR_TYPES.police, ambulance: CAR_TYPES.ambulance, military: CAR_TYPES.military, van: CAR_TYPES.van,
};

function drawCar(g, w, h, type, s, mode, seed) {
  const rnd = seeded(seed * 97 + type.length);
  // Shadow
  g.fillStyle = 'rgba(0,0,0,0.45)';
  rr(g, 3, 5, w - 2, h - 2, 10);
  g.fill();
  // Wheels
  g.fillStyle = '#0a0a0a';
  const ww = 7, wh = h * 0.17;
  g.fillRect(-1, h * 0.12, ww, wh); g.fillRect(w - ww + 1, h * 0.12, ww, wh);
  g.fillRect(-1, h * 0.7, ww, wh); g.fillRect(w - ww + 1, h * 0.7, ww, wh);

  // Body with lateral shading (gives volume)
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, shade(s.body, 0.55));
  grd.addColorStop(0.35, shade(s.body, 1.15));
  grd.addColorStop(0.65, shade(s.body, 1.0));
  grd.addColorStop(1, shade(s.body, 0.5));
  g.fillStyle = grd;
  rr(g, 2, 1, w - 4, h - 2, type === 'sports' ? 12 : 8);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.6)';
  g.lineWidth = 1;
  g.stroke();

  const glass = (y0, y1, inset0, inset1) => {
    g.beginPath();
    g.moveTo(5 + inset0, y0); g.lineTo(w - 5 - inset0, y0);
    g.lineTo(w - 5 - inset1, y1); g.lineTo(5 + inset1, y1);
    g.closePath();
    const gg = g.createLinearGradient(0, y0, 0, y1);
    gg.addColorStop(0, '#2c3a44'); gg.addColorStop(1, '#0c1216');
    g.fillStyle = gg;
    g.fill();
  };

  let roofTop = h * 0.4, roofBot = h * 0.66;
  if (type === 'van' || type === 'ambulance') { roofTop = h * 0.26; roofBot = h * 0.96; }
  if (type === 'pickup') { roofTop = h * 0.34; roofBot = h * 0.52; }
  if (type === 'sports') { roofTop = h * 0.42; roofBot = h * 0.62; }
  if (type === 'military') { roofTop = h * 0.34; roofBot = h * 0.62; }

  // Windshield + roof + rear window
  glass(roofTop - h * 0.12, roofTop, 3, 1);
  g.fillStyle = shade(s.body, 0.85);
  g.fillRect(6, roofTop, w - 12, roofBot - roofTop);
  if (type !== 'van' && type !== 'ambulance' && type !== 'pickup') glass(roofBot, roofBot + h * 0.07, 1, 3);
  // Side windows
  g.fillStyle = '#121a20';
  g.fillRect(4, roofTop + 2, 2.5, roofBot - roofTop - 4);
  g.fillRect(w - 6.5, roofTop + 2, 2.5, roofBot - roofTop - 4);

  // Headlights / taillights
  g.fillStyle = mode === 'race' ? (type === 'player' ? '#ff5a3a' : '#fff4c0') : '#5a5640';
  g.fillRect(5, 1.5, 8, 3); g.fillRect(w - 13, 1.5, 8, 3);
  g.fillStyle = mode === 'race' ? '#d01010' : '#401010';
  g.fillRect(5, h - 4, 8, 2.5); g.fillRect(w - 13, h - 4, 8, 2.5);

  // Archetype details
  switch (type) {
    case 'player': {
      g.fillStyle = s.accent;
      g.fillRect(w / 2 - 7, 3, 4, h - 6); g.fillRect(w / 2 + 3, 3, 4, h - 6);
      // Front ram spikes
      g.fillStyle = '#9a9a9a';
      for (let i = 0; i < 4; i++) {
        const x = 7 + i * ((w - 14) / 3);
        g.beginPath(); g.moveTo(x - 3, 2); g.lineTo(x, -5); g.lineTo(x + 3, 2); g.fill();
      }
      // Skull emblem on roof
      g.fillStyle = '#e8e2d0';
      g.beginPath(); g.arc(w / 2, (roofTop + roofBot) / 2 - 2, 6, 0, 6.28); g.fill();
      g.fillRect(w / 2 - 4, (roofTop + roofBot) / 2 + 2, 8, 5);
      g.fillStyle = '#000';
      g.beginPath(); g.arc(w / 2 - 2.4, (roofTop + roofBot) / 2 - 2, 1.8, 0, 6.28); g.arc(w / 2 + 2.4, (roofTop + roofBot) / 2 - 2, 1.8, 0, 6.28); g.fill();
      // Exhausts
      g.fillStyle = '#555';
      g.fillRect(8, h - 1, 4, 3); g.fillRect(w - 12, h - 1, 4, 3);
      break;
    }
    case 'muscle':
      g.fillStyle = s.accent;
      g.fillRect(w / 2 - 6, 2, 4, h - 4); g.fillRect(w / 2 + 2, 2, 4, h - 4);
      g.fillStyle = '#222'; g.fillRect(w / 2 - 5, h * 0.12, 10, h * 0.1); // hood scoop
      break;
    case 'pickup':
      g.fillStyle = shade(s.body, 0.5);
      g.fillRect(6, h * 0.56, w - 12, h * 0.39);
      g.strokeStyle = shade(s.body, 0.35); g.lineWidth = 1;
      for (let y = h * 0.6; y < h * 0.94; y += 6) { g.beginPath(); g.moveTo(7, y); g.lineTo(w - 7, y); g.stroke(); }
      break;
    case 'sports':
      g.fillStyle = '#111'; g.fillRect(3, h - 9, w - 6, 4); // spoiler
      g.fillStyle = s.trim; g.fillRect(w / 2 - 1.5, 2, 3, roofTop - h * 0.12);
      break;
    case 'police':
      g.fillStyle = s.accent;
      g.fillRect(2, h * 0.38, 4, h * 0.3); g.fillRect(w - 6, h * 0.38, 4, h * 0.3);
      g.fillStyle = '#d8d8d8'; g.fillRect(8, roofTop + 4, w - 16, roofBot - roofTop - 8);
      g.fillStyle = '#c00'; g.fillRect(8, roofTop + 6, (w - 16) / 2, 5);
      g.fillStyle = '#0040e0'; g.fillRect(w / 2, roofTop + 6, (w - 16) / 2, 5);
      break;
    case 'ambulance':
      g.fillStyle = '#eee'; g.fillRect(6, roofTop + 4, w - 12, roofBot - roofTop - 8);
      g.fillStyle = s.accent;
      g.fillRect(w / 2 - 3, h * 0.5, 6, 20); g.fillRect(w / 2 - 10, h * 0.5 + 7, 20, 6);
      g.fillStyle = '#c00'; g.fillRect(8, roofTop + 1, w - 16, 4);
      break;
    case 'military': {
      for (let i = 0; i < 14; i++) {
        g.fillStyle = i % 2 ? '#24301a' : '#5a5a3a';
        g.beginPath(); g.ellipse(4 + rnd() * (w - 8), 4 + rnd() * (h - 8), 3 + rnd() * 5, 2 + rnd() * 4, rnd() * 3, 0, 6.28); g.fill();
      }
      g.fillStyle = '#111'; g.beginPath(); g.arc(w / 2, h - 6, 7, 0, 6.28); g.fill(); // spare tire
      break;
    }
    case 'suv':
      g.strokeStyle = '#222'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(9, roofTop + 2); g.lineTo(9, roofBot - 2); g.moveTo(w - 9, roofTop + 2); g.lineTo(w - 9, roofBot - 2); g.stroke();
      break;
    case 'taxi':
      g.fillStyle = '#111'; g.fillRect(w / 2 - 8, (roofTop + roofBot) / 2 - 3, 16, 6);
      g.fillStyle = '#222';
      for (let x = 3; x < w - 3; x += 6) g.fillRect(x, h * 0.5, 3, 3);
      break;
    case 'van':
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(w / 2 - 0.5, roofTop + 4, 1, roofBot - roofTop - 8);
      break;
    default:
      break;
  }
}

function grime(g, w, h, seed) {
  const r = seeded(seed * 13 + 7);
  g.fillStyle = 'rgba(30,24,18,0.45)';
  rr(g, 2, 1, w - 4, h - 2, 8); g.fill();
  for (let i = 0; i < 12; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(110,55,20,0.55)' : 'rgba(10,8,6,0.5)';
    g.beginPath(); g.ellipse(4 + r() * (w - 8), 4 + r() * (h - 8), 2 + r() * 6, 2 + r() * 5, r() * 3, 0, 6.28); g.fill();
  }
  // Shattered windshield
  g.strokeStyle = 'rgba(220,230,235,0.55)'; g.lineWidth = 0.6;
  const cx = w / 2 + (r() - 0.5) * 10, cy = h * 0.32;
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 12, cy + Math.sin(a) * 6); g.stroke();
  }
  // Blood smear on some
  if (r() < 0.35) { g.fillStyle = 'rgba(110,8,8,0.7)'; g.beginPath(); g.ellipse(w * r(), h * 0.5, 6, 12, r(), 0, 6.28); g.fill(); }
}

function burnOverlay(g, w, h, seed) {
  const r = seeded(seed * 31 + 3);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(18,12,8,0.82)';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 10; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(120,50,15,0.6)' : 'rgba(60,60,60,0.5)';
    g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 5, 0, 6.28); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}

function drawBus(g, w, h, seed) {
  const r = seeded(seed);
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(4, 6, w, h);
  g.fillStyle = '#0a0a0a';
  [[h * 0.1], [h * 0.78]].forEach(([y]) => { g.fillRect(-1, y, 7, 22); g.fillRect(w - 6, y, 7, 22); });
  g.fillStyle = '#9a7a12'; rr(g, 2, 1, w - 4, h - 2, 6); g.fill();
  g.fillStyle = '#b8942a'; g.fillRect(8, 12, w - 16, h - 24);
  g.fillStyle = '#6f5a10';
  for (let i = 0; i < 4; i++) g.fillRect(14, 24 + i * 36, w - 28, 3);
  g.fillStyle = '#18222a'; g.fillRect(6, 3, w - 12, 9);
  g.fillStyle = '#333'; g.fillRect(w / 2 - 10, h * 0.45, 20, 18); // roof hatch
  if (r() < 0.6) { g.fillStyle = '#000'; g.beginPath(); g.ellipse(w * 0.6, h * 0.3, 10, 14, 0.4, 0, 6.28); g.fill(); }
}

function drawTruck(g, w, h) {
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(4, 6, w, h);
  g.fillStyle = '#0a0a0a';
  [0.08, 0.6, 0.78].forEach((f) => { g.fillRect(-1, h * f, 7, 20); g.fillRect(w - 6, h * f, 7, 20); });
  g.fillStyle = '#5a1c14'; rr(g, 4, 1, w - 8, 40, 6); g.fill();
  g.fillStyle = '#1a2328'; g.fillRect(8, 4, w - 16, 10);
  g.fillStyle = '#6a6458'; g.fillRect(2, 44, w - 4, h - 46);
  g.strokeStyle = '#4a463e'; g.lineWidth = 1.5;
  for (let y = 52; y < h - 4; y += 10) { g.beginPath(); g.moveTo(4, y); g.lineTo(w - 4, y); g.stroke(); }
}

function drawFlipped(g, w, h, seed) {
  const r = seeded(seed);
  g.fillStyle = 'rgba(0,0,0,0.45)'; rr(g, 3, 5, w - 2, h - 2, 8); g.fill();
  g.fillStyle = r() < 0.5 ? '#3a3f44' : '#4a2c22'; rr(g, 2, 1, w - 4, h - 2, 8); g.fill();
  g.fillStyle = '#1c1c1c'; g.fillRect(8, 6, w - 16, h - 12); // chassis
  g.strokeStyle = '#555'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(w / 2, 8); g.lineTo(w / 2, h - 8); g.moveTo(6, h * 0.22); g.lineTo(w - 6, h * 0.22); g.moveTo(6, h * 0.78); g.lineTo(w - 6, h * 0.78); g.stroke();
  g.fillStyle = '#080808';
  [[6, h * 0.22], [w - 6, h * 0.22], [6, h * 0.78], [w - 6, h * 0.78]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 7, 0, 6.28); g.fill(); });
  g.fillStyle = '#3a3a3a';
  [[6, h * 0.22], [w - 6, h * 0.22], [6, h * 0.78], [w - 6, h * 0.78]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 6.28); g.fill(); });
  g.fillStyle = '#666'; g.fillRect(w * 0.65, h * 0.4, 3, h * 0.5); // exhaust
}

function drawZombie(g, w, h, frame, v) {
  const cols = ['#4a5a3a', '#5a4a3a', '#3a3a44', '#5c5a48'];
  const cx = w / 2, cy = h / 2;
  g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(cx + 2, cy + 2, 9, 6, 0, 0, 6.28); g.fill();
  // arms reaching forward (up), alternating
  g.strokeStyle = '#7d8a6a'; g.lineWidth = 3; g.lineCap = 'round';
  const a = frame ? 3 : -3;
  g.beginPath(); g.moveTo(cx - 7, cy); g.lineTo(cx - 8, cy - 9 + a); g.moveTo(cx + 7, cy); g.lineTo(cx + 8, cy - 9 - a); g.stroke();
  g.fillStyle = cols[v]; g.beginPath(); g.ellipse(cx, cy + 1, 9, 5.5, 0, 0, 6.28); g.fill();
  g.fillStyle = '#8f9c78'; g.beginPath(); g.arc(cx, cy - 1, 4.5, 0, 6.28); g.fill();
  g.fillStyle = '#5a0a0a'; g.fillRect(cx - 3, cy + 1, 4, 3);
}

function drawCorpse(g, w, h, v) {
  const r = seeded(v * 77 + 5);
  g.translate(w / 2, h / 2);
  g.rotate(r() * 6.28);
  g.fillStyle = 'rgba(90,6,6,0.75)';
  g.beginPath(); g.ellipse(2, 3, 16, 11, 0.3, 0, 6.28); g.fill();
  const cloth = ['#2a2a30', '#3a2a22', '#22303a', '#3a3a2a', '#402020', '#2a2a2a'][v];
  g.strokeStyle = cloth; g.lineWidth = 4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-3, 4); g.lineTo(-8, 15); g.moveTo(3, 4); g.lineTo(6, 15); // legs
  g.moveTo(-5, -4); g.lineTo(-13, 2 + r() * 6); g.moveTo(5, -4); g.lineTo(12, -8 + r() * 6); g.stroke(); // arms
  g.fillStyle = cloth; g.beginPath(); g.ellipse(0, 0, 6.5, 8, 0, 0, 6.28); g.fill();
  g.fillStyle = '#8a7a6a'; g.beginPath(); g.arc(0, -11, 4, 0, 6.28); g.fill();
}

function drawCan(g, w, h) {
  g.fillStyle = 'rgba(255,160,40,0.25)'; g.beginPath(); g.arc(w / 2, h / 2, 17, 0, 6.28); g.fill();
  g.fillStyle = '#7a0a0a'; rr(g, 5, 7, w - 10, h - 10, 4); g.fill();
  g.fillStyle = '#c4161c'; rr(g, 6, 8, w - 12, h - 13, 3); g.fill();
  g.strokeStyle = '#7a0a0a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(9, 12); g.lineTo(w - 9, h - 8); g.moveTo(w - 9, 12); g.lineTo(9, h - 8); g.stroke();
  g.fillStyle = '#222'; g.fillRect(9, 2, 8, 6); g.fillStyle = '#d4b020'; g.fillRect(w - 13, 3, 5, 5);
}

function drawRepair(g, w, h) {
  g.fillStyle = 'rgba(80,255,80,0.25)'; g.beginPath(); g.arc(w / 2, h / 2, 17, 0, 6.28); g.fill();
  g.fillStyle = '#1e5a1e'; rr(g, 4, 7, w - 8, h - 12, 4); g.fill();
  g.fillStyle = '#2f8f2f'; rr(g, 5, 8, w - 10, h - 15, 3); g.fill();
  g.fillStyle = '#222'; g.fillRect(w / 2 - 5, 3, 10, 5); // handle
  g.fillStyle = '#eaffea';
  g.fillRect(w / 2 - 2.5, 11, 5, 15); g.fillRect(w / 2 - 7.5, 16, 15, 5); // cross
}

function drawTank(g, w, h) {
  g.fillStyle = 'rgba(255,160,40,0.25)'; g.beginPath(); g.arc(w / 2, h / 2, 17, 0, 6.28); g.fill();
  g.fillStyle = '#a01010'; g.beginPath(); g.arc(w / 2, h / 2, 13, 0, 6.28); g.fill();
  g.strokeStyle = '#e0b020'; g.lineWidth = 2.5; g.beginPath(); g.arc(w / 2, h / 2, 9, 0, 6.28); g.stroke();
  g.fillStyle = '#222'; g.beginPath(); g.arc(w / 2 + 4, h / 2 - 4, 2.5, 0, 6.28); g.fill();
}

const PROPS = {
  barricade(g, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(3, 4, w, h);
    g.fillStyle = '#3a2a1a'; g.fillRect(0, 0, w, h);
    const sw = 18;
    for (let x = 0; x < w; x += sw * 2) {
      g.fillStyle = '#8a1a14'; g.fillRect(x, 2, sw, h - 4);
      g.fillStyle = '#b8b0a0'; g.fillRect(x + sw, 2, sw, h - 4);
    }
    g.fillStyle = 'rgba(20,14,8,0.5)';
    for (let i = 0; i < 8; i++) g.fillRect(r() * w, r() * h, 6 + r() * 12, 3);
    g.fillStyle = '#555'; g.fillRect(4, -2, 6, h + 4); g.fillRect(w - 10, -2, 6, h + 4);
  },
  jersey(g, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(3, 4, w, h);
    g.fillStyle = '#7a7670'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#9a968e'; g.fillRect(4, h * 0.3, w - 8, h * 0.4);
    g.strokeStyle = '#3a3834'; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.lineTo(x + r() * 10 - 5, h); g.stroke(); }
    g.fillStyle = '#8a1a14'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  },
  concrete(g, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(4, 5, w, h);
    g.fillStyle = '#6a6660'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#85817a'; g.fillRect(3, 3, w - 6, h - 6);
    g.strokeStyle = '#3a3834';
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
    g.fillStyle = 'rgba(160,20,20,0.6)'; g.font = 'bold 12px sans-serif'; g.fillText('X', w / 2 - 4, h / 2 + 4);
  },
  tree(g, w, h, r) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(6, h / 2 - 4, w - 20, 14);
    g.strokeStyle = '#3a2614'; g.lineWidth = 4;
    for (let i = 0; i < 6; i++) {
      const x = w * 0.25 + r() * w * 0.65;
      g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 16, h / 2 + (r() < 0.5 ? -1 : 1) * (8 + r() * 12)); g.stroke();
    }
    g.fillStyle = '#4a2e18'; g.fillRect(0, h / 2 - 7, w * 0.92, 14);
    g.fillStyle = '#2e1c0e'; g.beginPath(); g.arc(4, h / 2, 9, 0, 6.28); g.fill();
    for (let i = 0; i < 9; i++) {
      g.fillStyle = r() < 0.5 ? '#1c2a14' : '#2a3418';
      g.beginPath(); g.arc(w * 0.55 + r() * w * 0.42, h / 2 + (r() - 0.5) * h * 0.9, 8 + r() * 9, 0, 6.28); g.fill();
    }
  },
  pole(g, w, h) {
    g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(4, h / 2, w, 6);
    g.fillStyle = '#4a4a4c'; g.fillRect(0, h / 2 - 4, w, 8);
    g.fillStyle = '#2a2a2c'; g.fillRect(w - 18, h / 2 - 7, 18, 14);
    g.fillStyle = '#9a9060'; g.fillRect(w - 14, h / 2 - 3, 10, 6);
    g.strokeStyle = '#111'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(10, h / 2); g.quadraticCurveTo(w / 2, 0, w - 4, 3); g.stroke();
  },
  rubble(g, w, h, r) {
    for (let i = 0; i < 18; i++) {
      const x = w * 0.15 + r() * w * 0.7, y = h * 0.15 + r() * h * 0.7, s = 5 + r() * 12;
      g.fillStyle = ['#5a5650', '#4a4640', '#6e6a62', '#3a3630'][Math.floor(r() * 4)];
      g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s, y); g.lineTo(x + r() * 4, y + s); g.lineTo(x - s, y + r() * 4); g.closePath(); g.fill();
    }
    g.strokeStyle = '#6a3a1a'; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(r() * w, r() * h); g.lineTo(r() * w, r() * h); g.stroke(); }
  },
};

function drawBuilding(g, w, h, r, side, burnt) {
  const tones = ['#2a2624', '#302a26', '#26282a', '#332c28', '#2c2a2e'];
  g.fillStyle = tones[Math.floor(r() * tones.length)];
  g.fillRect(0, 0, w, h);
  // Parapet
  g.strokeStyle = 'rgba(120,110,100,0.35)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  // Roof tiles / panels
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let y = 14; y < h; y += 22) { g.beginPath(); g.moveTo(6, y); g.lineTo(w - 6, y); g.stroke(); }
  // Roof props: AC units, water tanks
  for (let i = 0; i < 3; i++) {
    if (r() < 0.5) { g.fillStyle = '#4a4744'; g.fillRect(12 + r() * (w - 40), 12 + r() * (h - 40), 16, 12); }
    else { g.fillStyle = '#3a3532'; g.beginPath(); g.arc(20 + r() * (w - 40), 20 + r() * (h - 40), 8, 0, 6.28); g.fill(); }
  }
  // Holes / collapsed parts
  const holes = 1 + Math.floor(r() * 3);
  for (let i = 0; i < holes; i++) {
    const x = r() * w, y = r() * h, s = 14 + r() * 30;
    g.fillStyle = '#080706';
    g.beginPath();
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * 6.28, rr2 = s * (0.5 + r() * 0.5);
      g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr2, y + Math.sin(a) * rr2);
    }
    g.fill();
    g.fillStyle = '#4a4640';
    for (let k = 0; k < 6; k++) g.fillRect(x + (r() - 0.5) * s * 1.6, y + (r() - 0.5) * s * 1.6, 3 + r() * 4, 3 + r() * 4);
  }
  // Scorch marks
  const scorch = burnt ? 4 : r() < 0.4 ? 1 : 0;
  for (let i = 0; i < scorch; i++) {
    const x = r() * w, y = r() * h, s = 30 + r() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, s);
    grd.addColorStop(0, 'rgba(0,0,0,0.8)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(x - s, y - s, s * 2, s * 2);
  }
  // Road-facing facade strip with broken windows and graffiti
  const fw = 16;
  const fx = side === 'left' ? w - fw : 0;
  g.fillStyle = '#1a1716'; g.fillRect(fx, 0, fw, h);
  for (let y = 6; y < h - 10; y += 16) {
    const lit = r();
    g.fillStyle = lit < 0.08 ? '#ff7a1a' : lit < 0.12 ? '#c8b070' : lit < 0.6 ? '#050505' : '#151c20';
    g.fillRect(fx + 4, y, fw - 8, 10);
    if (lit > 0.6) { g.strokeStyle = 'rgba(200,210,220,0.4)'; g.beginPath(); g.moveTo(fx + 4, y); g.lineTo(fx + fw - 4, y + 10); g.stroke(); }
  }
  if (r() < 0.45) {
    const colors = ['#b01818', '#2a8a2a', '#c8c8c8', '#7a2aa0'];
    g.strokeStyle = colors[Math.floor(r() * colors.length)]; g.lineWidth = 2;
    const gy = r() * (h - 60);
    g.beginPath(); g.moveTo(fx + fw / 2, gy);
    for (let k = 0; k < 8; k++) g.lineTo(fx + 3 + r() * (fw - 6), gy + k * 7);
    g.stroke();
  }
}
