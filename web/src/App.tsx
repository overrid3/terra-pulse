import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToastProvider } from "./components/Toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { useDispatchSocket } from "./hooks/useDispatchSocket";
import { ClerkSync } from "./components/ClerkSync";

export default function App() {
  useDispatchSocket();
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <ClerkSync />
        <ToastProvider>
          <TooltipProvider>
            <BrowserRouter>
              <div className="flex flex-row h-full overflow-hidden">
                <NavBar />
                <div className="flex-1 min-w-0 h-full overflow-y-auto bg-[var(--color-surface-app)] flex flex-col">
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
          </TooltipProvider>
        </ToastProvider>
      </SignedIn>
    </>
  );
}
