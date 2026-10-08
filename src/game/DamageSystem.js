import { PLAYER } from './config.js';
import { rand } from './utils.js';

/**
 * Damage rules for every car.
 *  - Player: health bar; damage depends on impact type and speed (PLAYER.damage).
 *  - Rivals: HP pool; damaged rivals slow down, smoke and finally explode.
 */
export const DamageSystem = {
  /** Health damage for an impact type (see PLAYER.damage) at a given impact speed. */
  amount(kind, impactSpeed) {
    const d = PLAYER.damage[kind];
    return d.base + Math.max(0, impactSpeed) * d.perSpeed;
  },

  /**
   * Damage the player's health bar. Effects scale with the amount, so light
   * taps barely register and big crashes shake the screen hard.
   * `grace` = seconds of invulnerability afterwards (obstacles only).
   */
  damagePlayer(engine, player, amount, grace = 0, ignoreGrace = false) {
    if (player.destroyed || amount < 0.5) return false;
    if (player.invulnerable > 0 && !ignoreGrace) return false;
    player.hp = Math.max(0, player.hp - amount);
    if (grace) player.invulnerable = grace;
    const k = Math.min(1, amount / 35);
    player.hitFlash = 0.15 + 0.3 * k;
    if (amount >= 8) engine.flashDamage(k);
    engine.shake(3 + 20 * k);
    engine.particles.sparks(player.x, player.y + player.h / 2, 4 + Math.round(16 * k));
    if (amount >= 10) engine.particles.debris(player.x, player.y + player.h / 2, 2 + Math.round(6 * k), player.spec.body, player.speed);
    if (amount >= 5) engine.particles.text(player.x, player.y + 70, `-${Math.round(amount)}`, k > 0.6 ? '#ff2a2a' : '#ff9a5a', 16 + 10 * k);
    engine.audio.crash(0.3 + 0.7 * k);
    if (amount >= 10) engine.vibrate(30 + 70 * k);
    if (player.hp <= 0) this.destroy(engine, player);
    return true;
  },

  /** Apply HP damage to a rival. `attacker` may be the player (for kill credit). */
  damageCar(engine, car, amount, attacker = null) {
    if (car.destroyed || car.isPlayer) return;
    car.hp -= amount;
    car.hitFlash = 0.25;
    if (attacker) {
      car.lastHitBy = attacker;
      car.lastHitTime = engine.time;
    }
    if (car.hp <= 0) {
      car.hp = 0;
      this.destroy(engine, car);
    }
  },

  destroy(engine, car) {
    if (car.destroyed) return;
    car.destroyed = true;
    car.destroyedTime = 0;
    car.lostControl = 0;
    car.angle += rand(-0.6, 0.6);
    engine.particles.explosion(car.x, car.y, car.isPlayer ? 1.6 : 1.2, car.spec.body, car.speed);
    engine.shake(car.isPlayer ? 30 : 12);
    engine.audio.explosion(car.isPlayer ? 1 : 0.7);

    if (car.isPlayer) {
      engine.onPlayerDestroyed();
      return;
    }
    const p = engine.player;
    if (car.lastHitBy === p && engine.time - car.lastHitTime < 3) {
      p.stats.carsDestroyed++;
      engine.particles.text(car.x, car.y + 60, `${car.name} WRECKED!`, '#ff4a2a', 22);
      engine.vibrate(60);
    } else {
      engine.particles.text(car.x, car.y + 60, `${car.name} DOWN`, '#bbb', 18);
    }
  },

  /** Continuous damage visuals: smoke, sparks, fire on wrecks. */
  updateVisuals(engine, car, dt) {
    const P = engine.particles;
    if (car.destroyed) {
      if (car.destroyedTime < 14) {
        if (Math.random() < dt * 22) P.fire(car.x + rand(-12, 12), car.y + rand(-20, 20), 1, car.speed);
        if (Math.random() < dt * 9) P.smoke(car.x, car.y, 1, true, car.speed);
      }
      return;
    }
    const r = car.damageRatio;
    const front = car.y + car.h * 0.35;
    if (r > 0.3 && Math.random() < dt * (6 + r * 16)) P.smoke(car.x + rand(-8, 8), front, 1, r > 0.6, car.speed);
    if (r > 0.6 && Math.random() < dt * 5) P.sparks(car.x, car.y - car.h / 2, 3, 0, car.speed * 0.5);
    if (car.grinding && Math.random() < dt * 40) {
      const side = car.x > 0 ? car.w / 2 : -car.w / 2;
      P.sparks(car.x + side, car.y + rand(-20, 20), 2, 0, car.speed * 0.4);
    }
  },
};
