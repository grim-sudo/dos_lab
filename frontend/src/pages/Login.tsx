import { useState, type FormEvent } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status,   setStatus]   = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message,  setMessage]  = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus("ok");
        setMessage(`Welcome, ${data.user.username}! (role: ${data.user.role})`);
      } else {
        setStatus("error");
        setMessage(data.error ?? "Login failed");
      }
    } catch {
      setStatus("error");
      setMessage("Network error — check that the backend is running.");
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <span>🛒</span>
          <h2>Sign in to TrackShop</h2>
          <p style={{ color: "var(--text-muted)", fontSize: ".85rem", marginTop: ".25rem" }}>
            Staff &amp; admin portal
          </p>
        </div>

        <div className="card">
          {status === "ok"    && <div className="alert alert-success">{message}</div>}
          {status === "error" && <div className="alert alert-error">{message}</div>}
          {status === "idle"  && (
            <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
              Demo credentials: <strong>admin / admin123</strong>
            </div>
          )}

          <form onSubmit={handleSubmit} autoComplete="off">
            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username"
                className="form-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password"
                required
              />
            </div>

            <button
              className="btn btn-primary"
              style={{ width: "100%", marginTop: ".5rem" }}
              type="submit"
              disabled={status === "loading"}
            >
              {status === "loading" ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{
          textAlign: "center", marginTop: "1.25rem",
          fontSize: ".8rem", color: "var(--text-muted)"
        }}>
          TrackShop v1.0 — Internal portal
        </p>
      </div>
    </div>
  );
}
