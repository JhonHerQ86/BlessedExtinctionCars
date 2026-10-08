import React, { useState } from 'react';

/**
 * Level music via Bandcamp's official embedded player.
 * Shown open as soon as the race starts. Browsers do not allow a site to start
 * a cross-origin Bandcamp iframe, so the first play needs a tap on its ▶.
 * The iframe stays mounted so music keeps playing when the panel is collapsed.
 */
export default function BandcampPlayer({ track }) {
  const [open, setOpen] = useState(true);
  const [loaded, setLoaded] = useState(true);
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
