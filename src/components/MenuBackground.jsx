import React, { useEffect, useRef } from 'react';
import { SpriteFactory } from '../game/SpriteFactory.js';

/** Slowly scrolling ruined road behind the menus (independent tiny loop). */
export default function MenuBackground() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext('2d');
    const sprites = new SpriteFactory();
    const wrecks = [];
    const types = ['sedan', 'taxi', 'police', 'van', 'pickup', 'ambulance', 'bus', 'military'];
    for (let i = 0; i < 14; i++) {
      wrecks.push({ type: types[i % types.length], burnt: i % 3 === 0, x: (Math.random() - 0.5) * 360, y: i * 140, rot: (Math.random() - 0.5) * 2.4 });
    }
    let raf, off = 0, last = performance.now();
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const draw = (now) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      off += dt * 60;
      const W = canvas.width, H = canvas.height;
      const s = Math.max(W / 700, H / 1100);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0d0a09'; ctx.fillRect(0, 0, W, H);
      ctx.setTransform(s, 0, 0, s, W / 2, 0);
      ctx.fillStyle = '#222120'; ctx.fillRect(-220, 0, 440, H / s);
      ctx.fillStyle = '#34312d'; ctx.fillRect(-290, 0, 70, H / s); ctx.fillRect(220, 0, 70, H / s);
      ctx.fillStyle = 'rgba(190,150,40,0.3)'; ctx.fillRect(-3, 0, 6, H / s);
      const span = 14 * 140;
      for (const w of wrecks) {
        const y = ((w.y + off) % span) - 140;
        const img = w.type === 'bus' ? sprites.wreck('bus', 'abandoned', 3) : sprites.wreck(w.type, w.burnt ? 'burnt' : 'abandoned', 2);
        const sw = w.type === 'bus' ? 64 : 48, sh = w.type === 'bus' ? 176 : 90;
        ctx.save(); ctx.translate(w.x, y); ctx.rotate(w.rot); ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh); ctx.restore();
        if (w.burnt) {
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(w.x, y, 0, w.x, y, 70);
          g.addColorStop(0, `rgba(255,110,20,${0.35 + Math.sin(now / 90 + w.x) * 0.1})`); g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g; ctx.fillRect(w.x - 70, y - 70, 140, 140);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      v.addColorStop(0, 'rgba(0,0,0,0.45)'); v.addColorStop(1, 'rgba(0,0,0,0.95)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={ref} className="menu-bg" aria-hidden="true" />;
}
