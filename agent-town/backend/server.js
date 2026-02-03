/**
 * Agent Town Server
 * - Serves static frontend
 * - Runs simulation engine
 * - WebSocket broadcasts state to all clients
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SimulationEngine } from './simulation/engine.js';
import { BlogReader } from './blog-reader/reader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Configuration
const PORT = process.env.PORT || 3000;
const BROADCAST_INTERVAL = 100; // ms - state sync frequency
const BLOG_BASE_URL = process.env.BLOG_URL || 'https://yuxu.ge';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Serve static frontend
app.use(express.static(join(__dirname, '../frontend')));
app.use(express.json());

// Initialize components
const blogReader = new BlogReader(BLOG_BASE_URL);
const simulation = new SimulationEngine({
  worldSize: { width: 800, height: 600 },
  blogReader,
  openaiApiKey: OPENAI_API_KEY
});

// Connected clients
const clients = new Set();

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  // Send initial state
  ws.send(JSON.stringify({
    type: 'init',
    data: simulation.getFullState()
  }));

  // Handle client messages
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      await handleClientMessage(ws, msg);
    } catch (e) {
      console.error('Invalid message:', e);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });
});

// Handle messages from clients
async function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'get_agent_profile':
      const profile = simulation.getAgentProfile(msg.agentId);
      ws.send(JSON.stringify({ type: 'agent_profile', data: profile }));
      break;

    case 'trigger_read_blog':
      // Manually trigger an agent to read a blog post
      const result = await simulation.triggerAgentReadBlog(msg.agentId, msg.postSlug);
      ws.send(JSON.stringify({ type: 'read_result', data: result }));
      break;

    case 'get_comments':
      const comments = simulation.getAllComments();
      ws.send(JSON.stringify({ type: 'comments', data: comments }));
      break;

    case 'set_speed':
      simulation.setSpeed(msg.speed);
      break;
  }
}

// Broadcast state to all clients
function broadcastState() {
  const state = simulation.getState();
  const message = JSON.stringify({
    type: 'state',
    data: state,
    timestamp: Date.now()
  });

  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  }
}

// Broadcast events (new comments, etc.)
simulation.on('comment', (comment) => {
  const message = JSON.stringify({
    type: 'new_comment',
    data: comment
  });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
});

simulation.on('activity', (activity) => {
  const message = JSON.stringify({
    type: 'activity',
    data: activity
  });
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(message);
    }
  }
});

// API endpoints
app.get('/api/state', (req, res) => {
  res.json(simulation.getFullState());
});

app.get('/api/agents', (req, res) => {
  res.json(simulation.getAgents());
});

app.get('/api/agents/:id', (req, res) => {
  const profile = simulation.getAgentProfile(req.params.id);
  if (profile) {
    res.json(profile);
  } else {
    res.status(404).json({ error: 'Agent not found' });
  }
});

app.get('/api/comments', (req, res) => {
  res.json(simulation.getAllComments());
});

app.get('/api/posts', async (req, res) => {
  const posts = await blogReader.getPosts();
  res.json(posts);
});

// Start server
server.listen(PORT, () => {
  console.log(`🏘️  Agent Town running at http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`📚 Blog URL: ${BLOG_BASE_URL}`);

  // Start simulation loop
  simulation.start();

  // Start broadcasting state
  setInterval(broadcastState, BROADCAST_INTERVAL);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  simulation.stop();
  server.close();
  process.exit(0);
});
