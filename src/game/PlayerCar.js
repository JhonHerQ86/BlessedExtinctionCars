import { Car } from './Car.js';
import { PLAYER } from './config.js';

/** The player's car: adds fuel, health bar, boost and stats. */
export class PlayerCar extends Car {
  constructor(x, y) {
    super(0, 'player', 'YOU', x, y);
    this.isPlayer = true;
    this.fuel = PLAYER.maxFuel;
    this.maxFuel = PLAYER.maxFuel;
    this.hp = this.maxHp = PLAYER.maxHp;
    this.invulnerable = 0;
    this.boostTimer = 0;
    this.stats = { carsDestroyed: 0, fuelCollected: 0, zombies: 0, topSpeed: 0, time: 0 };
  }

  effectiveMaxSpeed() {
    let m = this.maxSpeed * (1 - 0.2 * this.damageRatio) * this.speedMul;
    // Running dry: the engine sputters and top speed collapses.
    if (this.fuel <= 0) m = 0;
    else if (this.fuel < 8) m *= 0.55 + 0.45 * (this.fuel / 8);
    return m;
  }

  update(dt) {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.boostTimer > 0) {
      this.boostTimer -= dt;
      this.speedMul = PLAYER.boostSpeedMul;
      this.speed += 500 * dt;
    } else this.speedMul = 1;
    if (this.fuel <= 0) this.controls.throttle = false;
    super.update(dt);
  }

  tryBoost() {
    if (this.boostTimer > 0 || this.fuel < PLAYER.boostCost + 2 || this.destroyed) return false;
    this.fuel -= PLAYER.boostCost;
    this.boostTimer = PLAYER.boostTime;
    return true;
  }
}
