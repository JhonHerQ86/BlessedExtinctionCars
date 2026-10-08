import { makeCanvas, rand } from './utils.js';

/**
 * Pooled particle system. Particles are pre-allocated once and recycled,
 * so no objects are created per frame during gameplay.
 * Coordinates are world units; rendering flips Y (screen Y = -world Y).
 */

const T_SPARK = 0, T_SMOKE = 1, T_DARKSMOKE = 2, T_FIRE = 3, T_DEBRIS = 4, T_BLOOD = 5, T_DUST = 6, T_FLASH = 7;

function blob(inner, outer) {
  const c = makeCanvas(64, 64);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export class ParticleSystem {
  constructor(max = 800, emitMul = 1) {
    this.max = max;
    this.emitMul = emitMul;
    this.pool = new Array(max);
    for (let i = 0; i < max; i++) {
      this.pool[i] = { on: false, t: 0, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, grow: 0, rot: 0, vr: 0, drag: 0, color: '#fff' };
    }
    this.cursor = 0;
    this.texts = []; // floating texts (few, short-lived)
    this.sprites = {
      smoke: blob('rgba(120,115,110,0.55)', 'rgba(120,115,110,0)'),
      dark: blob('rgba(25,22,20,0.75)', 'rgba(25,22,20,0)'),
      fire: blob('rgba(255,220,120,0.95)', 'rgba(255,60,0,0)'),
      dust: blob('rgba(140,120,95,0.35)', 'rgba(140,120,95,0)'),
      flash: blob('rgba(255,250,220,1)', 'rgba(255,140,40,0)'),
    };
  }

  spawn(t, x, y, vx, vy, life, size, grow = 0, color = '#fff', drag = 0) {
    // Round-robin search for a free slot; overwrite the oldest when full.
    let p = null;
    for (let i = 0; i < this.max; i++) {
      const idx = (this.cursor + i) % this.max;
      if (!this.pool[idx].on) {
        p = this.pool[idx];
        this.cursor = (idx + 1) % this.max;
        break;
      }
    }
    if (!p) {
      p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.max;
    }
    p.on = true; p.t = t; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.grow = grow; p.color = color; p.drag = drag;
    p.rot = Math.random() * 6.28; p.vr = rand(-8, 8);
    return p;
  }

  n(count) {
    return Math.max(1, Math.round(count * this.emitMul));
  }

  sparks(x, y, count = 10, dirX = 0, dirY = 0) {
    for (let i = this.n(count); i > 0; i--) {
      const a = Math.random() * 6.28, s = rand(150, 520);
      this.spawn(T_SPARK, x, y, Math.cos(a) * s + dirX, Math.sin(a) * s + dirY, rand(0.15, 0.45), rand(1.5, 3), 0, Math.random() < 0.5 ? '#ffd27a' : '#fff3c4', 3);
    }
  }

  smoke(x, y, count = 3, dark = false, carSpeed = 0) {
    for (let i = this.n(count); i > 0; i--) {
      this.spawn(dark ? T_DARKSMOKE : T_SMOKE, x + rand(-6, 6), y + rand(-6, 6), rand(-25, 25), carSpeed * 0.55 + rand(-10, 30), rand(0.9, 1.8), rand(10, 18), rand(22, 40), '', 1.2);
    }
  }

  fire(x, y, count = 2, carSpeed = 0) {
    for (let i = this.n(count); i > 0; i--) {
      this.spawn(T_FIRE, x + rand(-10, 10), y + rand(-8, 8), rand(-20, 20), carSpeed * 0.8 + rand(10, 60), rand(0.3, 0.7), rand(10, 18), rand(-10, 6), '', 1);
    }
  }

  dust(x, y, count = 2, carSpeed = 0) {
    for (let i = this.n(count); i > 0; i--) {
      this.spawn(T_DUST, x + rand(-8, 8), y, rand(-30, 30), carSpeed * 0.7, rand(0.4, 0.9), rand(8, 14), rand(20, 40), '', 2);
    }
  }

  debris(x, y, count = 8, color = '#333', carSpeed = 0) {
    for (let i = this.n(count); i > 0; i--) {
      const a = Math.random() * 6.28, s = rand(80, 380);
      this.spawn(T_DEBRIS, x, y, Math.cos(a) * s, Math.sin(a) * s + carSpeed * 0.5, rand(0.6, 1.4), rand(3, 8), 0, Math.random() < 0.6 ? color : '#222', 2.2);
    }
  }

  blood(x, y, count = 10, carSpeed = 0) {
    for (let i = this.n(count); i > 0; i--) {
      const a = Math.random() * 6.28, s = rand(40, 260);
      this.spawn(T_BLOOD, x, y, Math.cos(a) * s, Math.sin(a) * s + carSpeed * 0.6, rand(0.4, 0.9), rand(2, 5), 0, Math.random() < 0.5 ? '#6e0606' : '#a00d0d', 3);
    }
  }

  explosion(x, y, scale = 1, color = '#333', carSpeed = 0) {
    this.spawn(T_FLASH, x, y, 0, carSpeed * 0.3, 0.35, 60 * scale, 260 * scale);
    for (let i = this.n(26 * scale); i > 0; i--) {
      const a = Math.random() * 6.28, s = rand(30, 260) * scale;
      this.spawn(T_FIRE, x, y, Math.cos(a) * s, Math.sin(a) * s + carSpeed * 0.3, rand(0.4, 1.0), rand(16, 30) * scale, rand(-10, 20), '', 2.5);
    }
    this.smoke(x, y, 14 * scale, true, carSpeed * 0.3);
    this.sparks(x, y, 24 * scale);
    this.debris(x, y, 16 * scale, color, carSpeed);
  }

  text(x, y, str, color = '#fff', size = 22) {
    if (this.texts.length > 12) this.texts.shift();
    this.texts.push({ x, y, str, color, size, life: 1.3, max: 1.3 });
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      p.life -= dt;
      if (p.life <= 0) { p.on = false; continue; }
      const d = 1 - Math.min(1, p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.size = Math.max(0.5, p.size + p.grow * dt);
      p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  clear() {
    for (const p of this.pool) p.on = false;
    this.texts.length = 0;
  }

  /** Render all particles. Expects world transform already applied. */
  render(ctx, playerY) {
    const S = this.sprites;
    // Pass 1: normal blending (smoke, debris, blood, dust)
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.on || p.t === T_SPARK || p.t === T_FIRE || p.t === T_FLASH) continue;
      const a = p.life / p.max;
      if (p.t === T_DEBRIS || p.t === T_BLOOD) {
        ctx.globalAlpha = Math.min(1, a * 2);
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, -p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
        ctx.restore();
      } else {
        ctx.globalAlpha = a;
        const img = p.t === T_DARKSMOKE ? S.dark : p.t === T_DUST ? S.dust : S.smoke;
        ctx.drawImage(img, p.x - p.size, -p.y - p.size, p.size * 2, p.size * 2);
      }
    }
    // Pass 2: additive (fire, sparks, flashes)
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 0; i < this.max; i++) {
      const p = this.pool[i];
      if (!p.on) continue;
      const a = p.life / p.max;
      if (p.t === T_FIRE || p.t === T_FLASH) {
        ctx.globalAlpha = Math.min(1, a * 1.4);
        const img = p.t === T_FLASH ? S.flash : S.fire;
        ctx.drawImage(img, p.x - p.size, -p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.t === T_SPARK) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, -p.y);
        ctx.lineTo(p.x - p.vx * 0.03, -p.y + p.vy * 0.03);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Floating texts
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `700 ${t.size}px Oswald, Impact, sans-serif`;
      const yy = -(t.y + (1 - k) * 90 + (playerY !== undefined ? 0 : 0));
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(t.str, t.x, yy);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, yy);
    }
    ctx.globalAlpha = 1;
  }
}
