import { PLAYER, PROGRESSION, REPAIR, WORLD, laneX } from './config.js';
import { lerp, rand, randInt } from './utils.js';

/**
 * Fuel drain + pickups spread along the road: fuel (red jerrycans, tanks)
 * and repair kits (green, restore car condition). Both get rarer over time.
 */
export class FuelSystem {
  constructor(difficulty) {
    this.diff = difficulty;
    this.pickups = [];
    this.nextY = 1400;
    this.nextRepairY = 5000;
  }

  reset() {
    this.pickups.length = 0;
    this.nextY = 1400;
    this.nextRepairY = 5000;
  }

  /** Lane at y whose center is not blocked by a solid obstacle. */
  freeLaneX(y, obstacles) {
    let lane = randInt(0, WORLD.laneCount - 1);
    for (let tries = 0; tries < 4; tries++) {
      const x = laneX(lane);
      const blocked = obstacles.some((o) => o.solid && Math.abs(o.y - y) < 140 && Math.abs(o.x - x) < o.w / 2 + 30);
      if (!blocked) break;
      lane = (lane + 1) % WORLD.laneCount;
    }
    return laneX(lane);
  }

  /** Drain fuel depending on throttle. */
  drain(player, dt) {
    if (player.destroyed || player.speed < 5 && !player.controls.throttle) return;
    const rate = PLAYER.fuelDrainIdle + (player.controls.throttle ? PLAYER.fuelDrainThrottle : 0);
    player.fuel = Math.max(0, player.fuel - rate * this.diff.fuelDrainMul * dt);
  }

  /** Spawn pickups up to `frontier`, avoiding lanes blocked by nearby obstacles. */
  generate(frontier, progress, obstacles) {
    while (this.nextRepairY < frontier) {
      const y = this.nextRepairY;
      this.pickups.push({ x: this.freeLaneX(y, obstacles), y, w: 34, h: 34, kind: 'repair', bob: Math.random() * 6 });
      this.nextRepairY += lerp(REPAIR.gapStart, REPAIR.gapEnd, progress) * rand(0.8, 1.2);
    }
    while (this.nextY < frontier) {
      const y = this.nextY;
      let lane = randInt(0, WORLD.laneCount - 1);
      for (let tries = 0; tries < 4; tries++) {
        const x = laneX(lane);
        const blocked = obstacles.some((o) => o.solid && Math.abs(o.y - y) < 140 && Math.abs(o.x - x) < o.w / 2 + 30);
        if (!blocked) break;
        lane = (lane + 1) % WORLD.laneCount;
      }
      const kind = Math.random() < 0.7 ? 'can' : 'tank';
      this.pickups.push({ x: laneX(lane) + rand(-14, 14), y, w: 30, h: 36, kind, taken: false, bob: Math.random() * 6 });
      const gap = lerp(PROGRESSION.fuelGapStart, PROGRESSION.fuelGapEnd, progress) * this.diff.fuelSpawnMul;
      this.nextY += gap * rand(0.7, 1.3);
    }
  }

  /** Check pickups against the player; cull those behind `cullY`. */
  update(engine, dt, cullY) {
    const p = engine.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const f = this.pickups[i];
      f.bob += dt * 4;
      if (f.y < cullY) { this.pickups.splice(i, 1); continue; }
      if (!p.destroyed && Math.abs(f.x - p.x) < (f.w + p.w) / 2 && Math.abs(f.y - p.y) < (f.h + p.h) / 2) {
        if (f.kind === 'repair') {
          const before = p.hp;
          p.hp = Math.min(p.maxHp, p.hp + (REPAIR.amount / 100) * p.maxHp);
          p.stats.repairs = (p.stats.repairs || 0) + 1;
          engine.particles.text(f.x, f.y + 30, `+${Math.round(((p.hp - before) / p.maxHp) * 100)}% REPAIR`, '#6fff6f', 24);
          engine.particles.sparks(f.x, f.y, 12, 0, p.speed * 0.6);
          engine.audio.pickup();
          this.pickups.splice(i, 1);
          continue;
        }
        const amount = f.kind === 'tank' ? PLAYER.fuelPickup + 10 : PLAYER.fuelPickup;
        p.fuel = Math.min(p.maxFuel, p.fuel + amount);
        p.stats.fuelCollected++;
        engine.particles.text(f.x, f.y + 30, `+${amount} FUEL`, '#ffcc33', 24);
        engine.particles.sparks(f.x, f.y, 10, 0, p.speed * 0.6);
        engine.audio.pickup();
        this.pickups.splice(i, 1);
      }
    }
  }
}
