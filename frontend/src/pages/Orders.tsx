import { Fragment, useEffect, useState } from "react";

interface OrderItem {
  name:       string;
  category:   string;
  quantity:   number;
  unit_price: string;
}

interface Order {
  id:         number;
  username:   string;
  email:      string;
  status:     string;
  total:      string;
  created_at: string;
  items:      OrderItem[];
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

export default function Orders() {
  const [orders,   setOrders]   = useState<Order[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filter,   setFilter]   = useState("all");
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    fetch("/api/orders")
      .then(r => r.json())
      .then(d => setOrders(d.orders ?? []))
      .catch(() => setError("Failed to fetch orders"))
      .finally(() => setLoading(false));
  }, []);

  const statusOptions = ["all", "completed", "processing", "pending", "cancelled"];

  const visible = orders.filter(o => {
    const matchStatus = filter === "all" || o.status === filter;
    const matchSearch = !search ||
      o.username.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search);
    return matchStatus && matchSearch;
  });

  if (loading) return (
    <div className="spinner-wrap">
      <div className="spinner" /> Loading orders (N+1 query in progress)…
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <h1>Orders</h1>
        <p>Full order history with item breakdown.</p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters */}
      <div style={{ display: "flex", gap: ".75rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <input
          className="form-input"
          style={{ maxWidth: "220px" }}
          type="search"
          placeholder="Search customer or order #"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: "flex", gap: ".4rem", flexWrap: "wrap" }}>
          {statusOptions.map(s => (
            <button
              key={s}
              className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", alignSelf: "center",
          fontSize: ".85rem", color: "var(--text-muted)" }}>
          {visible.length} of {orders.length} orders
        </span>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <Fragment key={o.id}>
                  <tr>
                    <td>#{o.id}</td>
                    <td>
                      <strong>{o.username}</strong>
                      <div style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>{o.email}</div>
                    </td>
                    <td><span className={statusBadge(o.status)}>{o.status}</span></td>
                    <td>{o.items?.length ?? 0}</td>
                    <td><strong>${parseFloat(o.total).toFixed(2)}</strong></td>
                    <td>{new Date(o.created_at).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setExpanded(expanded === o.id ? null : o.id)}
                      >
                        {expanded === o.id ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>

                  {expanded === o.id && (
                    <tr key={`${o.id}-detail`}>
                      <td colSpan={7} style={{ background: "#f8fafc", padding: "1rem 1.5rem" }}>
                        <strong style={{ fontSize: ".85rem", color: "var(--text-muted)" }}>
                          Line Items
                        </strong>
                        <table style={{ marginTop: ".5rem" }}>
                          <thead>
                            <tr>
                              <th>Product</th>
                              <th>Category</th>
                              <th>Qty</th>
                              <th>Unit Price</th>
                              <th>Line Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(o.items ?? []).map((item, idx) => (
                              <tr key={idx}>
                                <td>{item.name}</td>
                                <td><span className="badge badge-secondary">{item.category}</span></td>
                                <td>{item.quantity}</td>
                                <td>${parseFloat(item.unit_price).toFixed(2)}</td>
                                <td>${(item.quantity * parseFloat(item.unit_price)).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    No orders match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
