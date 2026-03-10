"use strict";

// ── /api/login ────────────────────────────────────────────────────────────────
// Vulnerability: No rate limiting, no account lockout.
// An HTTP flood against POST /api/login can exhaust DB connections
// and CPU due to unbounded concurrent authentication queries.
// ─────────────────────────────────────────────────────────────────────────────

const { Router } = require("express");

module.exports = function authRouter(pool) {
  const router = Router();

  router.post("/", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "username and password required" });
    }

    try {
      // Intentionally inefficient: no indexed lookup optimisation,
      // plaintext comparison done in-DB (no bcrypt — educational simplicity).
      const { rows } = await pool.query(
        `SELECT id, username, email, role
           FROM users
          WHERE username = $1
            AND password  = $2`,
        [username, password]
      );

      if (rows.length === 0) {
        // Artificial 200 ms "think time" — amplifies flood impact
        await sleep(200);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      res.json({
        token: Buffer.from(`${rows[0].id}:${Date.now()}`).toString("base64"),
        user: rows[0],
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
