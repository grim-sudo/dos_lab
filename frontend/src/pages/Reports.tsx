import { useState, useEffect } from "react";

interface CategoryRow {
  category:    string;
  order_count: number;
  units_sold:  number;
  revenue:     string;
}

interface DayRow {
  day:           string;
  orders:        number;
  daily_revenue: string;
}

interface CustomerRow {
  id:            number;
  username:      string;
  email:         string;
  total_orders:  number;
  lifetime_value:string;
}

interface ReportData {
  generated_at:   string;
  category_sales: CategoryRow[];
  daily_volume:   DayRow[];
  top_customers:  CustomerRow[];
}

export default function Reports() {
  const [data,    setData]    = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  function load() {
    setLoading(true);
    setError("");
    const t0 = performance.now();
    fetch("/api/reports")
      .then(r => {
        setElapsed(Math.round(performance.now() - t0));
        if (!r.ok) throw new Error("Failed to load report");
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  // Build simple CSS bar chart from last 14 days of daily volume
  const last14 = (data?.daily_volume ?? []).slice(-14);
  const maxOrders = Math.max(...last14.map(d => Number(d.orders)), 1);

  return (
    <div>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Sales Reports</h1>
            <p>Aggregated sales metrics for the last 90 days.</p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "↺ Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="spinner-wrap">
          <div className="spinner" /> Generating report (heavy query)…
        </div>
      )}

      {!loading && data && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: "1rem", fontSize: ".8rem", color: "var(--text-muted)" }}>
            <span>Generated: {new Date(data.generated_at).toLocaleString()}</span>
            {elapsed !== null && <span>Response time: {elapsed} ms</span>}
          </div>

          {/* ── Daily volume chart ── */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="card-title">Daily Orders — Last 14 Days</div>
            {last14.length === 0 ? (
              <p style={{ color: "var(--text-muted)" }}>No data available.</p>
            ) : (
              <div className="bar-chart">
                {last14.map(d => (
                  <div className="bar-row" key={d.day}>
                    <div
                      className="bar"
                      style={{ height: `${(Number(d.orders) / maxOrders) * 100}%` }}
                      title={`${d.orders} orders`}
                    />
                    <div className="bar-label">
                      {new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Revenue by category ── */}
          <div className="card" style={{ marginBottom: "1.25rem" }}>
            <div className="card-title">Revenue by Category</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Orders</th>
                    <th>Units Sold</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.category_sales.map(c => (
                    <tr key={c.category}>
                      <td><span className="badge badge-secondary">{c.category}</span></td>
                      <td>{c.order_count}</td>
                      <td>{c.units_sold}</td>
                      <td><strong>${parseFloat(c.revenue).toFixed(2)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Top customers ── */}
          <div className="card">
            <div className="card-title">Top 10 Customers by Lifetime Value</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Customer</th>
                    <th>Email</th>
                    <th>Orders</th>
                    <th>Lifetime Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_customers.map((c, i) => (
                    <tr key={c.id}>
                      <td>#{i + 1}</td>
                      <td><strong>{c.username}</strong></td>
                      <td style={{ color: "var(--text-muted)" }}>{c.email}</td>
                      <td>{c.total_orders}</td>
                      <td>${parseFloat(c.lifetime_value).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
