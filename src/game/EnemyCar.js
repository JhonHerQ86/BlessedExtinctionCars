import { Car } from './Car.js';

/** AI rival. Holds a personality and the AI's working memory. */
export class EnemyCar extends Car {
  constructor(id, rival, x, y) {
    super(id, rival.type, rival.name, x, y);
    this.personality = rival;
    this.ai = {
      targetLane: 0,
      decisionTimer: 1.2 + Math.random() * 1.2, // hold the grid lane at the start
      cruise: this.maxSpeed,
      mistakeTimer: 0, // while > 0 the AI is "distracted"
      wobble: Math.random() * 10,
      nitro: 0,
      nitroCd: 6 + Math.random() * 8,
    };
  }

  effectiveMaxSpeed() {
    // Damage slows rivals down noticeably (down to 60% top speed).
    return this.maxSpeed * (0.6 + 0.4 * (this.hp / this.maxHp)) * this.speedMul;
  }
}
