import { useEffect, useState } from "react";

interface Stats {
  total_orders:   number;
  total_revenue:  string;
  total_products: number;
  total_users:    number;
}

interface RecentOrder {
  id:         number;
  username:   string;
  status:     string;
  total:      string;
  created_at: string;
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    completed:  "badge-success",
    processing: "badge-info",
    pending:    "badge-warning",
    cancelled:  "badge-danger",
  };
  return `badge ${map[s] ?? "badge-secondary"}`;
}

export default function Home() {
  const [stats,  setStats]  = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch the container's actual bridge IP from the backend so students always
  // see the correct attack target — even when the page is accessed via localhost.
  const [targetIP, setTargetIP] = useState<string>(window.location.hostname);

  useEffect(() => {
    fetch("/api/target-ip")
      .then(r => r.json())
      .then(d => { if (d.ip) setTargetIP(d.ip); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Fetch summary stats + recent orders
    Promise.all([
      fetch("/api/orders").then(r => r.json()),
      fetch("/api/reports").then(r => r.json()),
    ])
      .then(([ordersData, reportsData]) => {
        const orders: RecentOrder[] = (ordersData.orders ?? []).slice(0, 8);
        setRecent(orders);

        const revenue = (ordersData.orders ?? [])
          .filter((o: RecentOrder) => o.status === "completed")
          .reduce((acc: number, o: RecentOrder) => acc + parseFloat(o.total), 0);

        setStats({
          total_orders:   ordersData.count ?? 0,
          total_revenue:  revenue.toFixed(2),
          total_products: reportsData.category_sales?.length
            ? reportsData.category_sales.reduce((a: number, c: { units_sold: number }) => a + Number(c.units_sold), 0)
            : 0,
          total_users:    reportsData.top_customers?.length ?? 0,
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="spinner-wrap">
      <div className="spinner" /> Loading dashboard…
    </div>
  );

  return (
    <div>
      {/* ── Lab Target Banner ─────────────────────────────────────────── */}
      <div style={{
        background: "#0f172a", color: "#f1f5f9", borderRadius: "var(--radius)",
        padding: "1rem 1.5rem", marginBottom: "1.75rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "1rem",
        border: "1px solid #334155",
      }}>
        <div>
          <div style={{ fontSize: ".72rem", textTransform: "uppercase",
            letterSpacing: ".08em", color: "#94a3b8", marginBottom: ".3rem" }}>
            🎯 Lab Target IP
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <code style={{ fontSize: "1.3rem", fontWeight: 700, color: "#38bdf8",
              fontFamily: "monospace", letterSpacing: ".04em" }}>
              {targetIP}
            </code>
            <span style={{ fontSize: ".8rem", color: "#64748b" }}>port 80</span>
          </div>
        </div>
      </div>

      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Welcome back, Admin — here is today's overview.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Total Orders</div>
          <div className="stat-value">{stats?.total_orders ?? 0}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenue (completed)</div>
          <div className="stat-value">${stats?.total_revenue ?? "0.00"}</div>
          <div className="stat-sub">USD</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value">{stats?.total_products ?? 0}</div>
          <div className="stat-sub">All products</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Top Customers</div>
          <div className="stat-value">{stats?.total_users ?? 0}</div>
          <div className="stat-sub">By lifetime value</div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent Orders</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Total</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(o => (
                <tr key={o.id}>
                  <td>#{o.id}</td>
                  <td>{o.username}</td>
                  <td><span className={statusBadge(o.status)}>{o.status}</span></td>
                  <td>${parseFloat(o.total).toFixed(2)}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
