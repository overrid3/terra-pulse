import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Route, ClipboardList, HardHat, Truck, Award, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS: { to: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatch",  icon: Route,         key: "nav.dispatch" },
  { to: "/orders",    icon: ClipboardList, key: "nav.orders" },
  { to: "/mechanics", icon: HardHat,       key: "nav.mechanics" },
  { to: "/vehicles",  icon: Truck,         key: "nav.vehicles" },
  { to: "/skills",    icon: Award,         key: "nav.skills" },
  { to: "/clients",   icon: Users,         key: "nav.clients" },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-20 bg-[var(--color-surface-panel)] border-t border-[var(--color-hairline)] flex"
      aria-label="Main navigation"
    >
      {NAV_LINKS.map(({ to, icon: Icon, key }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 text-[0.6rem] font-medium no-underline transition-colors",
              isActive
                ? "text-[var(--color-brand-strong)]"
                : "text-[var(--color-text-muted)]"
            )
          }
        >
          <Icon className="w-5 h-5 shrink-0" />
          <span className="leading-none truncate max-w-full">{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}
