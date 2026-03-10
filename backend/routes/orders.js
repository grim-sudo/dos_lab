"use strict";

// ── /api/orders ───────────────────────────────────────────────────────────────
// Vulnerability (Application Layer DoS):
//   • Fetches full order history with all nested items — no pagination enforced.
//   • N+1 style nested loop for enriching each order row.
//   • No response streaming or cursor-based pagination.
//
// Students attack this with:
//   wrk -t8 -c200 -d60s http://TARGET/api/orders
// ─────────────────────────────────────────────────────────────────────────────

const { Router } = require("express");

module.exports = function ordersRouter(pool) {
  const router = Router();

  // GET /api/orders  — list all orders (intentionally unbounded)
  router.get("/", async (_req, res) => {
    try {
      // ── Step 1: fetch all orders ─────────────────────────────────────────
      const { rows: orders } = await pool.query(`
        SELECT
            o.id,
            o.status,
            o.total,
            o.created_at,
            u.username,
            u.email
          FROM orders o
          JOIN users u ON u.id = o.user_id
         ORDER BY o.created_at DESC
      `);

      // ── Step 2: N+1 enrichment — fetch items for every order individually ──
      // This is intentionally bad practice to amplify DB load per HTTP request.
      const enriched = await Promise.all(
        orders.map(async (order) => {
          const { rows: items } = await pool.query(
            `SELECT
                oi.quantity,
                oi.unit_price,
                p.name,
                p.category
               FROM order_items oi
               JOIN products p ON p.id = oi.product_id
              WHERE oi.order_id = $1`,
            [order.id]
          );
          return { ...order, items };
        })
      );

      res.json({ count: enriched.length, orders: enriched });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/orders/:id — single order detail
  router.get("/:id", async (req, res) => {
    try {
      const { rows: orders } = await pool.query(
        `SELECT o.*, u.username, u.email
           FROM orders o
           JOIN users u ON u.id = o.user_id
          WHERE o.id = $1`,
        [req.params.id]
      );

      if (orders.length === 0) {
        return res.status(404).json({ error: "Order not found" });
      }

      const { rows: items } = await pool.query(
        `SELECT oi.*, p.name, p.category, p.description
           FROM order_items oi
           JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = $1`,
        [req.params.id]
      );

      res.json({ ...orders[0], items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
