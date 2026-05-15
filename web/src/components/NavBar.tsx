import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

const NAV_LINKS = [
  { to: "/dispatch",  icon: "route",                key: "nav.dispatch" },
  { to: "/orders",    icon: "assignment",            key: "nav.orders" },
  { to: "/mechanics", icon: "engineering",           key: "nav.mechanics" },
  { to: "/vehicles",  icon: "construction",          key: "nav.vehicles" },
  { to: "/skills",    icon: "workspace_premium",     key: "nav.skills" },
  { to: "/clients",   icon: "group",                 key: "nav.clients" },
];

export function NavBar() {
  const { t } = useTranslation();
  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <span className="material-symbols-outlined">precision_manufacturing</span>
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">TerraPulse</span>
          <span className="sidebar-brand-tagline">Fleet Ops</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_LINKS.map(({ to, icon, key }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => isActive ? "active" : ""}
          >
            <span className="material-symbols-outlined">{icon}</span>
            {t(key)}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-label">{t("app.tagline")}</span>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
