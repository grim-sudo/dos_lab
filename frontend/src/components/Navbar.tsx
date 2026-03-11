import { NavLink, useNavigate } from "react-router-dom";
import { getAuth } from "../App.tsx";

export default function Navbar() {
  const navigate  = useNavigate();
  const auth      = getAuth();
  const username  = auth?.user?.username ?? null;

  function handleLogout() {
    localStorage.removeItem("trackshop_auth");
    navigate("/login", { replace: true });
  }

  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">🛒 TrackShop</NavLink>

      {/* LEFT: page navigation — only shown when authenticated */}
      {auth && (
        <div className="navbar-left">
          <NavLink to="/"        end className={({ isActive }) => isActive ? "active" : ""}>Dashboard</NavLink>
          <NavLink to="/search"      className={({ isActive }) => isActive ? "active" : ""}>Search</NavLink>
          <NavLink to="/orders"      className={({ isActive }) => isActive ? "active" : ""}>Orders</NavLink>
          <NavLink to="/reports"     className={({ isActive }) => isActive ? "active" : ""}>Reports</NavLink>
        </div>
      )}

      {/* RIGHT: auth controls */}
      <div className="navbar-right">
        {auth ? (
          <>
            <span style={{ color: "rgba(255,255,255,.75)", fontSize: ".82rem" }}>
              {username}
            </span>
            <button
              onClick={handleLogout}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,.35)",
                color: "rgba(255,255,255,.85)", borderRadius: "var(--radius)",
                padding: ".25rem .75rem", cursor: "pointer", fontSize: ".82rem",
              }}
            >
              Logout
            </button>
          </>
        ) : (
          <NavLink to="/login" className={({ isActive }) => isActive ? "active" : ""}>Login</NavLink>
        )}
      </div>
    </nav>
  );
}
