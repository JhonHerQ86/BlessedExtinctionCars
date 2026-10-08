import React, { useCallback, useEffect, useState } from 'react';
import MainMenu from './components/MainMenu.jsx';
import HowToPlay from './components/HowToPlay.jsx';
import Options from './components/Options.jsx';
import Credits from './components/Credits.jsx';
import GameView from './components/GameView.jsx';
import GameOver from './components/GameOver.jsx';
import Victory from './components/Victory.jsx';
import MenuBackground from './components/MenuBackground.jsx';
import GamepadMenu from './components/GamepadMenu.jsx';
import { audio } from './game/AudioManager.js';
import { loadOptions, saveOptions } from './settings.js';

/**
 * Top-level screen router. All gameplay lives in src/game (GameEngine);
 * App only switches between screens and keeps user options.
 */
export default function App() {
  const [screen, setScreen] = useState('menu'); // menu | howto | options | credits | playing | gameover | victory
  const [options, setOptions] = useState(loadOptions);
  const [result, setResult] = useState(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    saveOptions(options);
    audio.setVolumes({ master: options.master, music: options.music, sfx: options.sfx });
  }, [options]);

  const startRace = useCallback(() => {
    audio.init(); // needs a user gesture
    setResult(null);
    setRunId((n) => n + 1);
    setScreen('playing');
  }, []);

  const handleEnd = useCallback((r) => {
    setResult(r);
    setScreen(r.victory ? 'victory' : 'gameover');
  }, []);

  const toMenu = useCallback(() => setScreen('menu'), []);
  const inMenus = screen === 'menu' || screen === 'howto' || screen === 'options' || screen === 'credits';

  return (
    <div className="app">
      {(inMenus || screen === 'gameover' || screen === 'victory') && <MenuBackground />}
      {screen !== 'playing' && <GamepadMenu />}
      {screen === 'menu' && <MainMenu onStart={startRace} onNavigate={setScreen} />}
      {screen === 'howto' && <HowToPlay onBack={toMenu} />}
      {screen === 'options' && <Options options={options} onChange={setOptions} onBack={toMenu} />}
      {screen === 'credits' && <Credits onBack={toMenu} />}
      {screen === 'playing' && <GameView key={runId} options={options} onEnd={handleEnd} onRestart={startRace} onMenu={toMenu} />}
      {screen === 'gameover' && result && <GameOver result={result} onRetry={startRace} onMenu={toMenu} />}
      {screen === 'victory' && result && <Victory result={result} onRetry={startRace} onMenu={toMenu} />}
    </div>
  );
}
