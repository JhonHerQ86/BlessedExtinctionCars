import { PROGRESSION, WORLD, laneX } from './config.js';
import { clamp, lerp, rand, randInt } from './utils.js';

/**
 * Rival AI. Each rival periodically scores the 4 lanes (obstacles, slower
 * cars, wrecks, lane-change cost, its own aggression toward the player) and
 * steers to the best one. Reaction time and mistake rate depend on `skill`
 * and on race progress. A mild rubber band keeps the pack competitive.
 */
export class AISystem {
  constructor(difficulty) {
    this.diff = difficulty;
  }

  update(engine, dt, progress) {
    const { cars, player } = engine;
    for (const car of cars) {
      if (car.isPlayer || car.destroyed) continue;
      const ai = car.ai;
      const c = car.controls;
      const per = car.personality;

      // Pace: personality × difficulty × progression × rubber band.
      let mul = per.pace * this.diff.aiSpeedMul * (1 + PROGRESSION.aiSpeedBonusEnd * progress);
      const dy = car.y - player.y;
      if (dy < -700) mul += Math.min(0.18, (-dy - 700) / 6000); // catch up hard when behind
      else if (dy > 1800) mul -= Math.min(0.06, (dy - 1800) / 15000);

      // Nitro: rivals boost on clear road, more often when chasing you.
      if (ai.nitro > 0) {
        ai.nitro -= dt;
        mul *= 1.22;
        car.speed += 380 * dt;
        if (Math.random() < dt * 30) engine.particles.fire(car.x, car.y - car.h / 2, 1, car.speed);
      } else {
        ai.nitroCd -= dt;
        if (ai.nitroCd <= 0 && car.lostControl <= 0 && car.speed > 600 && this.blockerAhead(engine, car, car.x, 1400) === null) {
          ai.nitro = 1.3;
          ai.nitroCd = rand(7, 14) * (dy < 0 ? 0.6 : 1) / (0.6 + per.aggression * 0.5);
        }
      }
      car.speedMul = mul;

      if (car.lostControl > 0) {
        c.throttle = false; c.brake = false; c.steer = 0;
        continue;
      }

      ai.decisionTimer -= dt;
      if (ai.mistakeTimer > 0) ai.mistakeTimer -= dt;
      if (ai.decisionTimer <= 0 && ai.mistakeTimer <= 0) {
        ai.decisionTimer = lerp(0.38, 0.12, per.skill) + rand(0, 0.12);
        this.decide(engine, car, progress);
      }

      // Precise steering toward the target lane (sloppier drivers wobble more).
      const tx = laneX(ai.targetLane) + Math.sin(engine.time * 0.8 + ai.wobble) * 8 * (1 - per.skill);
      c.steer = clamp((tx - car.x) / 22, -1, 1);

      // Brake if something is dead ahead within stopping distance (+ margin).
      const stopDist = (car.speed * car.speed) / (2 * car.braking);
      const brakeDist = 60 + stopDist * (1.25 - per.skill * 0.25);
      const block = this.blockerAhead(engine, car, car.x, brakeDist + 200);
      c.brake = block !== null && block < brakeDist;
      c.throttle = !c.brake && car.speed < car.effectiveMaxSpeed() * 0.995;
    }
  }

  /** Distance to the nearest solid thing in a corridor at x ahead of car (or null). */
  blockerAhead(engine, car, x, range) {
    let best = null;
    const half = car.w / 2;
    for (const o of engine.obstacles) {
      if (!o.solid || o.dead) continue;
      const d = o.y - o.h / 2 - (car.y + car.h / 2);
      if (d < -10 || d > range) continue;
      if (Math.abs(o.x - x) < o.w / 2 + half) if (best === null || d < best) best = d;
    }
    for (const other of engine.cars) {
      if (other === car) continue;
      const d = other.y - other.h / 2 - (car.y + car.h / 2);
      if (d < -10 || d > range) continue;
      if (!other.destroyed && other.speed > car.speed * 0.9) continue; // moving away
      if (other.isPlayer && car.personality.aggression > 0.6 && !other.destroyed) continue; // aggressive: ram the player
      if (Math.abs(other.x - x) < other.w / 2 + half) if (best === null || d < best) best = d;
    }
    return best;
  }

  decide(engine, car, progress) {
    const ai = car.ai;
    const per = car.personality;
    const n = WORLD.laneCount;
    const look = 300 + car.speed * 0.95;
    const current = clamp(Math.round((car.x + WORLD.roadHalf) / WORLD.laneWidth - 0.5), 0, n - 1);
    const cost = [0, 0, 0, 0];

    for (let l = 0; l < n; l++) {
      const lx = laneX(l);
      for (const o of engine.obstacles) {
        if (o.dead) continue;
        const d = o.y - car.y;
        if (d < -20 || d > look) continue;
        if (Math.abs(o.x - lx) > o.w / 2 + car.w / 2 + 6) continue;
        if (!o.solid) { cost[l] += 0.4; continue; }
        cost[l] += 4 + (1 - d / look) * 12;
        // Can we physically get there in time? Time to reach it vs time to steer over.
        const tReach = d / Math.max(200, car.speed);
        const tSteer = Math.abs(lx - car.x) / car.steering;
        if (l !== current && tSteer > tReach * 0.8) cost[l] += 25; // too late to swerve into
        cost[l] += o.mass ? o.mass * 2 : 3; // heavy junk is worse to hit
      }
      for (const other of engine.cars) {
        if (other === car) continue;
        const d = other.y - car.y;
        if (d < -70 || d > look * 0.7) continue;
        if (Math.abs(other.x - lx) > other.w / 2 + car.w / 2) continue;
        if (Math.abs(d) < 70 && !other.destroyed) cost[l] += 6; // car alongside: don't swerve into it
        else if (other.destroyed) cost[l] += 10;
        else if (other.isPlayer && per.aggression > 0.6 && d < 260 && d > -40) cost[l] -= per.aggression * 2.2; // go ram the player
        else if (other.speed < car.speed) cost[l] += 2.5 * (1 - d / look);
      }
      // The generator always keeps one lane clear: skilled drivers read it.
      if (engine.obstacleGen.safeLaneAt && l === engine.obstacleGen.safeLaneAt(car.y + look * 0.6)) cost[l] -= 4 * per.skill;
      // Lane change cost, including lanes we must cross.
      cost[l] += Math.abs(l - current) * 1.1;
      cost[l] += Math.random() * 0.6;
    }
    // Crossing through a blocked lane is risky.
    for (let l = 0; l < n; l++) {
      const step = l > current ? -1 : 1;
      for (let k = l + step; k !== current && k >= 0 && k < n; k += step) cost[l] += cost[k] * 0.3;
    }

    let best = current;
    for (let l = 0; l < n; l++) if (cost[l] < cost[best]) best = l;

    // Imperfection: occasionally pick a random lane or react late.
    const mistake = lerp(PROGRESSION.aiMistakeStart, PROGRESSION.aiMistakeEnd, progress) * (1.2 - per.skill * 0.6) * this.diff.aiMistakeMul;
    if (Math.random() < mistake) {
      if (Math.random() < 0.5) best = randInt(0, n - 1);
      else ai.mistakeTimer = rand(0.3, 0.8); // keeps the old target: late reaction
      if (ai.mistakeTimer > 0) return;
    }
    ai.targetLane = best;
  }
}
