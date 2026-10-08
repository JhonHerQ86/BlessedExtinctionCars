/**
 * Gamepad mapping (standard layout: Xbox / PlayStation / generic):
 *   RT (R2) or A (✕)      accelerate     LT (L2) or B (○)   brake
 *   Left stick / D-pad    steer          X (□) or RB (R1)   nitro
 *   START (Options)       pause (handled by GamepadMenu / GameView)
 */
const DEADZONE = 0.25;

/**
 * Keyboard + touch + gamepad input. Touch buttons (React TouchControls) write into
 * `touch`; the engine only reads the merged `state`.
 */
const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'action',
};

export class InputManager {
  constructor() {
    this.keys = { up: false, down: false, left: false, right: false, action: false };
    this.touch = { up: false, down: false, left: false, right: false, action: false };
    this.state = { up: false, down: false, left: false, right: false, action: false };
    this.pad = { up: false, down: false, left: false, right: false, action: false };
    this.steerAxis = 0; // analog steering from a gamepad stick (-1..1)
    this.actionPressed = false; // edge-triggered
    this.onKeyDown = (e) => {
      const k = KEYMAP[e.code];
      if (!k) return;
      e.preventDefault();
      if (k === 'action' && !this.keys.action) this.actionPressed = true;
      this.keys[k] = true;
    };
    this.onKeyUp = (e) => {
      const k = KEYMAP[e.code];
      if (k) this.keys[k] = false;
    };
    this.onBlur = () => {
      for (const k in this.keys) this.keys[k] = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setTouch(key, value) {
    if (key === 'action' && value && !this.touch.action) this.actionPressed = true;
    this.touch[key] = value;
  }

  /** Read the first connected gamepad into `pad`. */
  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const g of pads) if (g && g.connected) { gp = g; break; }
    const p = this.pad;
    if (!gp) {
      p.up = p.down = p.left = p.right = p.action = false;
      this.steerAxis = 0;
      return;
    }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.3));
    const ax = gp.axes[0] || 0;
    this.steerAxis = Math.abs(ax) > DEADZONE ? ax : 0;
    p.up = b(7) || b(0);
    p.down = b(6) || b(1);
    p.left = b(14) || ax < -DEADZONE;
    p.right = b(15) || ax > DEADZONE;
    const act = b(2) || b(5);
    if (act && !p.action) this.actionPressed = true;
    p.action = act;
  }

  /** Merge sources; call once per frame. */
  poll() {
    this.pollGamepad();
    const s = this.state;
    for (const k in s) s[k] = this.keys[k] || this.touch[k] || this.pad[k];
    const a = this.actionPressed;
    this.actionPressed = false;
    return a;
  }
}
