import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { useDispatchSocket } from "./hooks/useDispatchSocket";

export default function App() {
  useDispatchSocket();
  return (
    <BrowserRouter>
      <div className="app-shell">
        <NavBar />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dispatch" replace />} />
            <Route path="/dispatch" element={<DispatchPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/mechanics" element={<MechanicsPage />} />
            <Route path="/vehicles" element={<VehiclesPage />} />
            <Route path="/skills" element={<SkillsPage />} />
            <Route path="/clients" element={<ClientsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
