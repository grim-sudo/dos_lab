import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">🛒 TrackShop</NavLink>
      <div className="navbar-links">
        <NavLink to="/"        end className={({ isActive }) => isActive ? "active" : ""}>Dashboard</NavLink>
        <NavLink to="/search"      className={({ isActive }) => isActive ? "active" : ""}>Search</NavLink>
        <NavLink to="/orders"      className={({ isActive }) => isActive ? "active" : ""}>Orders</NavLink>
        <NavLink to="/reports"     className={({ isActive }) => isActive ? "active" : ""}>Reports</NavLink>
        <NavLink to="/login"       className={({ isActive }) => isActive ? "active" : ""}>Login</NavLink>
      </div>
    </nav>
  );
}
