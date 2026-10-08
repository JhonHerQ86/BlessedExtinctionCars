import { DIFFICULTY, QUALITY, RACE, RIVALS, UNITS, WORLD, ZOMBIES, laneX } from './config.js';
import { PlayerCar } from './PlayerCar.js';
import { EnemyCar } from './EnemyCar.js';
import { AISystem } from './AISystem.js';
import { CollisionSystem } from './CollisionSystem.js';
import { DamageSystem } from './DamageSystem.js';
import { FuelSystem } from './FuelSystem.js';
import { ObstacleGenerator } from './ObstacleGenerator.js';
import { ParticleSystem } from './ParticleSystem.js';
import { RoadGenerator } from './RoadGenerator.js';
import { Renderer } from './Renderer.js';
import { SpriteFactory } from './SpriteFactory.js';
import { InputManager } from './InputManager.js';
import { clamp, lerp, rand } from './utils.js';

/**
 * Game engine: owns the world, runs the fixed-order update pipeline and the
 * requestAnimationFrame loop. Completely independent from React — the UI
 * talks to it through callbacks (onHud, onEnd) and methods (pause, resume).
 *
 * States: countdown → racing → (destroyed | outOfFuel | finished) → ended
 */
let sharedSprites = null; // sprite cache survives restarts

export class GameEngine {
  constructor(canvas, { difficulty = 'normal', options = {}, audio, onHud, onEnd }) {
    this.canvas = canvas;
    this.options = { shake: true, quality: 'high', fog: true, vibration: true, music: 'bandcamp', ...options };
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.audio = audio;
    this.onHud = onHud || (() => {});
    this.onEnd = onEnd || (() => {});

    sharedSprites = sharedSprites || new SpriteFactory();
    this.sprites = sharedSprites;
    const q = QUALITY[this.options.quality] || QUALITY.high;
    this.particles = new ParticleSystem(q.maxParticles, q.emitMul);
    this.road = new RoadGenerator(this.sprites);
    this.obstacleGen = new ObstacleGenerator(this.sprites, this.road, this.diff);
    this.fuel = new FuelSystem(this.diff);
    this.ai = new AISystem(this.diff);
    this.collisions = new CollisionSystem();
    this.renderer = new Renderer(canvas, this.sprites);
    this.input = new InputManager();

    this.finishY = RACE.lengthKm * 1000 / UNITS.metersPerUnit;
    this.raf = 0;
    this.paused = false;
    this.loop = this.loop.bind(this);
    this.handleResize = this.handleResize.bind(this);
  }

  get obstacles() {
    return this.obstacleGen.list;
  }

  /* ------------------------------------------------------------ LIFECYCLE */

  start() {
    this.input.attach();
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
    this.reset();
    this.audio.startEngine();
    if (this.options.music === 'builtin') this.audio.startMusic();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    window.removeEventListener('resize', this.handleResize);
    this.audio.stopAll();
  }

  pause() {
    if (this.paused || this.state === 'ended') return;
    this.paused = true;
    this.audio.suspend();
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.audio.resume();
    this.last = performance.now();
  }

  handleResize() {
    const parent = this.canvas.parentElement;
    const w = parent ? parent.clientWidth : window.innerWidth;
    const h = parent ? parent.clientHeight : window.innerHeight;
    this.renderer.resize(w, h);
  }

  reset() {
    this.time = 0;
    this.state = 'countdown';
    this.countdown = RACE.countdownSeconds + 0.6;
    this.lastCount = -1;
    this.goTimer = 0;
    this.stuckTimer = 0;
    this.stateTimer = 0;
    this.endReason = null;
    this.damageFlash = 0;
    this.shakeAmt = 0;
    this.hudTimer = 0;
    this.zombieSoundTimer = 4;
    this.hordeTimer = rand(ZOMBIES.hordeIntervalMin, ZOMBIES.hordeIntervalMax);
    this.finishOrder = [];
    this.particles.clear();
    this.road.reset();
    this.obstacleGen.reset();
    this.fuel.reset();
    this.collisions.reset();

    // Starting grid: 3 rows (4,4,2). Player starts in the middle of the pack.
    this.cars = [];
    const slots = [];
    for (let row = 0; row < 3; row++) for (let l = 0; l < WORLD.laneCount; l++) slots.push({ x: laneX(l), y: -row * 150 });
    const playerSlot = 5; // row 2, lane 2
    this.player = new PlayerCar(slots[playerSlot].x, slots[playerSlot].y);
    this.cars.push(this.player);
    let s = 0;
    RIVALS.slice(0, RACE.rivals).forEach((r, i) => {
      if (s === playerSlot) s++;
      const car = new EnemyCar(i + 1, r, slots[s].x, slots[s].y);
      car.ai.targetLane = s % WORLD.laneCount;
      this.cars.push(car);
      s++;
    });
    this.camera = { x: 0, y: this.player.y, shakeX: 0, shakeY: 0 };
    this.ranking = this.cars.slice();
    this.ensureWorld();
  }

  /* ------------------------------------------------------------ HELPERS */

  shake(amount) {
    if (this.options.shake) this.shakeAmt = Math.min(36, Math.max(this.shakeAmt, amount));
  }

  flashDamage(k = 1) {
    this.damageFlash = Math.max(this.damageFlash, 0.3 + 0.7 * k);
  }

  vibrate(ms) {
    if (this.options.vibration && navigator.vibrate) {
      try { navigator.vibrate(ms); } catch { /* unsupported */ }
    }
  }

  isNearCamera(y) {
    return Math.abs(y - this.camera.y) < 900;
  }

  get progress() {
    return clamp(this.player.y / this.finishY, 0, 1);
  }

  onPlayerDestroyed() {
    this.state = 'destroyed';
    this.stateTimer = 0;
    this.endReason = 'destroyed';
    this.audio.stopEngine();
    this.vibrate([120, 60, 200]);
  }

  /* ------------------------------------------------------------ LOOP */

  loop(now) {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05; // avoid huge steps after tab switches
    if (!this.paused) this.update(dt);
    this.renderer.render(this);
  }

  ensureWorld() {
    // Generate ahead of the furthest car, cull behind the last relevant one.
    let maxY = -Infinity;
    for (const c of this.cars) if (!c.destroyed && c.y > maxY) maxY = c.y;
    const viewAhead = this.renderer.view ? this.renderer.view.yTop : this.player.y + 1200;
    const frontier = Math.max(maxY + 1500, viewAhead + 1100); // far enough that generation edits stay off-screen
    const progress = this.progress;
    this.road.ensure(frontier + 400, progress);
    this.obstacleGen.generate(frontier, progress, this.finishY);
    this.fuel.generate(frontier, progress, this.obstacles);

    let minY = this.camera.y - 1400;
    for (const c of this.cars) if (!c.destroyed && c.y - 600 < minY) minY = c.y - 600;
    this.road.cull(Math.min(minY, this.camera.y - 1400));
    this.obstacleGen.cull(minY);
  }

  update(dt) {
    this.time += dt;
    if (this.goTimer > 0) this.goTimer -= dt;
    const p = this.player;
    const actionPressed = this.input.poll();
    const inp = this.input.state;

    // --- State machine
    if (this.state === 'countdown') {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown - 0.6);
      if (n !== this.lastCount && n >= 0 && n <= RACE.countdownSeconds) {
        this.lastCount = n;
        this.audio.beep(n === 0);
      }
      // Revving at the grid
      this.audio.updateEngine(inp.up ? 0.35 : 0.05, inp.up);
      if (this.countdown <= 0.6) {
        this.state = 'racing';
        this.goTimer = 0.9; // keep "GO!" on screen briefly
      }
    }

    const racing = this.state === 'racing';
    if (racing) p.stats.time += dt;

    // --- Player controls
    if (racing && !p.destroyed) {
      p.controls.throttle = inp.up;
      p.controls.brake = inp.down;
      const digital = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      p.controls.steer = this.input.steerAxis && !this.input.keys.left && !this.input.keys.right && !this.input.touch.left && !this.input.touch.right
        ? this.input.steerAxis // analog stick: proportional steering
        : digital;
      if (actionPressed && p.tryBoost()) {
        this.particles.text(p.x, p.y + 70, 'NITRO!', '#ff5a1a', 24);
        this.audio.nitroVoice();
        this.shake(6);
      }
      if (inp.down && p.speed > 500) this.audio.brake();
    } else {
      p.controls.throttle = false;
      p.controls.brake = this.state !== 'countdown';
      p.controls.steer = 0;
    }

    // --- Simulation (frozen during countdown)
    if (this.state !== 'countdown') {
      this.ai.update(this, dt, this.progress);
      for (const c of this.cars) {
        if (c.finished && !c.isPlayer) { c.controls.throttle = false; c.controls.brake = true; }
        c.update(dt);
      }
      this.obstacleGen.update(dt, this.renderer.view ? this.renderer.view.yTop + 50 : Infinity);
      this.collisions.update(this, dt);
      if (racing) this.fuel.drain(p, dt);
    }
    this.fuel.update(this, dt, this.camera.y - 1200);
    this.road.update(dt);
    this.ensureWorld();

    // --- Effects
    for (const c of this.cars) DamageSystem.updateVisuals(this, c, dt);
    this.emitAmbient(dt);
    this.particles.update(dt);
    if (p.boostTimer > 0 && Math.random() < dt * 40) this.particles.fire(p.x + rand(-8, 8), p.y - p.h / 2, 1, p.speed);
    if (p.speed > 650 && Math.random() < dt * 20) this.particles.dust(p.x + rand(-20, 20), p.y - p.h / 2, 1, p.speed);

    // --- Race logic
    this.updateRanking();
    for (const c of this.cars) {
      if (!c.finished && !c.destroyed && c.y >= this.finishY) {
        c.finished = true;
        this.finishOrder.push(c);
        if (c.isPlayer) this.onPlayerFinished();
      }
    }

    if (racing && !p.destroyed) this.unstickPlayer(dt);

    // Zombie hordes: spawned just beyond the visible top edge, ahead of the player.
    if (racing) {
      this.hordeTimer -= dt;
      if (this.hordeTimer <= 0 && this.renderer.view) {
        this.hordeTimer = rand(ZOMBIES.hordeIntervalMin, ZOMBIES.hordeIntervalMax);
        this.obstacleGen.spawnHorde(this.renderer.view.yTop + 150, this.progress);
        this.audio.zombie();
      }
    }

    if (racing && p.fuel <= 0 && p.speed < 25 && !p.destroyed) {
      this.state = 'outOfFuel';
      this.stateTimer = 0;
      this.endReason = 'fuel';
      this.audio.stopEngine();
    }

    if (this.state === 'destroyed' || this.state === 'outOfFuel' || this.state === 'finished') {
      this.stateTimer += dt;
      if (this.stateTimer > (this.state === 'finished' ? 2.2 : 2.8)) this.endRace();
    }

    // --- Camera: follows player with slight look-ahead and lateral drift
    const cam = this.camera;
    const look = Math.min(1, p.speed / p.maxSpeed) * 90;
    cam.y = lerp(cam.y, p.y + look, Math.min(1, dt * 10));
    const viewW = this.canvas.width / this.renderer.baseScale;
    cam.x = lerp(cam.x, clamp(p.x * 0.25, -60, 60) * (viewW < 900 ? 1 : 0.3), Math.min(1, dt * 4));
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    cam.shakeX = (Math.random() - 0.5) * this.shakeAmt;
    cam.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    // Subtle high-speed rumble
    if (p.speed > p.maxSpeed * 0.85 && this.options.shake) {
      cam.shakeX += (Math.random() - 0.5) * 1.5;
      cam.shakeY += (Math.random() - 0.5) * 1.5;
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);

    // --- Audio
    if (!p.destroyed && this.state !== 'countdown') this.audio.updateEngine(Math.min(1.2, p.speed / p.maxSpeed), p.controls.throttle);
    this.zombieSoundTimer -= dt;
    if (this.zombieSoundTimer <= 0) {
      this.zombieSoundTimer = rand(5, 11);
      if (racing) this.audio.zombie();
    }

    // --- HUD (throttled to ~12 Hz to keep React cheap)
    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.08;
      this.emitHud();
    }
  }

  /**
   * Safety net against getting wedged: if the player keeps accelerating but
   * barely moves for 1.5 s, slide the car toward the nearest open lane.
   */
  unstickPlayer(dt) {
    const p = this.player;
    if (p.controls.throttle && p.speed < 80 && p.fuel > 0) this.stuckTimer += dt;
    else this.stuckTimer = Math.max(0, this.stuckTimer - dt * 2);
    if (this.stuckTimer < 1.5) return;
    this.stuckTimer = 0;
    let bestX = null;
    for (let l = 0; l < WORLD.laneCount; l++) {
      const x = laneX(l);
      const blocked = this.obstacles.some((o) => o.solid && !o.dead && o.y - o.h / 2 < p.y + 260 && o.y + o.h / 2 > p.y - 60 && Math.abs(o.x - x) < o.w / 2 + p.w / 2 + 4)
        || this.cars.some((c) => c !== p && c.destroyed && c.destroyedTime <= 7 && Math.abs(c.y - p.y) < 160 && Math.abs(c.x - x) < c.w / 2 + p.w / 2);
      if (!blocked && (bestX === null || Math.abs(x - p.x) < Math.abs(bestX - p.x))) bestX = x;
    }
    if (bestX === null) return;
    p.x = bestX;
    p.vx = 0;
    p.invulnerable = Math.max(p.invulnerable, 1);
    this.particles.dust(p.x, p.y, 6, 0);
  }

  /** Fires and burning wrecks emit smoke/flames near the camera. */
  emitAmbient(dt) {
    const v = this.renderer.view;
    if (!v) return;
    for (const seg of this.road.segments) {
      if (seg.y1 < v.yBot || seg.y0 > v.yTop + 300) continue;
      for (const f of seg.fires) {
        if (f.y < v.yBot - 100 || f.y > v.yTop + 300) continue;
        if (Math.random() < dt * 14 * f.size) this.particles.fire(f.x, f.y, 1);
        if (Math.random() < dt * 5 * f.size) this.particles.smoke(f.x, f.y + 10, 1, true);
      }
    }
    for (const o of this.obstacles) {
      if (!o.burning || o.y < v.yBot - 100 || o.y > v.yTop + 300) continue;
      if (Math.random() < dt * 16) this.particles.fire(o.x + rand(-o.w / 3, o.w / 3), o.y + rand(-o.h / 3, o.h / 3), 1);
      if (Math.random() < dt * 5) this.particles.smoke(o.x, o.y, 1, true);
    }
  }

  updateRanking() {
    const order = this.finishOrder;
    this.ranking.sort((a, b) => {
      const fa = order.indexOf(a), fb = order.indexOf(b);
      if (fa >= 0 || fb >= 0) return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb);
      if (a.destroyed !== b.destroyed) return a.destroyed ? 1 : -1;
      return b.y - a.y;
    });
  }

  get playerPosition() {
    return this.ranking.indexOf(this.player) + 1;
  }

  onPlayerFinished() {
    this.state = 'finished';
    this.stateTimer = 0;
    this.endReason = 'finished';
    const pos = this.finishOrder.indexOf(this.player) + 1;
    this.particles.text(this.player.x, this.player.y + 120, pos === 1 ? '1ST PLACE!' : `FINISHED P${pos}`, pos === 1 ? '#ffd23a' : '#ddd', 34);
  }

  endRace() {
    if (this.state === 'ended') return;
    const p = this.player;
    const position = this.endReason === 'finished' ? this.finishOrder.indexOf(p) + 1 : this.playerPosition;
    this.state = 'ended';
    this.audio.stopEngine();
    this.onEnd({
      reason: this.endReason,
      victory: this.endReason === 'finished' && position === 1,
      position,
      total: this.cars.length,
      distanceKm: (Math.max(0, p.y) * UNITS.metersPerUnit) / 1000,
      carsDestroyed: p.stats.carsDestroyed,
      fuelCollected: p.stats.fuelCollected,
      zombies: p.stats.zombies,
      repairs: p.stats.repairs || 0,
      topSpeed: Math.round(p.stats.topSpeed * UNITS.kmhPerUnit),
      time: p.stats.time,
    });
  }

  emitHud() {
    const p = this.player;
    const kmh = Math.round(p.speed * UNITS.kmhPerUnit);
    p.stats.topSpeed = Math.max(p.stats.topSpeed, p.speed);
    this.onHud({
      state: this.state,
      countdown: this.state === 'countdown' ? Math.ceil(this.countdown - 0.6) : this.goTimer > 0 ? 0 : null,
      position: this.playerPosition,
      total: this.cars.length,
      speed: kmh,
      fuel: p.fuel / p.maxFuel,
      health: p.hp / p.maxHp,
      distanceKm: (Math.max(0, p.y) * UNITS.metersPerUnit) / 1000,
      raceKm: RACE.lengthKm,
      boost: p.boostTimer > 0,
      carsDestroyed: p.stats.carsDestroyed,
      standings: this.ranking.map((c) => ({
        id: c.id,
        name: c.name,
        player: c.isPlayer,
        destroyed: c.destroyed,
        finished: c.finished,
        hp: c.hp / c.maxHp,
        progress: clamp(c.y / this.finishY, 0, 1),
      })),
    });
  }
}
