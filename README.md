# BLESSED EXTINCTION CARS

Arcade top-down survival racing set in a city wrecked by a zombie apocalypse.
You race 9 AI rivals over 8 km of ruined road. Along the way you dodge abandoned vehicles and barricades, ram rivals, keep your fuel tank alive, and try to cross the finish line in **1st place**.

Built with **React** for the UI, the **HTML5 Canvas API** for gameplay rendering and the **Web Audio API** for sound. All graphics and audio are procedural placeholders that you can replace with your own files.

---

## Installation and running

Requires Node.js 18 or newer.

```bash
npm install
npm run dev      # opens a dev server (http://localhost:5173)
npm run build    # production build into dist/
npm run preview  # serve the production build locally
```

The build uses relative paths (`base: './'`), so you can host `dist/` from any folder or sub-path.

---

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate | `W` / `↑` | **GAS** |
| Brake | `S` / `↓` | **BRAKE** |
| Steer left / right | `A` `D` / `←` `→` | ◀ ▶ |
| Nitro boost (costs fuel) | `Space` | **N₂O** |
| Pause | `P` / `Esc` | ❚❚ button |

**Gamepad** (Xbox, PlayStation or generic): RT/A accelerate, LT/B brake, left stick or D-pad steer (analog), X/RB nitro, START pause. The menus also work with a gamepad: D-pad to move, A to select, B to go back.

Touch controls show up automatically on touch devices. You can force them on or off in **OPTIONS**.

## Rules

- **Fuel** drains all the time and drains faster while you accelerate. Pick up red jerrycans (+25) and tanks (+35). If the tank runs dry the car stalls and the race is over.
- **Car condition** is a health bar (100%). How much a hit costs depends on what you hit and how fast:
  - Head-on into an obstacle at full speed: about 40%. At low speed: about 15%.
  - Scraping along an obstacle: a few %.
  - Rear-ending a rival: mild (about 7% at a big speed difference). Getting rear-ended or side-rammed: more.
  - Side-ramming a rival: almost free.
  - The car smokes and loses top speed as health drops. At 0% it explodes, then **CAR DESTROYED** and **GAME OVER**.
- **Obstacles are physical bodies, not walls.** Each one has a mass. Ram a car or a barricade and it gets shoved, spins and slides until friction stops it. It can also knock into other obstacles. Light objects barely slow you and do little damage. Heavy ones (bus, truck, concrete) stop you hard and hurt more.
- **Solid obstacles** have a pulsing **orange outline**. Wrecks that still block the road have a **red** outline. Dim cars on the sidewalks are scenery.
- **Rivals** have HP. Ram them until they smoke, slow down and explode. A burning wreck blocks the road for a few seconds.
- Zombie hordes cross the road every 5–11 seconds and grow bigger as the race goes on. Zombies and corpses don't damage the car. They slow you down a little, and each one you run over restores **+3%** car condition.
- Green **repair kits** restore 25% car condition. One appears roughly every 350–475 m.
- **Victory**: cross the finish line first. Finishing in any other place ends on the *RACE OVER* screen.

---

## Project structure

```
blessed-extinction-cars/
├── public/assets/            ← all replaceable assets
│   ├── logo.jpg | logo.png   ← game logo
│   ├── cars/  obstacles/  zombies/  environment/  effects/  audio/
├── src/
│   ├── App.jsx / App.css     ← screen routing + theme
│   ├── settings.js           ← persisted options (localStorage)
│   ├── components/           ← React UI only
│   │   ├── MainMenu, HowToPlay, Options, Credits
│   │   ├── GameView.jsx      ← mounts canvas + engine, pause handling
│   │   ├── GameHUD.jsx       ← position, speed, fuel, damage, standings
│   │   ├── TouchControls.jsx, PauseMenu, GameOver, Victory, Stats
│   │   ├── Logo.jsx, MenuBackground.jsx
│   └── game/                 ← pure game logic (no React)
│       ├── config.js         ← ★ ALL TUNING: difficulty, vehicles, progression
│       ├── GameEngine.js     ← loop, state machine, ranking, camera
│       ├── Car.js            ← shared arcade physics
│       ├── PlayerCar.js      ← fuel, 3-hit damage, nitro, stats
│       ├── EnemyCar.js       ← rival + AI memory
│       ├── AISystem.js       ← lane scoring, braking, mistakes, rubber band
│       ├── CollisionSystem.js← car↔obstacle, car↔car (AABB + knockback)
│       ├── DamageSystem.js   ← hits, HP, destruction, damage visuals
│       ├── FuelSystem.js     ← drain + pickups
│       ├── RoadGenerator.js  ← procedural city segments (5 themes)
│       ├── ObstacleGenerator.js ← fair procedural obstacle rows
│       ├── ParticleSystem.js ← pooled particles (sparks, smoke, fire, blood…)
│       ├── Renderer.js       ← canvas drawing, lighting, fog, speed lines
│       ├── SpriteFactory.js  ← procedural sprites + PNG overrides
│       ├── AudioManager.js   ← synthesized SFX / music + file overrides
│       ├── InputManager.js   ← keyboard + touch
│       └── utils.js
```

React does not run per frame. The engine runs its own `requestAnimationFrame` loop and sends a small HUD snapshot to React about 12 times per second.

---

## Logo

Place your logo at **`public/assets/logo.jpg`**. A `logo.png` also works. The game tries `logo.jpg` first, then `logo.png`. A text fallback appears only when neither file exists.
The image is shown unmodified, with the word **CARS** underneath as a subtitle. It appears on the main menu, pause menu, Game Over screen, Victory screen, Credits and the HUD.

## Adding your own assets

You don't need to change any code. Drop a PNG with the right name into the right folder and it replaces the procedural sprite automatically. Sprites are top-down with the **front of the vehicle pointing up**. Any resolution works, because the image is stretched to the object's footprint.

| Folder | File names |
|---|---|
| `public/assets/cars/` | `player`, `muscle`, `pickup`, `sedan`, `sports`, `van`, `police`, `ambulance`, `military`, `suv` (`.png`) |
| `public/assets/obstacles/` | `sedan`, `pickup`, `taxi`, `police`, `ambulance`, `military`, `van`, `bus`, `truck`, `flipped`, `burnt`, `barricade`, `jersey`, `concrete`, `tree`, `pole`, `rubble`, `fuel_can`, `fuel_tank`, `repair_kit` |
| `public/assets/zombies/` | `zombie`, `corpse` |
| `public/assets/audio/` | `music`, `crash`, `explosion`, `pickup`, `splat`, `zombie`, `brake`, `beep`, `go` (`.mp3`) |

Any audio file you leave out keeps its synthesized sound. Only use music and sound effects you have the rights to.

---

## Changing the difficulty

Everything lives in **`src/game/config.js`**:

- `DIFFICULTY`: the presets players pick in OPTIONS (`easy`, `normal`, `hard`/NIGHTMARE). Each preset has rival speed, obstacle density, fuel rarity, fuel drain and AI mistake rate.
- `PROGRESSION`: how the race ramps up from start to finish. It covers obstacle row gap, fuel spacing, the AI speed bonus, the AI mistake rate and the chance of zombies crossing.
- `RACE`: race length in km (`lengthKm`), countdown, and the obstacle-free distance at the start.
- `PLAYER`: health (`maxHp`), damage per impact type (`damage`: `base + speed × perSpeed`), invulnerability time, tank size, drain rates, fuel per pickup, and nitro cost and power.
- `OBSTACLE_PHYSICS`: mass of each obstacle type, friction, angular friction and bounciness.
- `ZOMBIES`: health restored per zombie (`heal`), how often hordes appear, horde size and walking speed. `REPAIR`: health per kit and spacing between kits.
- `WORLD`: number of lanes, lane width, and how much road the camera shows.

The segment themes in `RoadGenerator.js` (`THEMES`) control decoration and obstacle multipliers for the *normal, destroyed, dangerous, urban* and *apocalypse* zones.

## Changing the vehicles

- `CAR_TYPES` in `config.js` sets each archetype's footprint (`w`, `h`), `maxSpeed`, `accel`, `braking`, `steering`, `hp` and paint colors.
  Speed units: `1000` = 180 km/h.
- `RIVALS` lists the 9 opponents: name, archetype, `aggression` (how often they hunt you), `skill` (reaction time and fewer mistakes) and `pace` (cruise speed multiplier).

---

## Performance notes

- Sprites, textures, fog and vignette are pre-rendered once into offscreen canvases.
- Particles come from a fixed pool, so nothing is allocated per frame. The pool size depends on the Graphics setting (LOW/MED/HIGH).
- Road segments, obstacles and pickups are generated just ahead of the cars and removed once they fall behind.
- The device pixel ratio is capped at 2, and frame delta is clamped so the game doesn't jump after you switch tabs.

---

## Music and voice

- **Level 1 music** is *Incorruptible Cadavérico* by Blessed Extinction. It plays through Bandcamp's official embedded player, which shows at the top of the race screen.
  - Press ▶ in the player to start the song. Browsers don't allow embedded players to autoplay, so the first play needs a click. Use the same button to pause.
  - The ♫ button hides or shows the player. The song keeps playing while the player is hidden.
  - To change the song, edit `LEVEL_MUSIC` in `src/game/config.js`. Get the track id from Bandcamp's *Share / Embed* option.
- **OPTIONS → Music** chooses the music source: `BANDCAMP`, `SYNTH` (built-in metal loop) or `OFF`.
- **Your own MP3 playlist**: put the files in `public/assets/audio/music/` and list them in `playlist.json`, for example `["song1.mp3","song2.mp3"]`. The playlist plays when Music is set to SYNTH, in shuffled order. Only use tracks you have the rights to.
- **Nitro voice**: when you use the nitro, a voice shouts *"Blessed Extinction!"* or *"Yeah man!"*. The clips are `public/assets/audio/nitro_blessed.mp3` and `nitro_yeah.mp3`, generated with espeak-ng and processed with ffmpeg (pitch, distortion, echo). Replace them with your own recordings, using the same file names, to get a real human shout. If the files are missing, the game falls back to the browser's speech synthesis, which is often silent on Linux.

---

## Publishing online (playable on PC and mobile)

The game is a static site. After `npm run build`, everything is in `dist/`.

- **itch.io** (recommended for games):
  1. Zip the build: `cd dist && zip -r ../blessed-extinction-cars-web.zip .`
  2. On itch.io, create a new project with **Kind of project: HTML**.
  3. Upload the zip and tick **This file will be played in the browser**.
  4. Set the viewport (e.g. 1280×720) and enable **Fullscreen button** and **Mobile friendly**.
- **Netlify**: drag the `dist/` folder onto https://app.netlify.com/drop.
- **GitHub Pages / Cloudflare Pages / Vercel**: publish the `dist/` folder. The build uses relative paths, so a sub-path works too.

Mobile browsers and gamepads require HTTPS. All of the hosts above provide it.
