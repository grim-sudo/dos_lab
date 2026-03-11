import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Navbar   from "./components/Navbar.tsx";
import Home     from "./pages/Home.tsx";
import Login    from "./pages/Login.tsx";
import Search   from "./pages/Search.tsx";
import Reports  from "./pages/Reports.tsx";
import Orders   from "./pages/Orders.tsx";

/** Returns the stored auth object, or null if not logged in. */
export function getAuth() {
  try {
    const raw = localStorage.getItem("trackshop_auth");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Wraps a route that requires authentication. */
function RequireAuth({ children }: { children: ReactNode }) {
  return getAuth() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected */}
          <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
          <Route path="/search"  element={<RequireAuth><Search /></RequireAuth>}  />
          <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
          <Route path="/orders"  element={<RequireAuth><Orders /></RequireAuth>}  />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
