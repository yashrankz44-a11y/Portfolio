# 🐍 SERPENTINE — Worm Arena

A real-time multiplayer worm/snake arena game with a deep-space neon aesthetic, built with HTML5 Canvas, Node.js, and WebSockets.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Multiplayer** | Real-time via WebSockets — up to any number of concurrent players |
| **AI Bots** | 8 smart bots fill the arena when players are few |
| **Skins** | 8 unique worm themes (Neon, Ember, Glacier, Toxic, Gold, Crimson, Void, Aurora) |
| **Boost** | Hold Space / LMB / long-press to speed boost — drains mass and drops food |
| **Particle FX** | Eat sparks, death explosions, boost trails |
| **Minimap** | Live minimap with viewport indicator |
| **Leaderboard** | Top-10 by mass, updates every tick |
| **HUD** | Mass counter, rank, boost bar |
| **Ambient Audio** | Procedural generative music + sound effects (Web Audio API) |
| **Responsive** | Works on desktop (mouse + keyboard) and mobile (touch + tap boost) |
| **Game Over** | Score, survival time, and rank shown on death |

---

## 📁 Project Structure

```
serpentine/
├── server.js              # Node.js WebSocket + Express server
├── package.json
├── public/
│   ├── index.html         # Entry point & screen templates
│   ├── css/
│   │   └── style.css      # Full stylesheet (CSS vars, animations)
│   └── js/
│       ├── main.js        # Game orchestrator (boot, screen mgmt)
│       ├── network.js     # WebSocket client with auto-reconnect
│       ├── renderer.js    # Canvas 2D renderer (world, worms, food)
│       ├── input.js       # Mouse/keyboard/touch input handler
│       ├── hud.js         # DOM HUD updater (leaderboard, stats)
│       ├── particles.js   # Particle system (world-space)
│       ├── audio.js       # Procedural audio (Web Audio API)
│       └── lobby.js       # Lobby screen, skin picker, BG animation
└── README.md
```

---

## 🚀 Setup & Running

### Prerequisites
- Node.js v16 or higher

### Install & Run

```bash
# 1. Clone or extract the project
cd serpentine

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open in browser
# → http://localhost:3000
```

### Production / Custom Port

```bash
PORT=8080 node server.js
```

---

## 🎮 Controls

| Action | Desktop | Mobile |
|---|---|---|
| **Steer** | Move mouse | Drag finger |
| **Boost** | Hold Space or Left Click | Tap ⚡ button |

### Boost Strategy
- Boosting consumes mass but increases speed dramatically
- While boosting, your worm drops food pellets — opponents can steal them
- Use boost to cut off enemies or escape tight situations
- Keep mass above 10 to be able to boost

---

## 🏗 Architecture

### Server (`server.js`)
- **Express** serves static files
- **WebSocket (ws)** handles real-time game state
- **Game loop** runs at 30 ticks/second via `setInterval`
- Each tick: moves worms → checks food collisions → checks worm collisions → refills food → manages bots → broadcasts snapshot
- Snapshot sends worm segments (decimated for bandwidth), food positions, and leaderboard

### Client
- `main.js` — orchestrates screens and ties modules together
- `network.js` — WebSocket client, dispatches messages to `main.js`
- `renderer.js` — draws background grid, food, worms, particles to canvas; camera follows player with lerp + dynamic zoom
- `input.js` — captures mouse/touch position, computes angle to player head, sends at 20hz
- `particles.js` — pooled particle system in world space
- `audio.js` — all sound generated procedurally via Web Audio API (no external files)
- `hud.js` — updates DOM elements for leaderboard and stats
- `lobby.js` — skin picker, animated background worms

### Networking
- Client sends `{ type: 'input', dir: float, boost: bool }` at ~20hz
- Server broadcasts full `snapshot` to all clients at 30hz
- Snapshot includes all alive worms (head + every 2nd segment, max 80) and all food

---

## ⚙️ Configuration

Edit `CONFIG` at the top of `server.js`:

```js
const CONFIG = {
  PORT: 3000,
  WORLD_WIDTH: 4000,     // arena size
  WORLD_HEIGHT: 4000,
  TICK_RATE: 30,         // server ticks/sec
  BASE_SPEED: 3.2,       // normal movement speed
  BOOST_SPEED: 7.0,      // boosting speed
  BOOST_DRAIN: 0.15,     // mass lost per tick while boosting
  FOOD_COUNT_TARGET: 400, // max food pellets in world
  BOT_COUNT_TARGET: 8,   // target bot count
  COLLISION_GRACE: 60,   // ticks new worm is invincible (2s)
  LEADERBOARD_SIZE: 10,
};
```

---

## 🎨 Adding Skins

Add entries to the `SKINS` array in `server.js`:

```js
{ name:'Inferno', head:'#ff3300', body:['#ff5500','#ff2200','#cc1100'], glow:'#ff3300' }
```

---

## 📡 Multiplayer / Hosting

To host publicly:

1. Deploy to any Node.js host (Railway, Render, Fly.io, VPS)
2. Ensure the port is open
3. Players connect via the public URL
4. The WebSocket auto-detects `ws://` or `wss://` based on the page protocol

---

## 📜 License

MIT — free to use, modify, and distribute.