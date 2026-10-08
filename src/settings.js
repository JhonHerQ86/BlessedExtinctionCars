/** Persistent user options (localStorage, falls back to defaults). */
const KEY = 'bec-options-v1';

export const DEFAULT_OPTIONS = {
  difficulty: 'normal',
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  shake: true,
  quality: 'high',
  fog: true,
  vibration: true,
  touchControls: 'auto', // auto | on | off
  musicSource: 'bandcamp', // bandcamp | builtin | off
};

export function loadOptions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_OPTIONS, ...JSON.parse(raw) } : { ...DEFAULT_OPTIONS };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function saveOptions(o) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* storage unavailable */
  }
}
