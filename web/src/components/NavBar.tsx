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
        <img src="/terra-pulse-logo.svg" alt="" aria-hidden="true" className="shrink-0 h-9 w-auto" />
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
        <span className="text-[0.55rem] text-[var(--color-text-subtle)] uppercase">{t("app.tagline")}</span>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
