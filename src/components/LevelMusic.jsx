import React, { useEffect, useState } from 'react';
import { audio } from '../game/AudioManager.js';
import BandcampPlayer from './BandcampPlayer.jsx';

/**
 * Level soundtrack. If the track's local MP3 exists it autoplays with our own
 * play/pause button; otherwise falls back to the Bandcamp embedded player.
 */
export default function LevelMusic({ track }) {
  const [mode, setMode] = useState('checking'); // checking | local | bandcamp
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    let alive = true;
    audio.playLevelTrack(track.file).then((ok) => { if (alive) setMode(ok ? 'local' : 'bandcamp'); });
    return () => { alive = false; };
  }, [track.file]);

  if (mode === 'checking') return null;
  if (mode === 'bandcamp') return <BandcampPlayer track={track} />;
  return (
    <div className="bc-player local">
      <button className="bc-toggle" onClick={() => setPlaying(audio.toggleLevelTrack())} aria-label={playing ? 'Pause music' : 'Play music'}>
        {playing ? '❚❚♫' : '▶♫'}
      </button>
      <span className="bc-title">{track.title}</span>
    </div>
  );
}
