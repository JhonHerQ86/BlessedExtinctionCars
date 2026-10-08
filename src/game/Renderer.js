import { WORLD } from './config.js';
import { makeCanvas, seeded } from './utils.js';

/**
 * Canvas renderer. World coordinates are drawn with screen Y = -worldY so the
 * road scrolls "up" as cars drive forward. All heavy textures (asphalt,
 * sidewalk, ground, fog, vignette, headlight cones) are pre-rendered.
 */
export class Renderer {
  constructor(canvas, sprites) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = sprites;
    this.scale = 1;
    this.buildTextures();
  }

  buildTextures() {
    const ctx = this.ctx;
    // Asphalt
    const a = makeCanvas(400, 400), ag = a.getContext('2d'), r = seeded(42);
    ag.fillStyle = '#262524'; ag.fillRect(0, 0, 400, 400);
    for (let i = 0; i < 2600; i++) { ag.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)'; ag.fillRect(r() * 400, r() * 400, 1 + r() * 2, 1 + r() * 2); }
    for (let i = 0; i < 9; i++) { ag.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(80,75,70,0.08)'; ag.beginPath(); ag.ellipse(r() * 400, r() * 400, 20 + r() * 60, 10 + r() * 40, r() * 3, 0, 6.28); ag.fill(); }
    ag.strokeStyle = 'rgba(0,0,0,0.35)'; ag.lineWidth = 1;
    for (let i = 0; i < 6; i++) { ag.beginPath(); let x = r() * 400, y = r() * 400; ag.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 50; y += (r() - 0.5) * 50; ag.lineTo(x, y); } ag.stroke(); }
    this.asphalt = ctx.createPattern(a, 'repeat');

    // Sidewalk slabs
    const s = makeCanvas(64, 64), sg = s.getContext('2d');
    sg.fillStyle = '#3a3734'; sg.fillRect(0, 0, 64, 64);
    sg.strokeStyle = '#24221f'; sg.lineWidth = 2; sg.strokeRect(0, 0, 64, 64);
    for (let i = 0; i < 120; i++) { sg.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.04)'; sg.fillRect(r() * 64, r() * 64, 2, 2); }
    sg.strokeStyle = 'rgba(0,0,0,0.5)'; sg.lineWidth = 1; sg.beginPath(); sg.moveTo(10, 5); sg.lineTo(30, 30); sg.lineTo(25, 60); sg.stroke();
    this.sidewalk = ctx.createPattern(s, 'repeat');

    // Ground / dirt / rubble between buildings
    const gr = makeCanvas(256, 256), gg = gr.getContext('2d');
    gg.fillStyle = '#17140f'; gg.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) { gg.fillStyle = ['rgba(60,50,35,0.4)', 'rgba(0,0,0,0.3)', 'rgba(40,50,25,0.35)'][Math.floor(r() * 3)]; gg.fillRect(r() * 256, r() * 256, 2 + r() * 4, 2 + r() * 4); }
    this.ground = ctx.createPattern(gr, 'repeat');

    // Fog tile
    const f = makeCanvas(512, 512), fg = f.getContext('2d');
    for (let i = 0; i < 26; i++) {
      const x = r() * 512, y = r() * 512, rad = 60 + r() * 120;
      for (const [ox, oy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
        const grd = fg.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        grd.addColorStop(0, 'rgba(150,140,130,0.22)'); grd.addColorStop(1, 'rgba(150,140,130,0)');
        fg.fillStyle = grd; fg.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    this.fog = ctx.createPattern(f, 'repeat');

    // Headlight cone (points up)
    const h = makeCanvas(140, 300), hg = h.getContext('2d');
    const hgrd = hg.createRadialGradient(70, 300, 10, 70, 300, 300);
    hgrd.addColorStop(0, 'rgba(255,240,200,0.32)'); hgrd.addColorStop(1, 'rgba(255,240,200,0)');
    hg.fillStyle = hgrd;
    hg.beginPath(); hg.moveTo(55, 300); hg.lineTo(0, 0); hg.lineTo(140, 0); hg.lineTo(85, 300); hg.fill();
    this.headlight = h;

    // Generic glow
    const gl = makeCanvas(128, 128), glg = gl.getContext('2d');
    const glgrd = glg.createRadialGradient(64, 64, 0, 64, 64, 64);
    glgrd.addColorStop(0, 'rgba(255,120,30,0.55)'); glgrd.addColorStop(1, 'rgba(255,60,0,0)');
    glg.fillStyle = glgrd; glg.fillRect(0, 0, 128, 128);
    this.glow = gl;
  }

  resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    const W = this.canvas.width, H = this.canvas.height;
    this.baseScale = Math.min(W / WORLD.viewMinWidth, H / WORLD.viewMinHeight);
    // Vignette
    const v = makeCanvas(W, H), vg = v.getContext('2d');
    const grd = vg.createRadialGradient(W / 2, H * 0.6, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.85)');
    vg.fillStyle = grd; vg.fillRect(0, 0, W, H);
    this.vignette = v;
  }

  /** Main draw call. */
  render(e) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    const p = e.player;
    const speedRatio = Math.min(1.3, p.speed / p.maxSpeed);
    // Slight zoom-out at speed for sensation of velocity
    const s = (this.scale = this.baseScale * (1 - 0.08 * Math.min(1, speedRatio)));
    const cam = e.camera;
    const ox = W / 2 - cam.x * s + cam.shakeX * s;
    const oy = H * WORLD.playerScreenRatio + cam.y * s + cam.shakeY * s;
    const yTop = cam.y + (H * WORLD.playerScreenRatio) / s + 60;
    const yBot = cam.y - (H * (1 - WORLD.playerScreenRatio)) / s - 60;
    const xHalf = W / 2 / s + 40;
    this.view = { yTop, yBot, xHalf };

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0908';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    const R = WORLD.roadHalf, SW = WORLD.sidewalk;
    // Ground, sidewalks, road
    ctx.fillStyle = this.ground;
    ctx.fillRect(cam.x - xHalf, -yTop, xHalf * 2, yTop - yBot);
    ctx.fillStyle = this.sidewalk;
    ctx.fillRect(-R - SW, -yTop, SW, yTop - yBot);
    ctx.fillRect(R, -yTop, SW, yTop - yBot);
    ctx.fillStyle = '#4a4640';
    ctx.fillRect(-R - 4, -yTop, 4, yTop - yBot);
    ctx.fillRect(R, -yTop, 4, yTop - yBot);
    ctx.fillStyle = this.asphalt;
    ctx.fillRect(-R, -yTop, R * 2, yTop - yBot);

    this.drawLaneMarks(ctx, yBot, yTop);
    this.drawFinish(ctx, e.finishY, yBot, yTop);

    const segs = e.road.segments;
    for (const seg of segs) if (seg.y1 > yBot && seg.y0 < yTop) this.drawDecals(ctx, seg, yBot, yTop);
    this.drawSplats(ctx, e.road.splats, yBot, yTop);
    for (const seg of segs) if (seg.y1 > yBot && seg.y0 < yTop) this.drawProps(ctx, seg, yBot, yTop, e.time);

    // Fuel pickups
    for (const f of e.fuel.pickups) {
      if (f.y < yBot || f.y > yTop) continue;
      const k = 1 + Math.sin(f.bob) * 0.08;
      ctx.drawImage(this.sprites.fuel(f.kind), f.x - (f.w / 2) * k, -f.y - (f.h / 2) * k, f.w * k, f.h * k);
    }

    // Obstacles
    for (const o of e.obstacles) {
      if (o.y < yBot - 100 || o.y > yTop + 100 || o.dead) continue;
      let img = o.sprite;
      if (o.kind === 'zombie') {
        img = this.sprites.zombie(Math.sin(o.phase) > 0 ? 1 : 0, o.seed);
        o.angle = o.vx > 0 ? Math.PI / 2 : -Math.PI / 2; // face walking direction
      }
      else if (o.kind === 'corpse') img = this.sprites.corpse(o.seed);
      ctx.save();
      ctx.translate(o.x, -o.y);
      if (o.angle) ctx.rotate(o.angle);
      ctx.drawImage(img, -o.sw / 2, -o.sh / 2, o.sw, o.sh);
      ctx.restore();
    }

    // Buildings drawn after props so wrecks against walls look embedded
    for (const seg of segs) if (seg.y1 > yBot && seg.y0 < yTop) this.drawBuildings(ctx, seg, yBot, yTop);

    // Cars
    for (const c of e.cars) {
      if (c.y < yBot - 120 || c.y > yTop + 120) continue;
      if (c.destroyed && c.destroyedTime > 25) continue;
      this.drawCar(ctx, c, e);
    }

    // Darkness pass (night atmosphere), then lights on top
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,4,10,0.32)';
    ctx.fillRect(0, 0, W, H);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    ctx.globalCompositeOperation = 'lighter';
    for (const c of e.cars) {
      if (c.destroyed || c.y < yBot - 300 || c.y > yTop) continue;
      ctx.save();
      ctx.translate(c.x, -c.y);
      ctx.rotate(c.angle);
      ctx.globalAlpha = c.isPlayer ? 0.95 : 0.55;
      ctx.drawImage(this.headlight, -70, -c.h / 2 - 290, 140, 300);
      ctx.restore();
      // Emergency lights
      if (c.type === 'police' || c.type === 'ambulance') {
        const on = Math.floor(e.time * 6 + c.id) % 2 === 0;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = on ? 'rgba(255,30,30,0.6)' : 'rgba(30,80,255,0.6)';
        ctx.beginPath(); ctx.arc(c.x + (on ? -8 : 8), -c.y, 22, 0, 6.28); ctx.fill();
      }
    }
    if (!p.destroyed) {
      // Player's red under-glow makes the car easy to spot
      ctx.globalAlpha = 0.5 + Math.sin(e.time * 5) * 0.1;
      ctx.drawImage(this.glow, p.x - 50, -p.y - 60, 100, 120);
    }
    for (const seg of segs) {
      if (seg.y1 < yBot || seg.y0 > yTop) continue;
      for (const f of seg.fires) {
        if (f.y < yBot - 100 || f.y > yTop + 100) continue;
        ctx.globalAlpha = 0.65 + Math.sin(e.time * 13 + f.x) * 0.15;
        const r = 90 * f.size;
        ctx.drawImage(this.glow, f.x - r, -f.y - r, r * 2, r * 2);
      }
    }
    for (const o of e.obstacles) {
      if (!o.burning || o.y < yBot - 100 || o.y > yTop + 100) continue;
      ctx.globalAlpha = 0.6 + Math.sin(e.time * 11 + o.x) * 0.15;
      ctx.drawImage(this.glow, o.x - 80, -o.y - 80, 160, 160);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    this.drawHazardOutlines(ctx, e, yBot, yTop);
    // Sickly glow under zombies on the road so hordes read in the dark
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(90,160,40,0.22)';
    for (const o of e.obstacles) {
      if (o.kind !== 'zombie' || o.dead || o.y < yBot || o.y > yTop) continue;
      ctx.beginPath(); ctx.arc(o.x, -o.y, 22, 0, 6.28); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
    e.particles.render(ctx);

    // Rival name tags + HP bars
    ctx.textAlign = 'center';
    ctx.font = '600 11px Oswald, sans-serif';
    for (const c of e.cars) {
      if (c.isPlayer || c.destroyed || c.y < yBot || c.y > yTop) continue;
      const ty = -c.y - c.h / 2 - 10;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(c.x - 20, ty - 2, 40, 4);
      const hp = c.hp / c.maxHp;
      ctx.fillStyle = hp > 0.6 ? '#7fbf3f' : hp > 0.3 ? '#e0a020' : '#e02020';
      ctx.fillRect(c.x - 20, ty - 2, 40 * hp, 4);
      ctx.fillStyle = 'rgba(230,220,210,0.75)';
      ctx.fillText(c.name, c.x, ty - 6);
    }

    // ----- Screen-space effects -----
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const theme = e.road.themeAt(p.y);
    if (e.options.fog !== false) {
      ctx.globalAlpha = theme.fog + 0.1;
      ctx.fillStyle = this.fog;
      ctx.save();
      ctx.translate(((e.time * 20) % 512), (cam.y * s * 0.6) % 512);
      ctx.fillRect(-512, -512, W + 1024, H + 1024);
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // Speed lines (simulated motion blur)
    if (speedRatio > 0.6 && e.state === 'racing') {
      const k = (speedRatio - 0.6) / 0.6;
      ctx.strokeStyle = `rgba(230,220,210,${0.12 + 0.25 * k})`;
      ctx.lineWidth = Math.max(1, W / 900);
      ctx.beginPath();
      const count = Math.floor(10 + 26 * k);
      for (let i = 0; i < count; i++) {
        const side = Math.random() < 0.5 ? Math.random() * W * 0.22 : W - Math.random() * W * 0.22;
        const y = Math.random() * H;
        const len = (60 + Math.random() * 140) * (H / 900) * (0.6 + k);
        ctx.moveTo(side, y); ctx.lineTo(side, y + len);
      }
      ctx.stroke();
    }

    ctx.drawImage(this.vignette, 0, 0);

    // Damage tint / hit flash / low fuel warning
    if (p.damageRatio > 0.6 && !p.destroyed) {
      ctx.fillStyle = `rgba(120,0,0,${0.1 + Math.sin(e.time * 6) * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (e.damageFlash > 0) {
      ctx.fillStyle = `rgba(200,0,0,${e.damageFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (p.fuel < 20 && !p.destroyed && e.state === 'racing') {
      const a = 0.25 + Math.sin(e.time * 8) * 0.2;
      ctx.strokeStyle = `rgba(255,140,0,${a})`;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 6, W - 12, H - 12);
    }
  }

  /**
   * Hazard outlines: every SOLID obstacle gets a pulsing orange contour drawn
   * after the darkness pass, so it reads clearly against the decor
   * (sidewalk wrecks, corpses, rubble) and against racing rivals.
   */
  drawHazardOutlines(ctx, e, yBot, yTop) {
    const pulse = 0.6 + Math.sin(e.time * 6) * 0.2;
    ctx.lineJoin = 'round';
    for (const o of e.obstacles) {
      if (!o.solid || o.dead || o.y < yBot - 100 || o.y > yTop + 100) continue;
      const w = o.sw * 0.94, h = o.sh * 0.94;
      ctx.save();
      ctx.translate(o.x, -o.y);
      if (o.angle) ctx.rotate(o.angle);
      ctx.fillStyle = 'rgba(255,120,0,0.10)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 6;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = `rgba(255,140,20,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
    // Rival wrecks that still block the road get the same treatment (red).
    for (const c of e.cars) {
      if (!c.destroyed || c.destroyedTime > 7 || c.y < yBot || c.y > yTop) continue;
      ctx.save();
      ctx.translate(c.x, -c.y);
      ctx.rotate(c.angle);
      ctx.strokeStyle = `rgba(255,40,20,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
  }

  drawLaneMarks(ctx, yBot, yTop) {
    const step = 120;
    const start = Math.floor(yBot / step) * step;
    ctx.fillStyle = 'rgba(200,195,180,0.45)';
    for (let y = start; y < yTop; y += step) {
      const k = Math.abs(Math.floor(y / step));
      for (const x of [-100, 100]) {
        if (((k * 7919 + x) % 11) < 2) continue; // worn-out dashes
        ctx.fillRect(x - 2, -(y + 55), 4, 55);
      }
    }
    // Faded double center line + road edges
    ctx.fillStyle = 'rgba(190,150,40,0.38)';
    ctx.fillRect(-5, -yTop, 3, yTop - yBot);
    ctx.fillRect(2, -yTop, 3, yTop - yBot);
    ctx.fillStyle = 'rgba(200,195,180,0.3)';
    ctx.fillRect(-WORLD.roadHalf + 6, -yTop, 3, yTop - yBot);
    ctx.fillRect(WORLD.roadHalf - 9, -yTop, 3, yTop - yBot);
  }

  drawFinish(ctx, fy, yBot, yTop) {
    if (fy < yBot - 100 || fy > yTop + 100) return;
    const sq = 20;
    for (let r = 0; r < 3; r++) {
      for (let x = -WORLD.roadHalf, i = 0; x < WORLD.roadHalf; x += sq, i++) {
        ctx.fillStyle = (i + r) % 2 ? '#d8d0c0' : '#111';
        ctx.fillRect(x, -(fy + r * sq + sq), sq, sq);
      }
    }
    ctx.fillStyle = '#8a0a0a';
    ctx.fillRect(-WORLD.roadHalf - 30, -(fy + 140), WORLD.roadHalf * 2 + 60, 36);
    ctx.fillStyle = '#f0e0d0';
    ctx.font = '700 26px Oswald, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FINISH  •  SURVIVE', 0, -(fy + 112));
  }

  drawDecals(ctx, seg, yBot, yTop) {
    for (const d of seg.decals) {
      if (d.kind === 'crack') {
        if (d.pts[1] < yBot - 200 || d.pts[1] > yTop + 200) continue;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = d.w;
        ctx.beginPath();
        ctx.moveTo(d.pts[0], -d.pts[1]);
        for (let i = 2; i < d.pts.length; i += 2) ctx.lineTo(d.pts[i], -d.pts[i + 1]);
        ctx.stroke();
        continue;
      }
      if (d.y < yBot - 200 || d.y > yTop + 200) continue;
      if (d.kind === 'blood') {
        ctx.fillStyle = 'rgba(85,5,5,0.75)';
        ctx.beginPath(); ctx.ellipse(d.x, -d.y, d.r, d.r * 0.6, d.rot, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.ellipse(d.x + d.r * 0.8, -d.y + d.r * 0.4, d.r * 0.3, d.r * 0.2, d.rot, 0, 6.28); ctx.fill();
      } else if (d.kind === 'pothole') {
        ctx.fillStyle = '#0e0d0c';
        ctx.beginPath(); ctx.ellipse(d.x, -d.y, d.r, d.r * 0.75, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(80,75,70,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      } else if (d.kind === 'oil') {
        ctx.fillStyle = 'rgba(5,5,10,0.55)';
        ctx.beginPath(); ctx.ellipse(d.x, -d.y, d.r, d.r * 0.7, 0.4, 0, 6.28); ctx.fill();
      } else if (d.kind === 'skid') {
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(d.x, -d.y); ctx.quadraticCurveTo(d.x + d.curve, -(d.y + d.len / 2), d.x + d.curve * 1.5, -(d.y + d.len)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(d.x + 30, -d.y); ctx.quadraticCurveTo(d.x + 30 + d.curve, -(d.y + d.len / 2), d.x + 30 + d.curve * 1.5, -(d.y + d.len)); ctx.stroke();
      }
    }
  }

  drawSplats(ctx, splats, yBot, yTop) {
    ctx.fillStyle = 'rgba(110,6,6,0.8)';
    for (const sp of splats) {
      if (sp.y < yBot || sp.y > yTop) continue;
      ctx.beginPath(); ctx.ellipse(sp.x, -sp.y, sp.r, sp.r * 0.55, sp.rot, 0, 6.28); ctx.fill();
      ctx.beginPath(); ctx.arc(sp.x + Math.cos(sp.rot) * sp.r * 1.3, -sp.y + Math.sin(sp.rot) * sp.r, 3, 0, 6.28); ctx.fill();
    }
  }

  drawProps(ctx, seg, yBot, yTop, time) {
    const S = this.sprites;
    for (const p of seg.props) {
      if (p.y < yBot - 150 || p.y > yTop + 150) continue;
      switch (p.kind) {
        case 'corpse': ctx.drawImage(S.corpse(p.seed), p.x - 20, -p.y - 20, 40, 40); break;
        case 'rubble': ctx.drawImage(S.prop('rubble', p.w, p.h, p.seed), p.x - p.w / 2, -p.y - p.h / 2, p.w, p.h); break;
        case 'wreck': {
          const img = S.wreck(p.type, p.burnt ? 'burnt' : 'abandoned', p.seed);
          ctx.save(); ctx.translate(p.x, -p.y); ctx.rotate(p.rot);
          ctx.globalAlpha = 0.55; // background decor: dimmer than real obstacles
          ctx.drawImage(img, -23, -45, 46, 90);
          ctx.restore();
          break;
        }
        case 'trash': ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, -p.y, p.r, 0, 6.28); ctx.fill(); break;
        case 'weeds':
          ctx.fillStyle = 'rgba(30,48,20,0.85)';
          ctx.beginPath(); ctx.arc(p.x, -p.y, p.r, 0, 6.28); ctx.arc(p.x + p.r * 0.6, -p.y - p.r * 0.4, p.r * 0.7, 0, 6.28); ctx.fill();
          break;
        case 'sign':
          ctx.save(); ctx.translate(p.x, -p.y); ctx.rotate(p.rot);
          ctx.fillStyle = '#555'; ctx.fillRect(-2, 0, 4, 34);
          ctx.fillStyle = '#7a1010'; ctx.beginPath();
          for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28 + 0.39; ctx[k ? 'lineTo' : 'moveTo'](Math.cos(a) * 11, Math.sin(a) * 11); }
          ctx.fill();
          ctx.restore();
          break;
        case 'lamp': {
          ctx.fillStyle = '#3a3a3c'; ctx.fillRect(p.x - 3, -p.y - 3, 6, 6);
          const flick = Math.sin(time * 23 + p.y) > 0.6;
          if (flick) { ctx.fillStyle = 'rgba(255,220,150,0.12)'; ctx.beginPath(); ctx.arc(p.x, -p.y, 50, 0, 6.28); ctx.fill(); }
          break;
        }
        default: break;
      }
    }
    for (const f of seg.fires) {
      if (!f.barrel || f.y < yBot || f.y > yTop) continue;
      ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(f.x, -f.y, 9, 0, 6.28); ctx.fill();
    }
    for (const z of seg.zombies) {
      if (z.y < yBot - 30 || z.y > yTop + 30) continue;
      ctx.save();
      ctx.translate(z.x, -z.y);
      ctx.rotate(Math.atan2(z.vx, z.vy));
      ctx.drawImage(S.zombie(Math.sin(z.phase) > 0 ? 1 : 0, z.seed), -13, -13, 26, 26);
      ctx.restore();
    }
  }

  drawBuildings(ctx, seg, yBot, yTop) {
    for (const b of seg.buildings) {
      if (b.y > yTop || b.y + b.h < yBot) continue;
      if (!b.sprite) b.sprite = this.sprites.building(b.w, b.h, b.seed, b.side, b.burnt);
      // Drop shadow toward the road suggests height
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const sx = b.side === 'left' ? 10 : -10;
      ctx.fillRect(b.x + sx, -(b.y + b.h) + 8, b.w, b.h);
      ctx.drawImage(b.sprite, b.x, -(b.y + b.h), b.w, b.h);
    }
  }

  drawCar(ctx, c, e) {
    const img = this.sprites.car(c.type);
    const blink = c.isPlayer && c.invulnerable > 0 && !c.destroyed && Math.floor(e.time * 12) % 2 === 0;
    ctx.save();
    ctx.translate(c.x, -c.y);
    ctx.rotate(c.angle);
    if (blink) ctx.globalAlpha = 0.45;
    ctx.drawImage(img, -c.w / 2, -c.h / 2, c.w, c.h);

    // Progressive damage overlays
    const lvl = c.destroyed ? 3 : c.damageRatio > 0.6 ? 2 : c.damageRatio > 0.25 ? 1 : 0;
    if (lvl > 0) {
      const r = seeded(c.id * 31 + 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const dents = lvl * 4;
      for (let i = 0; i < dents; i++) {
        ctx.beginPath();
        ctx.ellipse(-c.w / 2 + 4 + r() * (c.w - 8), -c.h / 2 + 4 + r() * (c.h - 8), 2 + r() * 4, 2 + r() * 5, r() * 3, 0, 6.28);
        ctx.fill();
      }
      if (lvl >= 2) {
        ctx.strokeStyle = 'rgba(220,230,240,0.6)'; ctx.lineWidth = 0.8;
        const cy = -c.h * 0.18;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) { const a = r() * 6.28; ctx.moveTo(0, cy); ctx.lineTo(Math.cos(a) * 14, cy + Math.sin(a) * 7); }
        ctx.stroke();
        ctx.fillStyle = 'rgba(20,10,5,0.35)';
        ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 1, c.w - 4, c.h - 2);
        // Loose bumper piece
        ctx.fillStyle = '#555';
        ctx.fillRect(c.w / 2 - 6, -c.h / 2 - 3 + Math.sin(e.time * 30) * 1.5, 10, 3);
      }
      if (lvl >= 3) {
        ctx.fillStyle = 'rgba(12,8,5,0.82)';
        ctx.fillRect(-c.w / 2 + 1, -c.h / 2, c.w - 2, c.h);
        ctx.fillStyle = 'rgba(160,60,10,0.6)';
        for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.arc(-c.w / 2 + r() * c.w, -c.h / 2 + r() * c.h, 2 + r() * 3, 0, 6.28); ctx.fill(); }
      }
    }
    if (c.hitFlash > 0) {
      ctx.globalAlpha = c.hitFlash * 1.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(-c.w / 2 + 2, -c.h / 2 + 1, c.w - 4, c.h - 2);
    }
    ctx.restore();
  }
}
