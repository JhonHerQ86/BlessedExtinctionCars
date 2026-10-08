import { useEffect } from 'react';

/**
 * Lets a gamepad drive the React UI: D-pad / left stick moves focus between
 * buttons, A (✕) clicks, B (○) presses the BACK/RESUME button if present,
 * START calls onStart (used for pause in-game). Renders nothing.
 */
export default function GamepadMenu({ onStart }) {
  useEffect(() => {
    let raf;
    let prev = {};
    let repeatAt = 0;
    const focusables = () => Array.from(document.querySelectorAll('button:not([disabled]), input[type="range"]')).filter((el) => el.offsetParent !== null && !el.closest('.touch-controls'));
    const move = (dir) => {
      const list = focusables();
      if (!list.length) return;
      const i = list.indexOf(document.activeElement);
      const next = list[(i + dir + list.length) % list.length] || list[0];
      next.focus();
    };
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const g of pads) if (g && g.connected) { gp = g; break; }
      if (!gp) return;
      const btn = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ay = gp.axes[1] || 0, ax = gp.axes[0] || 0;
      const now = {
        a: btn(0), b: btn(1), start: btn(9),
        up: btn(12) || ay < -0.5, down: btn(13) || ay > 0.5,
        left: btn(14) || ax < -0.5, right: btn(15) || ax > 0.5,
      };
      const pressed = (k) => now[k] && !prev[k];
      const inGame = !!document.querySelector('.game-root') && !document.querySelector('.overlay');

      if (pressed('start') && onStart && document.querySelector('.game-root')) onStart();
      if (!inGame) {
        const held = now.up || now.down;
        if (pressed('up') || pressed('down') || (held && t > repeatAt)) {
          move(now.up ? -1 : 1);
          repeatAt = t + (pressed('up') || pressed('down') ? 380 : 140);
        }
        const el = document.activeElement;
        if (el && el.type === 'range' && (pressed('left') || pressed('right'))) {
          el.value = Math.max(0, Math.min(1, parseFloat(el.value) + (now.right ? 0.05 : -0.05)));
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (pressed('a') && el && el.tagName === 'BUTTON') el.click();
        if (pressed('b')) {
          const back = focusables().find((x) => /^(BACK|RESUME|MAIN MENU)$/.test(x.textContent.trim()));
          if (back) back.click();
        }
      }
      prev = now;
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [onStart]);
  return null;
}
