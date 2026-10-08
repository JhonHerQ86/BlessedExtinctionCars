import React from 'react';
import { DIFFICULTY } from '../game/config.js';

function Toggle({ label, value, onChange }) {
  return (
    <label className="opt-row">
      <span>{label}</span>
      <button className={`btn btn-small ${value ? 'on' : ''}`} onClick={() => onChange(!value)}>{value ? 'ON' : 'OFF'}</button>
    </label>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <label className="opt-row">
      <span>{label}</span>
      <input type="range" min="0" max="1" step="0.05" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

function Choice({ label, value, choices, onChange }) {
  return (
    <div className="opt-row">
      <span>{label}</span>
      <div className="choice">
        {choices.map(([v, text]) => (
          <button key={v} className={`btn btn-small ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

export default function Options({ options, onChange, onBack }) {
  const set = (k) => (v) => onChange({ ...options, [k]: v });
  return (
    <div className="screen panel-screen">
      <div className="panel">
        <h2>OPTIONS</h2>
        <Choice label="Difficulty" value={options.difficulty} onChange={set('difficulty')} choices={Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label])} />
        <Slider label="Master volume" value={options.master} onChange={set('master')} />
        <Slider label="Music" value={options.music} onChange={set('music')} />
        <Choice label="Music" value={options.musicSource} onChange={set('musicSource')} choices={[['bandcamp', 'BANDCAMP'], ['builtin', 'SYNTH'], ['off', 'OFF']]} />
        <Slider label="Effects" value={options.sfx} onChange={set('sfx')} />
        <Choice label="Graphics" value={options.quality} onChange={set('quality')} choices={[['low', 'LOW'], ['medium', 'MED'], ['high', 'HIGH']]} />
        <Toggle label="Screen shake" value={options.shake} onChange={set('shake')} />
        <Toggle label="Fog" value={options.fog} onChange={set('fog')} />
        <Toggle label="Vibration" value={options.vibration} onChange={set('vibration')} />
        <Choice label="Touch controls" value={options.touchControls} onChange={set('touchControls')} choices={[['auto', 'AUTO'], ['on', 'ON'], ['off', 'OFF']]} />
        <button className="btn" onClick={onBack}>BACK</button>
      </div>
    </div>
  );
}
