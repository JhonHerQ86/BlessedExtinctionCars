import { WORLD } from './config.js';
import { pick, rand, randInt, weighted, chance } from './utils.js';

/**
 * Procedural city / road segments. Each segment has a theme that controls
 * decoration density (buildings, corpses, cracks, fires, zombies) and is also
 * queried by the ObstacleGenerator to scale obstacle density.
 *
 * Segment types: normal, destroyed, dangerous, urban, apocalypse.
 */

export const SEGMENT_LENGTH = 1600;

const THEMES = {
  normal: { cracks: 4, blood: 2, corpses: 2, zombies: 3, fires: 0.15, burnt: 0.15, wrecks: 1, obstacleMul: 1.0, fog: 0.15 },
  destroyed: { cracks: 10, blood: 3, corpses: 3, zombies: 3, fires: 0.3, burnt: 0.35, wrecks: 2, obstacleMul: 1.15, fog: 0.22 },
  dangerous: { cracks: 7, blood: 4, corpses: 4, zombies: 4, fires: 0.35, burnt: 0.3, wrecks: 2, obstacleMul: 1.45, fog: 0.2 },
  urban: { cracks: 5, blood: 3, corpses: 3, zombies: 6, fires: 0.4, burnt: 0.3, wrecks: 1, obstacleMul: 1.05, fog: 0.18 },
  apocalypse: { cracks: 12, blood: 7, corpses: 7, zombies: 8, fires: 0.85, burnt: 0.7, wrecks: 3, obstacleMul: 1.3, fog: 0.35 },
};

export class RoadGenerator {
  constructor(sprites) {
    this.sprites = sprites;
    this.segments = [];
    this.splats = [];
    this.reset();
  }

  reset() {
    this.segments.length = 0;
    this.splats.length = 0;
    this.nextY = -SEGMENT_LENGTH;
    this.history = [];
  }

  /** Theme info for world Y (defaults to normal). */
  segmentAt(y) {
    for (const s of this.segments) if (y >= s.y0 && y < s.y1) return s;
    return null;
  }

  themeAt(y) {
    const s = this.segmentAt(y);
    return THEMES[s ? s.type : 'normal'];
  }

  ensure(frontier, progress) {
    while (this.nextY < frontier) {
      this.segments.push(this.makeSegment(this.nextY, progress));
      this.nextY += SEGMENT_LENGTH;
    }
  }

  cull(minY) {
    while (this.segments.length && this.segments[0].y1 < minY) this.segments.shift();
    for (let i = this.splats.length - 1; i >= 0; i--) if (this.splats[i].y < minY) this.splats.splice(i, 1);
  }

  addSplat(x, y) {
    if (this.splats.length > 50) this.splats.shift();
    this.splats.push({ x, y, r: rand(10, 18), rot: rand(0, 6.28) });
  }

  pickType(progress) {
    const p = progress;
    let type;
    for (let tries = 0; tries < 5; tries++) {
      type = weighted([
        ['normal', 4 - 3 * p],
        ['urban', 2.5],
        ['destroyed', 1.5 + 2 * p],
        ['dangerous', 0.8 + 2.5 * p],
        ['apocalypse', 0.4 + 3 * p],
      ]);
      // Avoid the same theme three times in a row.
      const h = this.history;
      if (!(h.length >= 2 && h[h.length - 1] === type && h[h.length - 2] === type)) break;
    }
    this.history.push(type);
    if (this.history.length > 4) this.history.shift();
    return type;
  }

  makeSegment(y0, progress) {
    const type = y0 < 0 ? 'normal' : this.pickType(progress);
    const th = THEMES[type];
    const y1 = y0 + SEGMENT_LENGTH;
    const seg = { y0, y1, type, theme: th, buildings: [], decals: [], props: [], zombies: [], fires: [] };
    const edge = WORLD.roadHalf + WORLD.sidewalk;

    // Buildings on both sides, with alleys and empty lots.
    for (const side of ['left', 'right']) {
      let y = y0 + rand(0, 40);
      while (y < y1 - 60) {
        const len = rand(160, 380);
        const w = rand(200, 360);
        const setback = rand(8, 26);
        const lot = type === 'normal' && chance(0.12);
        if (!lot) {
          const burnt = chance(th.burnt);
          const x = side === 'left' ? -(edge + setback + w) : edge + setback;
          const b = { x, y, w, h: Math.min(len, y1 - y), side, burnt, sprite: null, seed: randInt(1, 1e6) };
          seg.buildings.push(b);
          if (chance(th.fires)) {
            const fx = side === 'left' ? x + w - rand(8, 40) : x + rand(8, 40);
            seg.fires.push({ x: fx, y: y + rand(20, b.h - 20), size: rand(0.7, 1.4) });
          }
        } else {
          seg.props.push({ kind: 'rubble', x: side === 'left' ? -edge - 90 : edge + 90, y: y + len / 2, w: 120, h: 100, seed: randInt(1, 999) });
        }
        y += len + rand(18, 70);
      }
    }

    // Road decals: cracks, blood, potholes, oil.
    for (let i = 0; i < th.cracks; i++) {
      const x = rand(-WORLD.roadHalf + 10, WORLD.roadHalf - 10), y = rand(y0, y1);
      const pts = [x, y];
      let cx = x, cy = y;
      for (let k = 0; k < randInt(3, 6); k++) { cx += rand(-30, 30); cy += rand(-40, 40); pts.push(cx, cy); }
      seg.decals.push({ kind: 'crack', pts, w: rand(1, 2.5) });
    }
    for (let i = 0; i < th.blood; i++) seg.decals.push({ kind: 'blood', x: rand(-WORLD.roadHalf, WORLD.roadHalf), y: rand(y0, y1), r: rand(10, 28), rot: rand(0, 6.28) });
    for (let i = 0; i < Math.ceil(th.cracks / 3); i++) seg.decals.push({ kind: 'pothole', x: rand(-WORLD.roadHalf + 20, WORLD.roadHalf - 20), y: rand(y0, y1), r: rand(8, 18) });
    if (chance(0.5)) seg.decals.push({ kind: 'oil', x: rand(-WORLD.roadHalf, WORLD.roadHalf), y: rand(y0, y1), r: rand(18, 34) });
    if (chance(0.25)) seg.decals.push({ kind: 'skid', x: rand(-150, 150), y: rand(y0, y1), len: rand(80, 200), curve: rand(-40, 40) });

    // Sidewalk props: corpses, crashed wrecks, trash, vegetation, fallen signs.
    const sw = (s) => (s < 0 ? -1 : 1) * (WORLD.roadHalf + rand(8, WORLD.sidewalk - 6));
    for (let i = 0; i < th.corpses; i++) seg.props.push({ kind: 'corpse', x: sw(rand(-1, 1)), y: rand(y0, y1), seed: randInt(0, 99) });
    for (let i = 0; i < th.wrecks; i++) {
      const left = chance(0.5);
      seg.props.push({ kind: 'wreck', type: pick(['sedan', 'taxi', 'police', 'van', 'pickup', 'ambulance']), burnt: chance(th.burnt), x: (left ? -1 : 1) * (WORLD.roadHalf + WORLD.sidewalk + rand(-10, 20)), y: rand(y0 + 60, y1 - 60), rot: (left ? -1 : 1) * rand(1.1, 1.9), seed: randInt(1, 40) });
    }
    for (let i = 0; i < 6; i++) seg.props.push({ kind: 'trash', x: sw(rand(-1, 1)), y: rand(y0, y1), r: rand(3, 7), c: pick(['#1a1a1a', '#2a2a22', '#3a3020']) });
    for (let i = 0; i < 4; i++) seg.props.push({ kind: 'weeds', x: sw(rand(-1, 1)) * rand(1, 1.15), y: rand(y0, y1), r: rand(8, 20) });
    if (chance(0.5)) seg.props.push({ kind: 'sign', x: sw(rand(-1, 1)), y: rand(y0, y1), rot: rand(0, 6.28) });
    if (chance(0.4)) seg.props.push({ kind: 'lamp', x: sw(rand(-1, 1)), y: rand(y0, y1) });

    // Fires on the sidewalk (burning barrels)
    if (chance(th.fires * 0.6)) seg.fires.push({ x: sw(rand(-1, 1)), y: rand(y0, y1), size: 0.6, barrel: true });

    // Walking zombies on sidewalks / lots
    for (let i = 0; i < th.zombies; i++) {
      const groupX = sw(rand(-1, 1)), groupY = rand(y0, y1);
      const n = chance(0.3) ? randInt(2, 4) : 1;
      for (let k = 0; k < n; k++) {
        seg.zombies.push({ x: groupX + rand(-14, 14) * Math.sign(groupX), y: groupY + rand(-30, 30), vx: rand(-6, 6), vy: rand(-18, 18), phase: rand(0, 6), seed: randInt(0, 99), home: groupX });
      }
    }
    return seg;
  }

  /** Animate decorative zombies (stay on their side of the road). */
  update(dt) {
    for (const s of this.segments) {
      for (const z of s.zombies) {
        z.phase += dt * 4;
        z.x += z.vx * dt;
        z.y += z.vy * dt;
        if (Math.abs(z.x - z.home) > 24) z.vx = -z.vx;
        if (Math.random() < dt * 0.3) z.vy = rand(-18, 18);
      }
    }
  }
}
