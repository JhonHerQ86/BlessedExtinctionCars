import { OBSTACLE_PHYSICS, PROGRESSION, RACE, WORLD, ZOMBIES, laneX } from './config.js';
import { WRECK_DIMS } from './SpriteFactory.js';
import { chance, lerp, pick, rand, randInt, weighted } from './utils.js';

/**
 * Procedural obstacle rows. Rows are always generated beyond a "frontier"
 * well ahead of every car (and off-screen), so nothing pops in on top of the
 * player. Every row leaves at least one lane free.
 *
 * Obstacle shape: { kind, x, y, w, h (collision box), sw, sh (sprite size),
 *                   angle, solid, sprite, burning, color, vx (zombies) }
 */
export class ObstacleGenerator {
  constructor(sprites, road, difficulty) {
    this.sprites = sprites;
    this.road = road;
    this.diff = difficulty;
    this.list = [];
    this.reset();
  }

  reset() {
    this.list.length = 0;
    this.nextY = RACE.safeStartDistance;
    // Safe path: a lane that is ALWAYS clear. It may shift by one lane only,
    // and only after enough distance to steer there at full speed.
    this.safePath = [];
    this.safeLane = randInt(1, 2);
    this.lastSafeShiftY = 0;
  }

  /** Lane index of the safe path at world Y. */
  safeLaneAt(y) {
    let lane = this.safeLane;
    for (let i = this.safePath.length - 1; i >= 0; i--) {
      if (this.safePath[i].y <= y + 200) { lane = this.safePath[i].lane; break; }
    }
    return lane;
  }

  /** Does obstacle `o` overlap the safe corridor at its own Y? */
  blocksSafePath(o) {
    const x = laneX(this.safeLaneAt(o.y));
    const half = 46;
    return o.x + o.w / 2 > x - half && o.x - o.w / 2 < x + half;
  }

  generate(frontier, progress, finishY) {
    while (this.nextY < frontier) {
      const y = this.nextY;
      if (y < finishY - 300 || y > finishY + 600) {
        // Shift the safe lane by at most 1, at least 900 units after the last shift.
        if (y - this.lastSafeShiftY > 900 && chance(0.45)) {
          this.safeLane = Math.max(0, Math.min(WORLD.laneCount - 1, this.safeLane + (chance(0.5) ? 1 : -1)));
          this.lastSafeShiftY = y;
          // During the transition both the old and the new lane must be clear:
          // remove anything in the new lane among the recent rows.
          const nx = laneX(this.safeLane);
          for (let i = this.list.length - 1; i >= 0; i--) {
            const o = this.list[i];
            if (o.solid && o.y > y - 900 && o.x + o.w / 2 > nx - 46 && o.x - o.w / 2 < nx + 46) this.list.splice(i, 1);
          }
        }
        this.safePath.push({ y: y - 400, lane: this.safeLane });
        const before = this.list.length;
        this.spawnRow(y, progress);
        // 1) Nothing may sit on the safe path.
        for (let i = this.list.length - 1; i >= before; i--) {
          if (this.list[i].solid && this.blocksSafePath(this.list[i])) this.list.splice(i, 1);
        }
        // 2) Extra guarantee: at least one whole lane clear around this row.
        while (this.list.length > before && !this.isPassable(y)) this.list.pop();
      }
      const theme = this.road.themeAt(y);
      const gap = lerp(PROGRESSION.obstacleGapStart, PROGRESSION.obstacleGapEnd, progress) / (theme.obstacleMul * this.diff.obstacleMul);
      this.nextY += Math.max(360, gap * rand(0.75, 1.35));
    }
  }

  /** A horde of zombies entering from one or both sides at world Y. */
  spawnHorde(y, progress) {
    const n = randInt(ZOMBIES.hordeSizeMin, Math.round(lerp(ZOMBIES.hordeSizeMin + 1, ZOMBIES.hordeSizeMax, progress)));
    const bothSides = chance(0.35);
    for (let i = 0; i < n; i++) {
      const fromLeft = bothSides ? i % 2 === 0 : i === 0 ? chance(0.5) : this.list[this.list.length - 1].vx > 0;
      this.list.push({
        kind: 'zombie', x: (fromLeft ? -1 : 1) * (WORLD.roadHalf + rand(5, 70)), y: y + rand(-90, 90),
        w: 28, h: 28, sw: 36, sh: 36, angle: 0, solid: false,
        vx: (fromLeft ? 1 : -1) * rand(ZOMBIES.speedMin, ZOMBIES.speedMax), phase: rand(0, 6), seed: randInt(0, 99),
      });
    }
  }

  /**
   * True if, around world Y, at least one WHOLE lane is clear of solid
   * obstacles (including neighbouring rows). Lane-aligned gaps are easy to
   * read for the player and usable by the AI, so no car gets boxed in.
   */
  isPassable(y) {
    const window = 320; // rows closer than this count as one wall
    const half = 40; // clear half-width around a lane center (car is 46 wide)
    for (let l = 0; l < WORLD.laneCount; l++) {
      const x = laneX(l);
      let free = true;
      for (const o of this.list) {
        if (!o.solid || Math.abs(o.y - y) > window + o.h / 2) continue;
        if (o.x + o.w / 2 > x - half && o.x - o.w / 2 < x + half) { free = false; break; }
      }
      if (free) return true;
    }
    return false;
  }

  cull(minY) {
    while (this.safePath.length > 2 && this.safePath[1].y < minY) this.safePath.shift();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const o = this.list[i];
      if (o.y < minY || (o.dead && o.kind !== 'zombie')) this.list.splice(i, 1);
      else if (o.dead && o.kind === 'zombie') this.list.splice(i, 1);
    }
  }

  update(dt, offscreenY = Infinity) {
    const F = OBSTACLE_PHYSICS;
    const fr = 1 - Math.min(1, F.friction * dt);
    const afr = 1 - Math.min(1, F.angularFriction * dt);
    const moving = this.moving || (this.moving = []);
    moving.length = 0;
    for (const o of this.list) {
      if (o.dead) continue;
      if (o.kind === 'zombie') {
        // Crossing zombies shamble across the road.
        o.x += o.vx * dt;
        o.phase += dt * 5;
        if (Math.abs(o.x) > WORLD.roadHalf + 60) o.vx = -o.vx;
        continue;
      }
      if (!o.solid) continue;
      const sp = Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(o.av) * 40;
      if (sp < 1) {
        if (o.vx || o.vy || o.av) {
          o.vx = o.vy = o.av = 0;
          // Came to rest on the safe path where the player can't see it yet → move it aside.
          if (o.y > offscreenY && this.blocksSafePath(o)) {
            const sx = laneX(this.safeLaneAt(o.y));
            o.x = sx + (o.x < sx ? -1 : 1) * (46 + o.w / 2 + 2);
          }
        }
        continue;
      }
      // Pushed bodies slide, spin and slow down by friction.
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vx *= fr; o.vy *= fr; o.av *= afr;
      if (o.av) {
        o.angle += o.av * dt;
        const c = Math.abs(Math.cos(o.angle)), s = Math.abs(Math.sin(o.angle));
        o.w = (o.sw * c + o.sh * s) * 0.86;
        o.h = (o.sw * s + o.sh * c) * 0.86;
      }
      // Curbs / building line stop sliding wrecks.
      const lim = WORLD.roadHalf + WORLD.sidewalk - o.w / 2;
      if (o.x > lim || o.x < -lim) { o.x = Math.max(-lim, Math.min(lim, o.x)); o.vx = -o.vx * 0.3; }
      moving.push(o);
    }
    // Moving bodies knock into other obstacles (momentum shared by mass).
    for (const a of moving) {
      for (const b of this.list) {
        if (b === a || !b.solid || b.dead || Math.abs(b.y - a.y) > 220) continue;
        const ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x);
        const oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
        if (ox <= 0 || oy <= 0) continue;
        const mt = a.mass + b.mass;
        if (oy < ox) {
          const dir = a.y < b.y ? 1 : -1;
          a.y -= dir * oy * (b.mass / mt); b.y += dir * oy * (a.mass / mt);
          const v = (a.vy * a.mass + b.vy * b.mass) / mt;
          a.vy = v; b.vy = v;
        } else {
          const dir = a.x < b.x ? 1 : -1;
          a.x -= dir * ox * (b.mass / mt); b.x += dir * ox * (a.mass / mt);
          const v = (a.vx * a.mass + b.vx * b.mass) / mt;
          a.vx = v; b.vx = v;
        }
      }
    }
  }

  spawnRow(y, progress) {
    const n = WORLD.laneCount;
    const theme = this.road.themeAt(y);
    const danger = progress + (theme.obstacleMul - 1);
    const pattern = weighted([
      ['single', 5],
      ['double', 2 + 3 * danger],
      ['triple', 0.5 + 2.5 * danger],
      ['bus', 0.8 + danger],
      ['barrier', 0.8 + danger],
      ['slalom', 0.6 + danger],
      ['soft', 1.6],
    ]);

    const lanes = [0, 1, 2, 3].sort(() => Math.random() - 0.5);
    switch (pattern) {
      case 'single':
        this.addThing(lanes[0], y);
        break;
      case 'double':
        this.addThing(lanes[0], y);
        this.addThing(lanes[1], y + rand(-40, 40));
        break;
      case 'triple':
        // Blocks 3 lanes, leaves 1 gap
        for (let i = 0; i < 3; i++) this.addThing(lanes[i], y + rand(-30, 30));
        break;
      case 'bus': {
        // Long vehicle across 2 adjacent lanes
        const l = randInt(0, n - 2);
        const type = chance(0.5) ? 'bus' : 'truck';
        this.addWreck(type, (laneX(l) + laneX(l + 1)) / 2, y, Math.PI / 2 + rand(-0.25, 0.25));
        break;
      }
      case 'barrier': {
        // Barricade / fallen tree / pole spanning ~2 lanes, gap elsewhere
        const kind = pick(['barricade', 'tree', 'pole', 'jersey']);
        const leftSide = chance(0.5);
        const span = kind === 'jersey' ? 1 : 2;
        const l = leftSide ? 0 : n - span;
        const cx = span === 2 ? (laneX(l) + laneX(l + 1)) / 2 : laneX(l);
        const dims = { barricade: [190, 26], tree: [210, 40], pole: [180, 20], jersey: [92, 30] }[kind];
        let sx = cx;
        if (kind === 'tree' || kind === 'pole') sx = leftSide ? -WORLD.roadHalf + dims[0] / 2 - 20 : WORLD.roadHalf - dims[0] / 2 + 20;
        this.addProp(kind, sx, y, dims[0], dims[1], leftSide ? 0 : Math.PI, kind === 'barricade' || kind === 'jersey' ? 0 : 0.0);
        break;
      }
      case 'slalom':
        this.addThing(lanes[0], y);
        this.addThing(Math.min(n - 1, Math.max(0, lanes[0] + (lanes[0] < 2 ? 2 : -2))), y + 260);
        break;
      case 'soft': {
        // Corpses or a zombie crossing
        if (chance(PROGRESSION.zombieCrossChance + progress * 0.3)) {
          const count = randInt(1, 3);
          for (let i = 0; i < count; i++) {
            const fromLeft = chance(0.5);
            this.list.push({ kind: 'zombie', x: (fromLeft ? -1 : 1) * (WORLD.roadHalf + rand(10, 60)), y: y + i * 40, w: 22, h: 22, sw: 26, sh: 26, angle: fromLeft ? Math.PI / 2 : -Math.PI / 2, solid: false, vx: (fromLeft ? 1 : -1) * rand(30, 55), phase: 0, seed: randInt(0, 99) });
          }
        } else {
          for (let i = 0; i < randInt(1, 3); i++) {
            this.list.push({ kind: 'corpse', x: laneX(randInt(0, n - 1)) + rand(-30, 30), y: y + rand(-60, 60), w: 26, h: 26, sw: 40, sh: 40, angle: 0, solid: false, seed: randInt(0, 99) });
          }
        }
        break;
      }
      default:
        break;
    }
  }

  /** Random obstacle in a lane: mostly abandoned vehicles. */
  addThing(lane, y) {
    const x = laneX(lane) + rand(-12, 12);
    const kind = weighted([['car', 7], ['flipped', 1.5], ['concrete', 1.2], ['rubble', 1.2]]);
    if (kind === 'car') {
      const type = weighted([['sedan', 3], ['taxi', 1.5], ['pickup', 1.5], ['van', 1.2], ['police', 1], ['ambulance', 0.8], ['military', 0.7]]);
      const sideways = chance(0.25);
      this.addWreck(type, x, y, sideways ? Math.PI / 2 + rand(-0.3, 0.3) : rand(-0.25, 0.25) + (chance(0.3) ? Math.PI : 0));
    } else if (kind === 'flipped') {
      this.list.push(this.make('flipped', x, y, 48, 88, rand(-0.4, 0.4), this.sprites.flipped(randInt(1, 6)), '#3a3f44'));
    } else if (kind === 'concrete') {
      this.addProp('concrete', x, y, 52, 52, rand(-0.3, 0.3));
    } else {
      this.addProp('rubble', x, y, 74, 64, rand(0, 6.28));
    }
  }

  addWreck(type, x, y, angle) {
    const d = WRECK_DIMS[type];
    const burning = chance(0.18);
    const state = burning || chance(0.15) ? 'burnt' : 'abandoned';
    const o = this.make(type, x, y, d.w, d.h, angle, this.sprites.wreck(type, state, randInt(1, 8)), '#3a3a3a');
    o.burning = burning;
    this.list.push(o);
  }

  addProp(kind, x, y, w, h, angle) {
    this.list.push(this.make(kind, x, y, w, h, angle, this.sprites.prop(kind, w, h, randInt(1, 6)), '#555'));
  }

  /** Build an obstacle; collision box is the rotated sprite's AABB, slightly shrunk. */
  make(kind, x, y, sw, sh, angle, sprite, color) {
    const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
    const shrink = 0.86;
    return {
      kind, x, y, sw, sh, angle, sprite, color, solid: true,
      w: (sw * c + sh * s) * shrink,
      h: (sw * s + sh * c) * shrink,
      // Physics state: obstacles are pushable bodies, not walls.
      mass: OBSTACLE_PHYSICS.mass[kind] || 1.2,
      vx: 0, vy: 0, av: 0,
    };
  }
}
