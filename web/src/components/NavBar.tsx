import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Route, ClipboardList, HardHat, Truck, Award, Users, type LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { cn } from "@/lib/utils";

const NAV_LINKS: { to: string; icon: LucideIcon; key: string }[] = [
  { to: "/dispatch",  icon: Route,          key: "nav.dispatch" },
  { to: "/orders",    icon: ClipboardList,  key: "nav.orders" },
  { to: "/mechanics", icon: HardHat,        key: "nav.mechanics" },
  { to: "/vehicles",  icon: Truck,          key: "nav.vehicles" },
  { to: "/skills",    icon: Award,          key: "nav.skills" },
  { to: "/clients",   icon: Users,          key: "nav.clients" },
];

export function NavBar() {
  const { t } = useTranslation();
  return (
    <aside className="w-64 min-w-[256px] h-full border-r border-[var(--color-hairline)] bg-[var(--color-surface-panel)] flex flex-col overflow-y-auto z-10 shrink-0">
      <div className="flex items-center gap-2.5 p-4 border-b border-[var(--color-hairline)]">
        <svg width="36" height="36" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
          <rect x="15" y="10" width="70" height="13" rx="2" fill="#c4622a"/>
          <rect x="43" y="10" width="14" height="40" rx="1.5" fill="#1e2438"/>
          <path d="M 38,50 A 12,12 0 0,1 62,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M 27,50 A 23,23 0 0,1 73,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
          <path d="M 16,50 A 34,34 0 0,1 84,50" fill="none" stroke="#1e2438" strokeWidth="5.5" strokeLinecap="round"/>
        </svg>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[0.8rem] font-bold tracking-[0.08em] uppercase text-[var(--color-brand-strong)] leading-tight whitespace-nowrap">
            TerraPulse
          </span>
          <span className="font-mono text-[0.65rem] text-[var(--color-text-subtle)] tracking-[0.05em] uppercase whitespace-nowrap">
            Fleet Ops
          </span>
        </div>
      </div>

      <nav className="flex-1 px-1 py-2 flex flex-col gap-0.5">
        {NAV_LINKS.map(({ to, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--radius-sm)] text-[var(--text-sm)] no-underline border-l-4 border-transparent transition-colors",
                isActive
                  ? "bg-[var(--color-surface-container-high)] text-[var(--color-brand-strong)] font-semibold border-l-[var(--color-brand)] pl-2.5"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-text)]"
              )
            }
          >
            <Icon className="w-[18px] h-[18px] shrink-0" />
            {t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-[var(--color-hairline)] px-4 py-3 flex items-center justify-between gap-2">
        <span className="text-[var(--text-xs)] text-[var(--color-text-subtle)]">{t("app.tagline")}</span>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
