import { NavLink } from "react-router-dom";

export function NavBar() {
  return (
    <header className="app-header">
      <h1>TerraPulse</h1>
      <nav>
        <NavLink to="/dispatch"  className={({ isActive }) => isActive ? "active" : ""}>Dispatch</NavLink>
        <NavLink to="/orders"    className={({ isActive }) => isActive ? "active" : ""}>Orders</NavLink>
        <NavLink to="/mechanics" className={({ isActive }) => isActive ? "active" : ""}>Mechanics</NavLink>
        <NavLink to="/vehicles"  className={({ isActive }) => isActive ? "active" : ""}>Vehicles</NavLink>
        <NavLink to="/skills"    className={({ isActive }) => isActive ? "active" : ""}>Skills</NavLink>
        <NavLink to="/clients"   className={({ isActive }) => isActive ? "active" : ""}>Clients</NavLink>
      </nav>
      <span className="muted">live earthmoving fleet</span>
    </header>
  );
}
