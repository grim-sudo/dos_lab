"use strict";

// ── /api/reports ──────────────────────────────────────────────────────────────
// Vulnerability (Application Layer DoS):
//   • Three heavy aggregation queries run sequentially per request.
//   • An artificial CPU-bound loop simulates on-the-fly CSV/PDF generation.
//   • No caching, no background job — every HTTP request reruns all work.
//
// Students attack this with:  wrk -t4 -c100 -d60s http://TARGET/api/reports
// ─────────────────────────────────────────────────────────────────────────────

const { Router } = require("express");

module.exports = function reportsRouter(pool) {
  const router = Router();

  router.get("/", async (_req, res) => {
    try {
      // ── Query 1: sales summary by category ──────────────────────────────
      const { rows: categorySales } = await pool.query(`
        SELECT
            p.category,
            COUNT(DISTINCT o.id)          AS order_count,
            SUM(oi.quantity)              AS units_sold,
            ROUND(SUM(oi.quantity * p.price)::numeric, 2) AS revenue
          FROM orders o
          JOIN order_items oi ON oi.order_id = o.id
          JOIN products    p  ON p.id        = oi.product_id
         WHERE o.created_at >= NOW() - INTERVAL '90 days'
         GROUP BY p.category
         ORDER BY revenue DESC
      `);

      // ── Query 2: daily order volume (last 30 days) ───────────────────────
      const { rows: dailyVolume } = await pool.query(`
        SELECT
            DATE(o.created_at) AS day,
            COUNT(*)           AS orders,
            SUM(o.total)       AS daily_revenue
          FROM orders o
         WHERE o.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(o.created_at)
         ORDER BY day
      `);

      // ── Query 3: top 10 customers by lifetime value ──────────────────────
      const { rows: topCustomers } = await pool.query(`
        SELECT
            u.id,
            u.username,
            u.email,
            COUNT(DISTINCT o.id)              AS total_orders,
            ROUND(SUM(o.total)::numeric, 2)   AS lifetime_value
          FROM users  u
          JOIN orders o ON o.user_id = u.id
         GROUP BY u.id
         ORDER BY lifetime_value DESC
         LIMIT 10
      `);

      // ── CPU-bound simulation: "report rendering" ─────────────────────────
      // Mimics generating a PDF/CSV on every request (no caching).
      const rendered = cpuBusyWork(200_000);

      res.json({
        generated_at:   new Date().toISOString(),
        category_sales: categorySales,
        daily_volume:   dailyVolume,
        top_customers:  topCustomers,
        _render_cycles: rendered,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};

// Deliberately wastes CPU cycles to amplify the DoS effect
function cpuBusyWork(iterations) {
  let x = 0;
  for (let i = 0; i < iterations; i++) {
    x += Math.sqrt(i) * Math.log(i + 1);
  }
  return iterations;
}
