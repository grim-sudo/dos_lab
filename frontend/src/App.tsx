import { Routes, Route, Navigate } from "react-router-dom";
import Navbar   from "./components/Navbar.tsx";
import Home     from "./pages/Home.tsx";
import Login    from "./pages/Login.tsx";
import Search   from "./pages/Search.tsx";
import Reports  from "./pages/Reports.tsx";
import Orders   from "./pages/Orders.tsx";

export default function App() {
  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Routes>
          <Route path="/"        element={<Home />}    />
          <Route path="/login"   element={<Login />}   />
          <Route path="/search"  element={<Search />}  />
          <Route path="/reports" element={<Reports />} />
          <Route path="/orders"  element={<Orders />}  />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
