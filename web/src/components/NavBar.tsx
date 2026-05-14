import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function NavBar() {
  const { t } = useTranslation();
  return (
    <header className="app-header">
      <h1>{t("app.title")}</h1>
      <nav>
        <NavLink to="/dispatch"  className={({ isActive }) => isActive ? "active" : ""}>{t("nav.dispatch")}</NavLink>
        <NavLink to="/orders"    className={({ isActive }) => isActive ? "active" : ""}>{t("nav.orders")}</NavLink>
        <NavLink to="/mechanics" className={({ isActive }) => isActive ? "active" : ""}>{t("nav.mechanics")}</NavLink>
        <NavLink to="/vehicles"  className={({ isActive }) => isActive ? "active" : ""}>{t("nav.vehicles")}</NavLink>
        <NavLink to="/skills"    className={({ isActive }) => isActive ? "active" : ""}>{t("nav.skills")}</NavLink>
        <NavLink to="/clients"   className={({ isActive }) => isActive ? "active" : ""}>{t("nav.clients")}</NavLink>
      </nav>
      <span className="muted">{t("app.tagline")}</span>
      <LanguageSwitcher />
    </header>
  );
}
