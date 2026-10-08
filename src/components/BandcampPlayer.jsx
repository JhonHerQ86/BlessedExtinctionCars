import React, { useState } from 'react';

/**
 * Level music via Bandcamp's official embedded player.
 * Privacy: the Bandcamp iframe (which brings Bandcamp's own analytics) is NOT
 * loaded until the player presses ♫. After that it stays mounted so the music
 * keeps playing while the panel is collapsed. Play / pause with its own button.
 */
export default function BandcampPlayer({ track }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = `https://bandcamp.com/EmbeddedPlayer/track=${track.bandcampTrackId}/size=small/bgcol=0b0606/linkcol=b3121b/transparent=true/`;
  return (
    <div className={`bc-player ${open ? 'open' : ''}`}>
      <button className="bc-toggle" onClick={() => { setLoaded(true); setOpen((o) => !o); }} aria-label="Music player" title={`${track.title} — ${track.artist}`}>♫</button>
      <div className="bc-frame">
        {loaded && <iframe title={`${track.title} — ${track.artist}`} src={src} seamless allow="autoplay">
          <a href={track.url}>{track.title} by {track.artist}</a>
        </iframe>}
      </div>
    </div>
  );
}
