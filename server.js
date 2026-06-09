const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');

const CONFIG = {
  PORT: process.env.PORT || 3000,
  WORLD_WIDTH: 4000,
  WORLD_HEIGHT: 4000,
  TICK_RATE: 30,
  BASE_SPEED: 3.2,
  BOOST_SPEED: 7.0,
  BOOST_DRAIN: 0.15,
  FOOD_COUNT_TARGET: 400,
  BOT_COUNT_TARGET: 8,
  COLLISION_GRACE: 60,
  LEADERBOARD_SIZE: 10,
};

const SKINS = [
  { name: 'Neon', head: '#ff00ff', body: ['#ff00ff', '#ff0080', '#ff00ff'], glow: '#ff00ff' },
  { name: 'Ember', head: '#ff3300', body: ['#ff5500', '#ff2200', '#cc1100'], glow: '#ff3300' },
  { name: 'Glacier', head: '#00eeff', body: ['#00ccff', '#0099ff', '#0066ff'], glow: '#00eeff' },
  { name: 'Toxic', head: '#00ff00', body: ['#00ff00', '#00dd00', '#00bb00'], glow: '#00ff00' },
  { name: 'Gold', head: '#ffdd00', body: ['#ffff00', '#ffee00', '#ffcc00'], glow: '#ffdd00' },
  { name: 'Crimson', head: '#ff0000', body: ['#dd0000', '#bb0000', '#990000'], glow: '#ff0000' },
  { name: 'Void', head: '#8800ff', body: ['#6600ff', '#4400ff', '#2200ff'], glow: '#8800ff' },
  { name: 'Aurora', head: '#00ffaa', body: ['#00ff88', '#00ff66', '#00ff44'], glow: '#00ffaa' }
];

class Worm {
  constructor(id, name, skinIndex, x = CONFIG.WORLD_WIDTH / 2, y = CONFIG.WORLD_HEIGHT / 2) {
    this.id = id;
    this.name = name;
    this.skinIndex = skinIndex;
    this.segments = [
      { x, y },
      { x: x - 8, y },
      { x: x - 16, y }
    ];
    this.mass = 30;
    this.direction = 0;
    this.boosting = false;
    this.boostEnergy = 1.0;
    this.alive = true;
    this.spawnTick = 0;
    this.killedBy = null;
  }

  getHead() {
    return this.segments[0];
  }

  update(config) {
    if (!this.alive) return;

    const speed = this.boosting ? config.BOOST_SPEED : config.BASE_SPEED;
    const head = this.getHead();
    const newHead = {
      x: head.x + Math.cos(this.direction) * speed,
      y: head.y + Math.sin(this.direction) * speed
    };

    // Wrap around world
    newHead.x = (newHead.x + config.WORLD_WIDTH) % config.WORLD_WIDTH;
    newHead.y = (newHead.y + config.WORLD_HEIGHT) % config.WORLD_HEIGHT;

    this.segments.unshift(newHead);

    if (this.boosting) {
      this.boostEnergy = Math.max(0, this.boostEnergy - config.BOOST_DRAIN / 100);
      this.mass = Math.max(10, this.mass - config.BOOST_DRAIN);
    } else {
      this.boostEnergy = Math.min(1.0, this.boostEnergy + 0.01);
    }

    while (this.segments.length > Math.ceil(this.mass / 5)) {
      this.segments.pop();
    }
  }
}

class Game {
  constructor() {
    this.worms = new Map();
    this.food = [];
    this.tick = 0;
    this.wormIdCounter = 1;
    this.bots = [];
    this.initFood();
  }

  initFood() {
    for (let i = 0; i < CONFIG.FOOD_COUNT_TARGET; i++) {
      this.food.push({
        x: Math.random() * CONFIG.WORLD_WIDTH,
        y: Math.random() * CONFIG.WORLD_HEIGHT,
        value: 1
      });
    }
  }

  addWorm(name, skinIndex) {
    const id = this.wormIdCounter++;
    const worm = new Worm(id, name, skinIndex);
    this.worms.set(id, worm);
    return id;
  }

  addBot() {
    const id = this.wormIdCounter++;
    const skinIndex = Math.floor(Math.random() * SKINS.length);
    const botNames = ['Bot-Alpha', 'Bot-Beta', 'Bot-Gamma', 'Bot-Delta', 'Bot-Epsilon'];
    const name = botNames[Math.floor(Math.random() * botNames.length)];
    const worm = new Worm(id, name, skinIndex);
    this.worms.set(id, worm);
    this.bots.push(id);
    return id;
  }

  update() {
    this.tick++;

    // Update worms
    for (const [id, worm] of this.worms) {
      if (worm.alive) {
        worm.update(CONFIG);
      }
    }

    // Bot AI
    for (const botId of this.bots) {
      const bot = this.worms.get(botId);
      if (bot && bot.alive) {
        const head = bot.getHead();
        const nearestFood = this.food.reduce((nearest, f) => {
          const dist = Math.hypot(f.x - head.x, f.y - head.y);
          const nearDist = nearest ? Math.hypot(nearest.x - head.x, nearest.y - head.y) : Infinity;
          return dist < nearDist ? f : nearest;
        }, null);

        if (nearestFood) {
          bot.direction = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
        }
        bot.boosting = Math.random() > 0.95;
      }
    }

    // Food collisions
    const foodToRemove = [];
    for (const [id, worm] of this.worms) {
      if (!worm.alive) continue;
      const head = worm.getHead();
      for (let i = this.food.length - 1; i >= 0; i--) {
        const f = this.food[i];
        const dist = Math.hypot(f.x - head.x, f.y - head.y);
        if (dist < 6) {
          worm.mass += f.value;
          foodToRemove.push(i);
        }
      }
    }
    for (let i = foodToRemove.length - 1; i >= 0; i--) {
      this.food.splice(foodToRemove[i], 1);
    }

    // Worm collisions
    const wormArray = Array.from(this.worms.values()).filter(w => w.alive);
    for (let i = 0; i < wormArray.length; i++) {
      for (let j = i + 1; j < wormArray.length; j++) {
        const w1 = wormArray[i];
        const w2 = wormArray[j];
        const h1 = w1.getHead();
        const h2 = w2.getHead();

        if (Math.hypot(h2.x - h1.x, h2.y - h1.y) < 8) {
          if (w1.mass > w2.mass) {
            w2.alive = false;
            w2.killedBy = w1.name;
            w1.mass += w2.mass * 0.5;
          } else {
            w1.alive = false;
            w1.killedBy = w2.name;
            w2.mass += w1.mass * 0.5;
          }
        }
      }
    }

    // Drop food when boosting
    for (const [id, worm] of this.worms) {
      if (worm.alive && worm.boosting) {
        if (Math.random() > 0.7) {
          const head = worm.getHead();
          this.food.push({
            x: head.x + (Math.random() - 0.5) * 20,
            y: head.y + (Math.random() - 0.5) * 20,
            value: 1
          });
        }
      }
    }

    // Refill food
    while (this.food.length < CONFIG.FOOD_COUNT_TARGET) {
      this.food.push({
        x: Math.random() * CONFIG.WORLD_WIDTH,
        y: Math.random() * CONFIG.WORLD_HEIGHT,
        value: 1
      });
    }

    // Manage bots
    while (this.bots.length < CONFIG.BOT_COUNT_TARGET) {
      this.addBot();
    }
  }

  getSnapshot() {
    const worms = [];
    for (const [id, worm] of this.worms) {
      if (!worm.alive) continue;
      const decimated = [];
      for (let i = 0; i < worm.segments.length; i += 2) {
        decimated.push(worm.segments[i]);
      }
      if (worm.segments.length % 2 === 1) {
        decimated.push(worm.segments[worm.segments.length - 1]);
      }
      worms.push({
        id: worm.id,
        name: worm.name,
        mass: Math.floor(worm.mass),
        skinIndex: worm.skinIndex,
        segments: decimated.slice(0, 80)
      });
    }

    worms.sort((a, b) => b.mass - a.mass);
    const leaderboard = worms.slice(0, CONFIG.LEADERBOARD_SIZE);

    return {
      type: 'snapshot',
      worms: worms,
      food: this.food.slice(0, 500),
      leaderboard: leaderboard.map((w, i) => ({
        rank: i + 1,
        name: w.name,
        mass: w.mass
      }))
    };
  }
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const game = new Game();

let playerWormMap = new Map(); // ws -> wormId

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'join') {
        const wormId = game.addWorm(data.name, data.skinIndex);
        playerWormMap.set(ws, wormId);
        ws.send(JSON.stringify({ type: 'joined', wormId }));
      } else if (data.type === 'input') {
        const wormId = playerWormMap.get(ws);
        if (wormId) {
          const worm = game.worms.get(wormId);
          if (worm) {
            worm.direction = data.dir;
            worm.boosting = data.boost;
          }
        }
      }
    } catch (e) {
      console.error('Message parse error:', e);
    }
  });

  ws.on('close', () => {
    const wormId = playerWormMap.get(ws);
    if (wormId) {
      const worm = game.worms.get(wormId);
      if (worm) {
        worm.alive = false;
      }
      playerWormMap.delete(ws);
    }
    console.log('Client disconnected');
  });
});

// Game loop
setInterval(() => {
  game.update();
  const snapshot = game.getSnapshot();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(snapshot));
    }
  });
}, 1000 / CONFIG.TICK_RATE);

server.listen(CONFIG.PORT, () => {
  console.log(`Server running on port ${CONFIG.PORT}`);
});
