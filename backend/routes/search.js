"use strict";

// ── /api/search ───────────────────────────────────────────────────────────────
// Vulnerability (Application Layer DoS):
//   • Full table scan — LIKE with leading wildcard prevents index use.
//   • No result limit enforced.
//   • No query result caching.
//   • Each flood request forces a full sequential scan across all tables.
//
// Students attack this with:  wrk -t4 -c200 -d60s "http://TARGET/api/search?q=a"
// ─────────────────────────────────────────────────────────────────────────────

const { Router } = require("express");

module.exports = function searchRouter(pool) {
  const router = Router();

  router.get("/", async (req, res) => {
    const q = (req.query.q || "").trim();

    if (q.length === 0) {
      return res.status(400).json({ error: "q parameter required" });
    }

    try {
      // ── Intentionally expensive query ────────────────────────────────────
      // Leading wildcard disables any B-tree index, forcing a full table scan.
      // The CROSS JOIN with order_items further inflates cost.
      const { rows } = await pool.query(
        `SELECT
              p.id,
              p.name,
              p.category,
              p.price,
              p.description,
              p.stock,
              COUNT(oi.id)         AS times_ordered,
              SUM(oi.quantity)     AS total_units_sold
         FROM products p
         LEFT JOIN order_items oi ON oi.product_id = p.id
        WHERE p.name        ILIKE $1
           OR p.description ILIKE $1
           OR p.category    ILIKE $1
        GROUP BY p.id
        ORDER BY times_ordered DESC`,
        [`%${q}%`]
      );

      res.json({ query: q, count: rows.length, results: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
