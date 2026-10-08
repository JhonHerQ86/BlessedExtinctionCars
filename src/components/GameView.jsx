import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/GameEngine.js';
import { audio } from '../game/AudioManager.js';
import GameHUD from './GameHUD.jsx';
import TouchControls from './TouchControls.jsx';
import PauseMenu from './PauseMenu.jsx';
import LevelMusic from './LevelMusic.jsx';
import GamepadMenu from './GamepadMenu.jsx';
import { LEVEL_MUSIC } from '../game/config.js';

const isTouchDevice = () => typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

/** Hosts the canvas + engine and overlays the React HUD / pause menu. */
export default function GameView({ options, onEnd, onRestart, onMenu }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [hud, setHud] = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, {
      difficulty: options.difficulty,
      options: { shake: options.shake, quality: options.quality, fog: options.fog, vibration: options.vibration, music: options.musicSource },
      audio,
      onHud: setHud,
      onEnd,
    });
    engineRef.current = engine;
    engine.start();
    if (import.meta.env.DEV) window.__bec = engine; // debug handle (dev only)
    return () => engine.destroy();
    // Engine is created once per mount (GameView is keyed by run id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    const e = engineRef.current;
    if (!e || e.state === 'ended') return;
    if (e.paused) { e.resume(); setPaused(false); } else { e.pause(); setPaused(true); }
  }, []);

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.code === 'KeyP' || ev.code === 'Escape') togglePause();
    };
    const onVis = () => {
      if (document.hidden && engineRef.current && !engineRef.current.paused) togglePause();
    };
    // Clicking the Bandcamp player moves keyboard focus into its iframe;
    // hand focus back to the game right away so the controls keep working.
    const onBlur = () => setTimeout(() => {
      const el = document.activeElement;
      if (el && el.tagName === 'IFRAME') el.blur();
    }, 0);
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [togglePause]);

  const showTouch = options.touchControls === 'on' || (options.touchControls === 'auto' && isTouchDevice());

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />
      {hud && <GameHUD hud={hud} />}
      <GamepadMenu onStart={togglePause} />
      <button className="pause-btn" onClick={togglePause} aria-label="Pause">❚❚</button>
      {options.musicSource === 'bandcamp' && LEVEL_MUSIC[1] && <LevelMusic track={LEVEL_MUSIC[1]} />}
      {showTouch && hud && <TouchControls input={engineRef.current.input} />}
      {paused && (
        <PauseMenu
          onResume={togglePause}
          onRestart={() => { setPaused(false); onRestart(); }}
          onMenu={() => { setPaused(false); onMenu(); }}
        />
      )}
    </div>
  );
}
