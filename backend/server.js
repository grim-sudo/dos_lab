"use strict";

const express = require("express");
const cors    = require("cors");
const { Pool } = require("pg");

const app  = express();
const port = process.env.PORT || 3000;

// ────────────────────────────────────────────────────────────────────────────
// Database pool
// ────────────────────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Intentionally small pool — easier to exhaust under load
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ────────────────────────────────────────────────────────────────────────────
// Middleware
// ────────────────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// NOTE: No rate-limiting middleware installed — intentional for lab exercise.
//       In production you would add: express-rate-limit, helmet, etc.

// ────────────────────────────────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────────────────────────────────
const authRouter    = require("./routes/auth");
const searchRouter  = require("./routes/search");
const reportsRouter = require("./routes/reports");
const ordersRouter  = require("./routes/orders");

app.use("/api/login",   authRouter(pool));
app.use("/api/search",  searchRouter(pool));
app.use("/api/reports", reportsRouter(pool));
app.use("/api/orders",  ordersRouter(pool));

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "db_error", error: err.message });
  }
});

// ── Products (for search dropdown seeding) ───────────────────────────────────
app.get("/api/products", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, name, category, price FROM products LIMIT 20"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Container IP (lab target banner) ────────────────────────────────────────
app.get("/api/target-ip", (_req, res) => {
  const nets = require("os").networkInterfaces();
  let ip = "127.0.0.1";
  outer: for (const iface of Object.values(nets)) {
    for (const addr of (iface ?? [])) {
      if (addr.family === "IPv4" && !addr.internal) { ip = addr.address; break outer; }
    }
  }
  res.json({ ip, port: 80 });
});

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ────────────────────────────────────────────────────────────────────────────
// Start
// ────────────────────────────────────────────────────────────────────────────
app.listen(port, "0.0.0.0", () => {
  console.log(`[TrackShop API] Listening on port ${port}`);
});
