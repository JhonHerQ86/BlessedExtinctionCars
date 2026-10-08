import { OBSTACLE_PHYSICS, PLAYER, ZOMBIES } from './config.js';
import { DamageSystem } from './DamageSystem.js';
import { overlap } from './utils.js';

/**
 * Arcade AABB collisions:
 *  - car ↔ obstacle (solid = damage + knockback, soft = splat/bump)
 *  - car ↔ car (rear-end transfers momentum, side hits push sideways)
 * A per-pair cooldown prevents damage being applied every frame of contact.
 */
export class CollisionSystem {
  constructor() {
    this.pairCooldown = new Float32Array(16 * 16);
  }

  reset() {
    this.pairCooldown.fill(0);
  }

  update(engine, dt) {
    const cd = this.pairCooldown;
    for (let i = 0; i < cd.length; i++) if (cd[i] > 0) cd[i] -= dt;
    this.carsVsObstacles(engine);
    this.carsVsCars(engine);
  }

  carsVsObstacles(engine) {
    const { cars, obstacles, particles: P, audio } = engine;
    for (const car of cars) {
      if (car.destroyed) continue;
      const b = car.box;
      for (const o of obstacles) {
        if (o.dead || Math.abs(o.y - car.y) > 260) continue;
        const ov = overlap(b, o);
        if (!ov) continue;

        if (!o.solid) {
          // Soft obstacles: zombies and corpses. Bump + blood, no damage.
          if (o.hit) continue;
          o.hit = true;
          if (o.kind === 'zombie') {
            o.dead = true;
            P.blood(o.x, o.y, 22, car.speed);
            engine.road.addSplat(o.x, o.y);
            car.speed *= ZOMBIES.slowdown;
            if (car.isPlayer) {
              car.stats.zombies++;
              // Running zombies over patches the car up a little.
              if (car.hp < car.maxHp) {
                car.hp = Math.min(car.maxHp, car.hp + (ZOMBIES.heal / 100) * car.maxHp);
                P.text(o.x + 30, o.y + 20, `+${ZOMBIES.heal}%`, '#6fff6f', 18);
              }
              audio.splat();
              engine.shake(4);
              if (Math.random() < 0.5) P.text(o.x, o.y + 40, 'SPLAT!', '#c01818', 18);
            }
          } else {
            P.blood(o.x, o.y, 8, car.speed);
            car.speed *= 0.96;
            if (car.isPlayer) engine.shake(2);
          }
          continue;
        }

        // Solid obstacle = pushable body. Momentum is exchanged by mass:
        // light objects get shoved/spun away, heavy ones stop you hard.
        const mc = 1, mo = o.mass, mt = mc + mo, e = OBSTACLE_PHYSICS.restitution;
        const sign = car.x < o.x ? -1 : 1;
        let frontal = false;
        let impact;
        if (ov.oy < ov.ox && car.y < o.y) {
          frontal = true;
          impact = Math.max(0, car.speed - o.vy);
          // Separate by mass ratio (heavy obstacle → car moves back more).
          car.y -= ov.oy * (mo / mt) + 0.5;
          o.y += ov.oy * (mc / mt);
          const vc = car.speed, vo = o.vy;
          car.speed = Math.max(0, (mc * vc + mo * vo - mo * e * (vc - vo)) / mt);
          o.vy = (mc * vc + mo * vo + mc * e * (vc - vo)) / mt;
          // Off-center hits spin the obstacle and deflect it sideways.
          const off = (car.x - o.x) / Math.max(20, o.w / 2);
          o.av += -off * impact * 0.006 / mo;
          o.vx += -off * impact * 0.25 / mo + car.vx * 0.3;
          car.vx += sign * (60 + impact * 0.08 * Math.min(1, mo));
          if (impact > 120) {
            P.sparks(car.x, car.y + b.h / 2, Math.min(18, 4 + impact / 60), 0, car.speed * 0.5);
            P.debris(car.x, car.y + b.h / 2, Math.min(8, 1 + impact / 150), o.color || '#444', o.vy);
          }
        } else if (ov.oy < ov.ox) {
          // Obstacle slid into the car from behind: push the car forward.
          impact = Math.max(0, o.vy - car.speed);
          car.y += ov.oy * (mo / mt) + 0.5;
          o.y -= ov.oy * (mc / mt);
          car.speed += impact * (mo / mt);
          o.vy -= impact * (mc / mt);
        } else {
          // Side contact: shove both apart by mass.
          impact = Math.abs(car.vx - o.vx) + car.speed * 0.1;
          car.x += sign * ov.ox * (mo / mt);
          o.x -= sign * ov.ox * (mc / mt);
          const rv = car.vx - o.vx;
          o.vx += rv * (mc / mt) * (1 + e);
          o.vy += car.speed * 0.15 / mo;
          o.av += -sign * car.speed * 0.001 / mo;
          car.vx = sign * Math.max(80, Math.abs(rv) * (mo / mt));
          car.speed *= 1 - 0.12 * Math.min(1, mo / 2);
          if (impact > 150) P.sparks(car.x - sign * b.w / 2, car.y, 5, 0, car.speed * 0.5);
        }
        // Damage scales with how heavy the thing is (a barricade hurts less than a bus).
        const massK = Math.min(1.3, Math.max(0.3, (mo / mt) * 1.7));

        if (car.isPlayer) {
          const dmg = (frontal ? DamageSystem.amount('obstacleFront', impact) : DamageSystem.amount('obstacleSide', impact)) * massK;
          if (!frontal && impact < 120) continue; // gentle nudges don't hurt
          if (!DamageSystem.damagePlayer(engine, car, dmg, frontal ? PLAYER.invulnerableTime : 0.25)) engine.shake(3);
        } else if (car.obstacleCooldown <= 0 && impact > 120) {
          // Cooldown stops scraping along an obstacle from draining HP every frame.
          car.obstacleCooldown = 0.8;
          DamageSystem.damageCar(engine, car, (frontal ? 6 + impact * 0.012 : 4) * massK);
          if (frontal && Math.random() < 0.4) car.loseControl(0.45);
          if (engine.isNearCamera(car.y)) audio.crash(0.35);
        }
      }
    }
  }

  carsVsCars(engine) {
    const { cars, particles: P, audio } = engine;
    const cd = this.pairCooldown;
    for (let i = 0; i < cars.length; i++) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j++) {
        const b = cars[j];
        if (a.destroyed && b.destroyed) continue;
        if ((a.destroyed && a.destroyedTime > 7) || (b.destroyed && b.destroyedTime > 7)) continue;
        if (Math.abs(a.y - b.y) > 200) continue;
        const ab = a.box, bb = b.box;
        const ov = overlap(ab, bb);
        if (!ov) continue;

        const key = a.id * 16 + b.id;
        const ready = cd[key] <= 0;
        const playerInvolved = a.isPlayer || b.isPlayer;

        // A wreck behaves like a heavy obstacle that can be shoved a bit.
        if (a.destroyed || b.destroyed) {
          const wreck = a.destroyed ? a : b;
          const car = a.destroyed ? b : a;
          const sign = car.x < wreck.x ? -1 : 1;
          const impact = car.speed;
          const front = ov.oy < ov.ox;
          if (front) {
            if (car.y < wreck.y) car.y = wreck.y - (wreck.h + car.h) * 0.47 - 0.5;
            else car.y = wreck.y + (wreck.h + car.h) * 0.47 + 0.5;
            wreck.speed = Math.max(wreck.speed, car.speed * 0.4);
            car.speed *= 0.35;
          } else {
            car.x += sign * ov.ox * 0.7;
            wreck.x -= sign * ov.ox * 0.3;
            car.vx = sign * 160;
            car.speed *= 0.85;
          }
          if (ready) {
            cd[key] = 0.5;
            P.sparks((car.x + wreck.x) / 2, (car.y + wreck.y) / 2, 12);
            if (car.isPlayer) DamageSystem.damagePlayer(engine, car, front ? DamageSystem.amount('wreckFront', impact) : DamageSystem.amount('obstacleSide', impact));
            else DamageSystem.damageCar(engine, car, 12);
          }
          continue;
        }

        if (ov.oy < ov.ox) {
          // Rear-end collision
          const back = a.y < b.y ? a : b;
          const front = back === a ? b : a;
          back.y = front.y - (front.box.h + back.box.h) / 2 - 0.5;
          const rel = back.speed - front.speed;
          if (rel > 0) {
            front.speed += rel * 0.55;
            back.speed -= rel * 0.75;
          }
          // Being hit from behind always registers on the player (even light shunts).
          const playerRammed = front.isPlayer && rel > 25;
          if (ready && (rel > 90 || playerRammed)) {
            cd[key] = playerRammed ? 0.35 : 0.45;
            const k = playerInvolved ? 1 : 0.25;
            P.sparks((a.x + b.x) / 2, back.y + back.h / 2, Math.min(20, 4 + rel / 30), 0, front.speed * 0.5);
            DamageSystem.damageCar(engine, front, rel * 0.09 * k, back);
            DamageSystem.damageCar(engine, back, rel * 0.04 * k, front);
            if (rel > (playerInvolved ? 300 : 500) && !front.isPlayer) front.loseControl(0.7);
            if (playerInvolved) {
              engine.shake(Math.min(16, rel / 40));
              audio.crash(Math.min(1, rel / 600));
              // Rear-ending a rival is mild; being rear-ended hurts more.
              const p = a.isPlayer ? a : b;
              if (p === front) {
                DamageSystem.damagePlayer(engine, p, DamageSystem.amount('rearEndVictim', rel), 0, true);
                if (rel > 250) p.loseControl(0.35); // a hard shunt kicks your tail out
              } else {
                DamageSystem.damagePlayer(engine, p, DamageSystem.amount('rearEndRammer', rel));
              }
            }
          }
        } else {
          // Side collision
          const left = a.x < b.x ? a : b;
          const right = left === a ? b : a;
          left.x -= ov.ox / 2;
          right.x += ov.ox / 2;
          const closing = left.vx - right.vx; // > 0 when moving into each other
          const rammer = left.vx > -right.vx ? left : right; // who drove into whom
          const imp = 140 + Math.max(0, closing) * 0.55;
          const mL = left.maxHp, mR = right.maxHp, mt = mL + mR;
          left.vx = -imp * (mR / mt) * 2;
          right.vx = imp * (mL / mt) * 2;
          left.speed *= 0.97;
          right.speed *= 0.97;
          if (ready) {
            cd[key] = 0.4;
            const k = playerInvolved ? 1 : 0.25;
            const victim = rammer === left ? right : left;
            const power = Math.max(0, closing);
            P.sparks((left.x + right.x) / 2, (left.y + right.y) / 2, Math.min(18, 4 + power / 40));
            DamageSystem.damageCar(engine, victim, (8 + power * 0.07) * k, rammer);
            DamageSystem.damageCar(engine, rammer, 4 * k, victim);
            if (power > (playerInvolved ? 280 : 420) && !victim.isPlayer) victim.loseControl(0.5, victim === left ? -1 : 1);
            if (playerInvolved) {
              engine.shake(Math.min(10, 3 + power / 60));
              audio.crash(Math.min(0.7, 0.2 + power / 800));
              const p = a.isPlayer ? a : b;
              DamageSystem.damagePlayer(engine, p, DamageSystem.amount(p === victim ? 'sideVictim' : 'sideRammer', power));
            }
          }
        }
      }
    }
  }
}
