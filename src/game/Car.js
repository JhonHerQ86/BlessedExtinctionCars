import { CAR_TYPES, WORLD } from './config.js';
import { clamp } from './utils.js';

/**
 * Base vehicle with arcade physics. PlayerCar and EnemyCar extend it.
 * Controls are fed each frame via `controls` = {throttle, brake, steer(-1..1)}.
 */
export class Car {
  constructor(id, type, name, x, y) {
    const spec = CAR_TYPES[type];
    this.id = id;
    this.type = type;
    this.name = name;
    this.spec = spec;
    this.w = spec.w;
    this.h = spec.h;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.speed = 0;
    this.maxSpeed = spec.maxSpeed;
    this.acceleration = spec.accel;
    this.braking = spec.braking;
    this.steering = spec.steering;
    this.hp = spec.hp;
    this.maxHp = spec.hp;
    this.destroyed = false;
    this.destroyedTime = 0;
    this.finished = false;
    this.lostControl = 0; // seconds of spin-out remaining
    this.spinDir = 1;
    this.angle = 0; // visual rotation (radians)
    this.hitFlash = 0;
    this.obstacleCooldown = 0;
    this.grinding = false;
    this.lastHitBy = null;
    this.lastHitTime = -99;
    this.isPlayer = false;
    this.controls = { throttle: false, brake: false, steer: 0 };
    this.speedMul = 1; // temporary multipliers (boost, etc.)
  }

  /** 0 = intact, 1 = wrecked. */
  get damageRatio() {
    return 1 - this.hp / this.maxHp;
  }

  /** Top speed after damage penalties. Overridden by subclasses. */
  effectiveMaxSpeed() {
    return this.maxSpeed * (1 - 0.3 * this.damageRatio) * this.speedMul;
  }

  /** Make the car spin out for `t` seconds. */
  loseControl(t, dir = Math.random() < 0.5 ? -1 : 1) {
    if (this.destroyed) return;
    this.lostControl = Math.max(this.lostControl, t);
    this.spinDir = dir;
  }

  update(dt) {
    const c = this.controls;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.obstacleCooldown -= dt;

    if (this.destroyed) {
      this.destroyedTime += dt;
      this.speed = Math.max(0, this.speed - 900 * dt);
      this.vx *= 1 - Math.min(1, dt * 4);
      if (this.destroyedTime > 7) {
        const edge = (this.x < 0 ? -1 : 1) * (WORLD.roadHalf + 30);
        this.x += (edge - this.x) * Math.min(1, dt * 0.8);
      }
      this.x += this.vx * dt;
      this.y += this.speed * dt;
      return;
    }

    const max = this.effectiveMaxSpeed();
    if (this.lostControl > 0) {
      // Spinning: no input, heavy drag, wobble sideways.
      this.lostControl -= dt;
      this.speed = Math.max(0, this.speed - 700 * dt);
      this.angle += this.spinDir * 9 * dt;
      this.vx += this.spinDir * 260 * dt;
      if (this.lostControl <= 0) this.angle = 0;
    } else {
      if (c.throttle) this.speed += this.acceleration * dt;
      else if (c.brake) this.speed -= this.braking * dt;
      else this.speed -= 140 * dt; // coasting drag
      if (this.speed > max) this.speed = Math.max(max, this.speed - this.acceleration * 1.6 * dt);
      this.speed = clamp(this.speed, 0, 99999);

      // Steering response scales with speed (no turning while stopped).
      const grip = Math.min(1, 0.65 + this.speed / 900);
      const targetVx = c.steer * this.steering * grip;
      this.vx += (targetVx - this.vx) * Math.min(1, dt * 9);
      this.angle = clamp(this.vx / 1400, -0.25, 0.25);
    }

    this.x += this.vx * dt;
    this.y += this.speed * dt;

    // Road edges: grind against the curb / barriers (sparks, slowdown, no damage).
    const limit = WORLD.roadHalf + 18 - this.w / 2;
    this.grinding = false;
    if (this.x > limit || this.x < -limit) {
      this.x = clamp(this.x, -limit, limit);
      this.vx = -this.vx * 0.3;
      this.speed *= 1 - Math.min(1, dt * 1.6);
      this.grinding = this.speed > 120;
    }
  }

  /** Bounding box used by collisions (slightly smaller than sprite). */
  get box() {
    return { x: this.x, y: this.y, w: this.w * 0.9, h: this.h * 0.94 };
  }
}
