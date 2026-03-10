import { useState, type FormEvent } from "react";

interface Product {
  id:              number;
  name:            string;
  category:        string;
  price:           string;
  description:     string;
  stock:           number;
  times_ordered:   number;
  total_units_sold: number;
}

export default function Search() {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched,setSearched]= useState(false);
  const [error,   setError]   = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError("");
    setResults([]);
    setSearched(true);
    const t0 = performance.now();

    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setElapsed(Math.round(performance.now() - t0));

      if (!res.ok) { setError(data.error ?? "Search failed"); return; }
      setResults(data.results ?? []);
    } catch {
      setError("Network error — is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Product Search</h1>
        <p>Search across the entire product catalogue by name, description, or category.</p>
      </div>

      <form className="search-bar" onSubmit={handleSearch}>
        <input
          className="form-input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="e.g. wireless, keyboard, storage…"
          autoFocus
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {loading && (
        <div className="spinner-wrap">
          <div className="spinner" /> Running full-catalogue query…
        </div>
      )}

      {!loading && searched && !error && (
        <div className="card">
          <div className="card-title" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{results.length} result{results.length !== 1 ? "s" : ""} for "{query}"</span>
            {elapsed !== null && (
              <span style={{ fontSize: ".78rem", color: "var(--text-muted)", fontWeight: 400 }}>
                {elapsed} ms
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No products matched your query.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Times Ordered</th>
                    <th>Units Sold</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                        <div style={{ fontSize: ".8rem", color: "var(--text-muted)", marginTop: ".15rem" }}>
                          {p.description?.slice(0, 70)}…
                        </div>
                      </td>
                      <td><span className="badge badge-secondary">{p.category}</span></td>
                      <td>${parseFloat(p.price).toFixed(2)}</td>
                      <td>{p.stock}</td>
                      <td>{p.times_ordered ?? 0}</td>
                      <td>{p.total_units_sold ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
