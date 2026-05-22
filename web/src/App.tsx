import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { NavBar } from "./components/NavBar";
import { BottomNav } from "./components/BottomNav";
import { DispatchPage } from "./components/DispatchPage";
import { ClientsPage } from "./pages/ClientsPage";
import { MechanicsPage } from "./pages/MechanicsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { VehiclesPage } from "./pages/VehiclesPage";
import { SkillsPage } from "./pages/SkillsPage";
import { ToastProvider } from "./components/Toast";
import { TooltipProvider } from "./components/ui/tooltip";
import { useDispatchSocket } from "./hooks/useDispatchSocket";
import { useIsMobile } from "./hooks/useResizableSplit";
import { ClerkSync } from "./components/ClerkSync";

function AuthenticatedShell() {
  useDispatchSocket();
  const isMobile = useIsMobile();
  return (
    <ToastProvider>
      <TooltipProvider>
        <BrowserRouter>
          <div className={isMobile ? "flex flex-col h-full" : "flex flex-row h-full overflow-hidden"}>
            {!isMobile && <NavBar />}
            <div
              className="flex-1 min-w-0 overflow-y-auto bg-[var(--color-surface-app)] flex flex-col"
              style={isMobile ? { paddingBottom: "56px" } : { height: "100%" }}
            >
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
            {isMobile && <BottomNav />}
          </div>
        </BrowserRouter>
      </TooltipProvider>
    </ToastProvider>
  );
}

export default function App() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <ClerkSync />
        <AuthenticatedShell />
      </SignedIn>
    </>
  );
}
