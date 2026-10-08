/**
 * Central tuning file for Blessed Extinction Cars.
 * Almost every gameplay number lives here so balancing does not require
 * touching engine code. See README "Difficulty" / "Vehicles" sections.
 *
 * World units: 1 unit ≈ 5 cm. Y grows FORWARD along the road, X is lateral
 * (0 = road center). Speeds are in units / second.
 */

export const WORLD = {
  laneCount: 4,
  laneWidth: 100,
  roadHalf: 200, // road spans x ∈ [-200, 200]
  sidewalk: 64, // sidewalk width on each side
  viewMinWidth: 620, // minimum visible world width (portrait phones)
  viewMinHeight: 1300, // minimum visible world height (landscape screens)
  playerScreenRatio: 0.8, // player sits at 80% of screen height (more road visible ahead)
};

export const UNITS = {
  kmhPerUnit: 0.18, // speed(u/s) * 0.18 = km/h  (1000 u/s = 180 km/h)
  metersPerUnit: 0.05,
};

export const RACE = {
  lengthKm: 8, // finish line distance
  countdownSeconds: 3,
  safeStartDistance: 3200, // no obstacles in the first N units
  rivals: 9,
};

export const PLAYER = {
  maxHp: 100, // health bar
  invulnerableTime: 0.6, // grace period after an obstacle hit (avoids double hits)
  // Damage model: amount = base + impactSpeed * perSpeed (speed in units/s, 1000 = 180 km/h)
  damage: {
    obstacleFront: { base: 10, perSpeed: 0.03 }, // head-on into a wreck at full speed ≈ 40
    obstacleSide: { base: 3, perSpeed: 0.004 }, // scraping along an obstacle
    wreckFront: { base: 8, perSpeed: 0.025 }, // burning rival wreck
    rearEndRammer: { base: 0, perSpeed: 0.015 }, // YOU hit a rival from behind (mild)
    rearEndVictim: { base: 4, perSpeed: 0.06 }, // a rival slams into your rear (always hurts)
    sideVictim: { base: 2, perSpeed: 0.03 }, // a rival side-rams you
    sideRammer: { base: 1, perSpeed: 0 }, // you side-ram a rival (almost free)
  },
  maxFuel: 100,
  fuelDrainIdle: 0.9, // fuel / s while rolling
  fuelDrainThrottle: 2.1, // extra fuel / s while accelerating
  fuelPickup: 25,
  boostCost: 12, // fuel spent by SPACE boost
  boostTime: 1.4,
  boostSpeedMul: 1.28,
};

/** Difficulty presets (selectable in OPTIONS). */
export const DIFFICULTY = {
  easy: { label: 'EASY', aiSpeedMul: 0.93, obstacleMul: 0.75, fuelSpawnMul: 0.8, fuelDrainMul: 0.8, aiMistakeMul: 1.5 },
  normal: { label: 'NORMAL', aiSpeedMul: 1.0, obstacleMul: 1.0, fuelSpawnMul: 1.0, fuelDrainMul: 1.0, aiMistakeMul: 1.0 },
  hard: { label: 'NIGHTMARE', aiSpeedMul: 1.08, obstacleMul: 1.3, fuelSpawnMul: 1.25, fuelDrainMul: 1.15, aiMistakeMul: 0.6 },
};

/**
 * Progressive difficulty curve. `t` = race progress 0..1.
 * Gap = distance between obstacle rows (smaller = denser).
 */
export const PROGRESSION = {
  obstacleGapStart: 760,
  obstacleGapEnd: 300,
  fuelGapStart: 2600,
  fuelGapEnd: 4200,
  aiSpeedBonusEnd: 0.12, // AI gets +12% cruise speed by the end
  aiMistakeStart: 0.07, // chance per decision to make a bad call
  aiMistakeEnd: 0.02,
  zombieCrossChance: 0.18,
};

/**
 * Vehicle archetypes. Change stats here to rebalance cars.
 * w/h = footprint in world units. Speeds in units/second.
 */
export const CAR_TYPES = {
  player: { label: 'Reaper', w: 46, h: 84, maxSpeed: 1010, accel: 430, braking: 950, steering: 330, hp: 100, body: '#141414', accent: '#d0101a', trim: '#ff3b2f' },
  muscle: { label: 'Muscle', w: 46, h: 84, maxSpeed: 990, accel: 400, braking: 820, steering: 290, hp: 110, body: '#7a3410', accent: '#1a1a1a', trim: '#c9a227' },
  pickup: { label: 'Pickup', w: 48, h: 90, maxSpeed: 930, accel: 350, braking: 780, steering: 270, hp: 130, body: '#4a5228', accent: '#2b2f18', trim: '#9aa070' },
  sedan: { label: 'Sedan', w: 44, h: 82, maxSpeed: 950, accel: 380, braking: 860, steering: 300, hp: 95, body: '#3c4a5c', accent: '#232b36', trim: '#8fa3bb' },
  sports: { label: 'Sports', w: 44, h: 78, maxSpeed: 1030, accel: 450, braking: 900, steering: 320, hp: 80, body: '#b8970d', accent: '#1a1a1a', trim: '#ffe066' },
  van: { label: 'Van', w: 50, h: 96, maxSpeed: 900, accel: 330, braking: 760, steering: 250, hp: 140, body: '#9c968a', accent: '#5a5650', trim: '#d8d2c4' },
  police: { label: 'Police', w: 46, h: 86, maxSpeed: 1000, accel: 420, braking: 900, steering: 310, hp: 105, body: '#101418', accent: '#e8e8e8', trim: '#ffffff' },
  ambulance: { label: 'Ambulance', w: 50, h: 98, maxSpeed: 910, accel: 340, braking: 780, steering: 250, hp: 135, body: '#d8d4cc', accent: '#b01818', trim: '#ff4444' },
  military: { label: 'Military', w: 52, h: 94, maxSpeed: 920, accel: 360, braking: 800, steering: 260, hp: 170, body: '#3b4a2a', accent: '#24301a', trim: '#6b7a4a' },
  suv: { label: 'SUV', w: 50, h: 90, maxSpeed: 960, accel: 380, braking: 820, steering: 280, hp: 120, body: '#4a1018', accent: '#250608', trim: '#a8343f' },
};

/** The 9 AI rivals: archetype + personality. */
export const RIVALS = [
  { name: 'GRAVEDIGGER', type: 'muscle', aggression: 0.8, skill: 0.95, pace: 1.0 },
  { name: 'CARRION', type: 'pickup', aggression: 0.6, skill: 0.8, pace: 0.97 },
  { name: 'WIDOWMAKER', type: 'sedan', aggression: 0.4, skill: 0.9, pace: 0.98 },
  { name: 'NECROSIS', type: 'sports', aggression: 0.5, skill: 0.95, pace: 1.02 },
  { name: 'PLAGUE WAGON', type: 'van', aggression: 0.3, skill: 0.7, pace: 0.95 },
  { name: 'DEAD PATROL', type: 'police', aggression: 0.9, skill: 0.95, pace: 1.0 },
  { name: 'LAST RITES', type: 'ambulance', aggression: 0.5, skill: 0.8, pace: 0.96 },
  { name: 'WARHEAD', type: 'military', aggression: 1.0, skill: 0.85, pace: 0.97 },
  { name: 'BLOOD MOON', type: 'suv', aggression: 0.7, skill: 0.9, pace: 0.99 },
];

/** Zombie hordes that periodically shamble across the road ahead of the player. */
export const ZOMBIES = {
  hordeIntervalMin: 5, // seconds between hordes
  hordeIntervalMax: 11,
  hordeSizeMin: 2,
  hordeSizeMax: 6, // grows with race progress
  speedMin: 35, // lateral walking speed (units/s)
  speedMax: 70,
  slowdown: 0.95, // speed multiplier when you hit one
  heal: 3, // car condition % restored per zombie you run over
};

/**
 * Obstacle physics. Mass is relative to a race car (1.0). Light things fly
 * away and barely hurt; heavy things (bus, truck, concrete) barely move,
 * stop you hard and hurt a lot. Friction = how fast pushed objects stop.
 */
export const OBSTACLE_PHYSICS = {
  mass: {
    sedan: 1.0, taxi: 1.0, police: 1.05, pickup: 1.2, van: 1.4, ambulance: 1.5, military: 2.2,
    flipped: 1.1, bus: 4.5, truck: 4.0,
    barricade: 0.35, rubble: 1.6, tree: 1.4, pole: 0.9, jersey: 2.6, concrete: 3.0,
  },
  friction: 1.6, // velocity decay per second (sliding wrecks)
  angularFriction: 2.5,
  restitution: 0.25, // bounciness of impacts
};

/** Repair kits: restore car condition. Rarer than fuel. */
export const REPAIR = {
  amount: 25, // % of health restored
  gapStart: 7000, // distance between kits (units; 20000 = 1 km)
  gapEnd: 9500,
};

/**
 * Music per level. Bandcamp tracks play through Bandcamp's official embedded
 * player (it has its own play/pause button). Use the numeric track id from
 * the track page's "Share / Embed" option.
 */
export const LEVEL_MUSIC = {
  1: {
    title: 'Incorruptible Cadavérico',
    artist: 'Blessed Extinction',
    bandcampTrackId: '1140706104',
    url: 'https://blessedextinction1.bandcamp.com/track/incorruptible-cadav-rico',
  },
};

/** Lane center X for lane index 0..laneCount-1. */
export const laneX = (i) => -WORLD.roadHalf + WORLD.laneWidth * (i + 0.5);

/** Graphics quality presets. */
export const QUALITY = {
  low: { maxParticles: 260, emitMul: 0.4 },
  medium: { maxParticles: 600, emitMul: 0.75 },
  high: { maxParticles: 1100, emitMul: 1 },
};
