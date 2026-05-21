// server.js
const express = require('express');
const path    = require('path');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Serve index.html for all routes (SPA) ─────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Health check ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'CatTrainer RPG', timestamp: new Date().toISOString() });
});

// ── Start ─────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║     🐱 CatTrainer RPG Server 🐱     ║
  ║  Running on http://localhost:${PORT}   ║
  ╚══════════════════════════════════════╝
  `);
});

module.exports = app;
