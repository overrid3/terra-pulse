import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { queryKeys } from "../api/client";
import {
  ClientState, ClientSummary, ClientUpsert,
  Site, SiteUpsert, UUID
} from "../types";
import { useToast } from "../components/Toast";
import { AddressLookup } from "../components/AddressLookup";
import { SiteMap } from "../components/SiteMap";

type Filter = "ALL" | "ACTIVE" | "INACTIVE";

type PanelMode =
  | { type: "empty" }
  | { type: "detail"; clientId: UUID }
  | { type: "clientForm"; editing: ClientSummary | null }
  | { type: "siteDetail"; clientId: UUID; siteId: UUID }
  | { type: "siteForm"; clientId: UUID; editing: Site | null };

const EMPTY_CLIENT: ClientUpsert = {
  name: "", email: "", phone: "", vatNumber: "",
  addressLine1: "", addressLine2: "", city: "", postalCode: "", country: ""
};

const EMPTY_SITE: SiteUpsert = { name: "", lat: null, lng: null, locationLabel: null };

const LIST_WIDTH_KEY = "tp.clients.listWidth";
const DEFAULT_LIST_WIDTH = 320;
const MIN_LIST_WIDTH = 240;
const MAX_LIST_WIDTH = 560;

function clientDot(c: ClientSummary): string {
  if (c.state === "INACTIVE")  return "dot-inactive";
  if (c.openOrderCount > 0)    return "dot-has-orders";
  if (c.siteCount > 0)         return "dot-has-sites";
  return "dot-inactive";
}

function siteDot(s: Site): string {
  if (s.openOrderCount > 0) return "dot-has-orders";
  if (s.equipmentCount > 0) return "dot-has-sites";
  return "dot-inactive";
}

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(`(max-width: ${breakpoint}px)`).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}

function useResizableListWidth() {
  const [width, setWidth] = useState<number>(() => {
    const raw = localStorage.getItem(LIST_WIDTH_KEY);
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= MIN_LIST_WIDTH && n <= MAX_LIST_WIDTH ? n : DEFAULT_LIST_WIDTH;
  });
  const draggingRef = useRef(false);

  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.classList.add("clients-resizing");

    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!draggingRef.current) return;
      const clientX = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
      if (clientX == null) return;
      // Layout has 14px padding around the layout container; subtract it for stable feel.
      const next = Math.max(MIN_LIST_WIDTH, Math.min(MAX_LIST_WIDTH, clientX - 14));
      setWidth(next);
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.classList.remove("clients-resizing");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
      setWidth((w) => {
        localStorage.setItem(LIST_WIDTH_KEY, String(w));
        return w;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }, []);

  return { width, startDrag, dragging: draggingRef };
}

export function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const isMobile = useIsMobile();
  const { width: listWidth, startDrag } = useResizableListWidth();

  const clientsQ = useQuery({ queryKey: queryKeys.clients, queryFn: clientsApi.list });

  const [panelMode, setPanelMode] = useState<PanelMode>({ type: "empty" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const detailClientId =
    panelMode.type === "detail" ? panelMode.clientId
    : panelMode.type === "siteForm" ? panelMode.clientId
    : panelMode.type === "siteDetail" ? panelMode.clientId
    : null;

  const sitesQ = useQuery({
    queryKey: queryKeys.sites(detailClientId ?? ""),
    queryFn: () => sitesApi.list(detailClientId!),
    enabled: !!detailClientId
  });

  const clients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clientsQ.data ?? []).filter((c) => {
      if (filter !== "ALL" && c.state !== filter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [clientsQ.data, search, filter]);

  const selectedClientId = detailClientId;
  const selectedClient =
    selectedClientId ? (clientsQ.data ?? []).find((c) => c.id === selectedClientId) ?? null : null;
  const viewedSite =
    panelMode.type === "siteDetail"
      ? (sitesQ.data ?? []).find((s) => s.id === panelMode.siteId) ?? null
      : null;

  const isDetailView = panelMode.type !== "empty";
  const rootClass = `clients-layout ${isMobile && isDetailView ? "mobile-detail" : ""}`;

  function invalidateClients() { qc.invalidateQueries({ queryKey: queryKeys.clients }); }
  function invalidateSites(clientId: UUID) { qc.invalidateQueries({ queryKey: queryKeys.sites(clientId) }); }

  const createClientMut = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (created) => {
      invalidateClients();
      toast.success(t("clients.created"));
      setPanelMode({ type: "detail", clientId: created.id });
    },
    onError: (e) => toast.error(e)
  });
  const updateClientMut = useMutation({
    mutationFn: ({ id, body }: { id: UUID; body: ClientUpsert }) => clientsApi.update(id, body),
    onSuccess: (updated) => {
      invalidateClients();
      toast.success(t("clients.updated"));
      setPanelMode({ type: "detail", clientId: updated.id });
    },
    onError: (e) => toast.error(e)
  });
  const deleteClientMut = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => {
      invalidateClients();
      toast.success(t("clients.deleted"));
      setPanelMode({ type: "empty" });
    },
    onError: (e) => toast.error(e)
  });
  const setStateClientMut = useMutation({
    mutationFn: ({ id, state }: { id: UUID; state: ClientState }) => clientsApi.setState(id, state),
    onSuccess: (updated) => {
      invalidateClients();
      toast.success(updated.state === "ACTIVE" ? t("clients.reactivated") : t("clients.deactivated"));
    },
    onError: (e) => toast.error(e)
  });

  const createSiteMut = useMutation({
    mutationFn: ({ clientId, body }: { clientId: UUID; body: SiteUpsert }) => sitesApi.create(clientId, body),
    onSuccess: (_, vars) => {
      invalidateSites(vars.clientId);
      invalidateClients();
      toast.success(t("sites.created"));
      setPanelMode({ type: "detail", clientId: vars.clientId });
    },
    onError: (e) => toast.error(e)
  });
  const updateSiteMut = useMutation({
    mutationFn: ({ clientId, siteId, body }: { clientId: UUID; siteId: UUID; body: SiteUpsert }) =>
      sitesApi.update(clientId, siteId, body),
    onSuccess: (_, vars) => {
      invalidateSites(vars.clientId);
      invalidateClients();
      toast.success(t("sites.updated"));
      setPanelMode({ type: "siteDetail", clientId: vars.clientId, siteId: vars.siteId });
    },
    onError: (e) => toast.error(e)
  });
  const deleteSiteMut = useMutation({
    mutationFn: ({ clientId, siteId }: { clientId: UUID; siteId: UUID }) => sitesApi.delete(clientId, siteId),
    onSuccess: (_, vars) => {
      invalidateSites(vars.clientId);
      invalidateClients();
      toast.success(t("sites.deleted"));
      if (panelMode.type === "siteDetail" && panelMode.siteId === vars.siteId)
        setPanelMode({ type: "detail", clientId: vars.clientId });
    },
    onError: (e) => toast.error(e)
  });

  const goBackToList = () => setPanelMode({ type: "empty" });

  return (
    <div className={rootClass}>
      {/* Left: client list */}
      <div
        className="client-list-panel"
        style={{ ["--clients-list-width" as string]: `${listWidth}px` }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h2>{t("clients.pageTitle", { count: clientsQ.data?.length ?? 0 })}</h2>
          <button
            className="ghost"
            onClick={() => setPanelMode({ type: "clientForm", editing: null })}
          >
            + {t("clients.addClient")}
          </button>
        </div>
        <input
          className="client-list-search"
          placeholder={t("common.find") + "…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="seg-control" style={{ alignSelf: "flex-start" }}>
          <button type="button" className={filter === "ALL" ? "active" : ""} onClick={() => setFilter("ALL")}>
            {t("clients.filterAll")}
          </button>
          <button type="button" className={filter === "ACTIVE" ? "active" : ""} onClick={() => setFilter("ACTIVE")}>
            {t("clients.filterActive")}
          </button>
          <button type="button" className={filter === "INACTIVE" ? "active" : ""} onClick={() => setFilter("INACTIVE")}>
            {t("clients.filterInactive")}
          </button>
        </div>
        <div className="client-list-scroll">
          {clients.map((c) => (
            <div
              key={c.id}
              className={`client-card ${selectedClientId === c.id ? "selected" : ""} ${c.state === "INACTIVE" ? "inactive" : ""}`}
              onClick={() => setPanelMode({ type: "detail", clientId: c.id })}
            >
              <div className="client-card-header">
                <span className="client-card-name">{c.name}</span>
                <span className={`status-dot ${clientDot(c)}`} />
              </div>
              <div className="client-card-counts">
                <div>
                  <div className="client-card-count-label">{t("sites.activeSites")}</div>
                  <div className="client-card-count-value">{c.siteCount}</div>
                </div>
                <div>
                  <div className="client-card-count-label">{t("sites.openOrders")}</div>
                  <div className="client-card-count-value">{c.openOrderCount}</div>
                </div>
              </div>
            </div>
          ))}
          {clients.length === 0 && (
            <p className="muted" style={{ padding: "8px 0" }}>
              {clientsQ.data?.length === 0 ? t("clients.noClients") : t("errors.noMatches")}
            </p>
          )}
        </div>
      </div>

      {/* Drag handle (desktop only via CSS) */}
      {!isMobile && (
        <div
          className="clients-split-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize"
          onMouseDown={startDrag}
          onTouchStart={startDrag}
        />
      )}

      {/* Right: detail / form panel */}
      <div className="client-detail-panel">
        {panelMode.type === "empty" && (
          <div className="detail-empty-state">
            <span className="material-symbols-outlined">group</span>
            <span>{t("clients.selectClient")}</span>
          </div>
        )}

        {panelMode.type === "detail" && selectedClient && (
          <ClientDetailView
            client={selectedClient}
            sites={sitesQ.data}
            sitesLoading={sitesQ.isLoading}
            isMobile={isMobile}
            onBack={goBackToList}
            onEdit={() => setPanelMode({ type: "clientForm", editing: selectedClient })}
            onDelete={() => {
              if (confirm(t("common.deleteConfirm", { label: selectedClient.name })))
                deleteClientMut.mutate(selectedClient.id);
            }}
            onToggleState={() => {
              const target: ClientState = selectedClient.state === "ACTIVE" ? "INACTIVE" : "ACTIVE";
              const msg = target === "INACTIVE"
                ? t("clients.deactivateConfirm", { name: selectedClient.name })
                : t("clients.reactivateConfirm", { name: selectedClient.name });
              if (confirm(msg))
                setStateClientMut.mutate({ id: selectedClient.id, state: target });
            }}
            togglingState={setStateClientMut.isPending}
            onAddSite={() => setPanelMode({ type: "siteForm", clientId: selectedClient.id, editing: null })}
            onViewSite={(siteId) => setPanelMode({ type: "siteDetail", clientId: selectedClient.id, siteId })}
            onEditSite={(site) => setPanelMode({ type: "siteForm", clientId: selectedClient.id, editing: site })}
            onDeleteSite={(site) => {
              if (confirm(t("sites.deleteSiteConfirm", { name: site.name })))
                deleteSiteMut.mutate({ clientId: selectedClient.id, siteId: site.id });
            }}
          />
        )}

        {panelMode.type === "siteDetail" && selectedClient && (
          <SiteDetailView
            client={selectedClient}
            site={viewedSite}
            loading={sitesQ.isLoading}
            isMobile={isMobile}
            onBackToList={goBackToList}
            onBackToClient={() => setPanelMode({ type: "detail", clientId: selectedClient.id })}
            onEdit={() => viewedSite && setPanelMode({ type: "siteForm", clientId: selectedClient.id, editing: viewedSite })}
            onDelete={() => {
              if (viewedSite && confirm(t("sites.deleteSiteConfirm", { name: viewedSite.name })))
                deleteSiteMut.mutate({ clientId: selectedClient.id, siteId: viewedSite.id });
            }}
          />
        )}

        {panelMode.type === "clientForm" && (
          <ClientFormPanel
            editing={panelMode.editing}
            isMobile={isMobile}
            submitting={createClientMut.isPending || updateClientMut.isPending}
            onCancel={() => setPanelMode(panelMode.editing
              ? { type: "detail", clientId: panelMode.editing.id }
              : { type: "empty" })}
            onSubmit={(draft) => {
              if (panelMode.editing)
                updateClientMut.mutate({ id: panelMode.editing.id, body: draft });
              else
                createClientMut.mutate(draft);
            }}
          />
        )}

        {panelMode.type === "siteForm" && (
          <SiteFormPanel
            clientId={panelMode.clientId}
            editing={panelMode.editing}
            isMobile={isMobile}
            submitting={createSiteMut.isPending || updateSiteMut.isPending}
            onCancel={() => {
              if (panelMode.editing)
                setPanelMode({ type: "siteDetail", clientId: panelMode.clientId, siteId: panelMode.editing.id });
              else
                setPanelMode({ type: "detail", clientId: panelMode.clientId });
            }}
            onSubmit={(draft) => {
              if (panelMode.editing)
                updateSiteMut.mutate({ clientId: panelMode.clientId, siteId: panelMode.editing.id, body: draft });
              else
                createSiteMut.mutate({ clientId: panelMode.clientId, body: draft });
            }}
          />
        )}
      </div>
    </div>
  );
}

function MobileBack({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="clients-mobile-back" onClick={onClick} aria-label={label}>
      <span className="material-symbols-outlined">arrow_back</span>
      <span>{label}</span>
    </button>
  );
}

function ClientDetailView({
  client, sites, sitesLoading, isMobile,
  onBack, onEdit, onDelete, onToggleState, togglingState,
  onAddSite, onViewSite, onEditSite, onDeleteSite
}: {
  client: ClientSummary;
  sites: Site[] | undefined;
  sitesLoading: boolean;
  isMobile: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleState: () => void;
  togglingState: boolean;
  onAddSite: () => void;
  onViewSite: (siteId: UUID) => void;
  onEditSite: (site: Site) => void;
  onDeleteSite: (site: Site) => void;
}) {
  const { t } = useTranslation();
  const isActive = client.state === "ACTIVE";
  return (
    <>
      <div className="client-detail-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="client-detail-title-row">
            {isMobile && <MobileBack onClick={onBack} label={t("clients.backToList")} />}
            <h2 className="client-detail-name">{client.name}</h2>
            <span className={`client-state-badge ${isActive ? "client-state-badge--active" : "client-state-badge--inactive"}`}>
              {t(`clientState.${client.state}`)}
            </span>
          </div>
          <div className="client-id-label">
            {t("clients.columnEmail")}: <span className="mono">{client.email}</span>
            {client.phone && <span style={{ marginLeft: 12 }}>{client.phone}</span>}
          </div>
        </div>
        <div className="client-detail-actions">
          <button onClick={onEdit}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            {t("common.edit")}
          </button>
          <button onClick={onToggleState} disabled={togglingState}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {isActive ? "toggle_off" : "toggle_on"}
            </span>
            {isActive ? t("clients.deactivate") : t("clients.reactivate")}
          </button>
          <button className="danger" onClick={onDelete}>
            {t("common.delete")}
          </button>
        </div>
      </div>
      <div className="client-detail-body">
        <div className="sites-section-header">
          <h3>{t("sites.activeSites")}</h3>
          <button onClick={onAddSite}>+ {t("sites.addSite")}</button>
        </div>
        {sitesLoading && <p className="muted">{t("common.loading")}</p>}
        {sites && sites.length === 0 && <p className="muted">{t("sites.noSites")}</p>}
        {sites && sites.length > 0 && (
          <div className="sites-grid">
            {sites.map((site) => (
              <div key={site.id} className="site-card" style={{ cursor: "pointer" }} onClick={() => onViewSite(site.id)}>
                <div className="site-card-header">
                  <span className="site-card-name">{site.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <span className={`status-dot ${siteDot(site)}`} />
                    <div className="site-card-actions">
                      <button onClick={() => onEditSite(site)} title={t("common.edit")}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                      </button>
                      <button className="danger" onClick={() => onDeleteSite(site)} title={t("common.delete")}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="site-meta-grid">
                  <div>
                    <div className="site-meta-label">{t("sites.equipment")}</div>
                    <div className="site-meta-value">{site.equipmentCount}</div>
                  </div>
                  <div>
                    <div className="site-meta-label">{t("sites.personnel")}</div>
                    <div className="site-meta-value">{site.personnelCount}</div>
                  </div>
                </div>
                {site.locationLabel && (
                  <div className="site-location-label">{site.locationLabel}</div>
                )}
                {site.lat != null && site.lng != null && !site.locationLabel && (
                  <div className="site-location-label mono">
                    {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SiteDetailView({
  client, site, loading, isMobile,
  onBackToList, onBackToClient, onEdit, onDelete
}: {
  client: ClientSummary;
  site: Site | null;
  loading: boolean;
  isMobile: boolean;
  onBackToList: () => void;
  onBackToClient: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="client-detail-body">
        <p className="muted">{t("common.loading")}</p>
      </div>
    );
  }
  if (!site) {
    return (
      <div className="client-detail-body">
        <button className="site-detail-back" onClick={onBackToClient}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          {client.name}
        </button>
        <p className="muted">{t("sites.noSites")}</p>
      </div>
    );
  }

  const hasCoords = site.lat != null && site.lng != null;
  return (
    <>
      <div className="client-detail-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {isMobile && <MobileBack onClick={onBackToList} label={t("clients.backToList")} />}
          <button className="site-detail-back" onClick={onBackToClient}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            {client.name}
          </button>
          <h2 className="client-detail-name">{site.name}</h2>
          {site.locationLabel && (
            <div className="client-id-label">{site.locationLabel}</div>
          )}
        </div>
        <div className="client-detail-actions">
          <button onClick={onEdit}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
            {t("common.edit")}
          </button>
          <button className="danger" onClick={onDelete}>{t("common.delete")}</button>
        </div>
      </div>
      <div className="client-detail-body">
        <div className="site-meta-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 16 }}>
          <div>
            <div className="site-meta-label">{t("sites.equipment")}</div>
            <div className="site-meta-value">{site.equipmentCount}</div>
          </div>
          <div>
            <div className="site-meta-label">{t("sites.personnel")}</div>
            <div className="site-meta-value">{site.personnelCount}</div>
          </div>
          <div>
            <div className="site-meta-label">{t("sites.openOrders")}</div>
            <div className="site-meta-value">{site.openOrderCount}</div>
          </div>
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: "var(--text-base)" }}>{t("sites.mapPreview")}</h3>
        {hasCoords ? (
          <div className="site-map-wrap">
            <SiteMap lat={site.lat!} lng={site.lng!} label={site.locationLabel ?? site.name} />
          </div>
        ) : (
          <div className="site-map-empty">{t("sites.noLocation")}</div>
        )}
      </div>
    </>
  );
}

function ClientFormPanel({
  editing, isMobile, submitting, onCancel, onSubmit
}: {
  editing: ClientSummary | null;
  isMobile: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: ClientUpsert) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ClientUpsert>(() => editing ? {
    name: editing.name, email: editing.email, phone: editing.phone ?? "",
    vatNumber: editing.vatNumber ?? "", addressLine1: editing.addressLine1 ?? "",
    addressLine2: editing.addressLine2 ?? "", city: editing.city ?? "",
    postalCode: editing.postalCode ?? "", country: editing.country ?? ""
  } : EMPTY_CLIENT);

  const set = <K extends keyof ClientUpsert>(k: K, v: ClientUpsert[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit(draft);
  }

  return (
    <>
      <div className="form-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {isMobile && <MobileBack onClick={onCancel} label={t("common.cancel")} />}
          <h2>{editing ? t("clients.editClient", { name: editing.name }) : t("clients.newClient")}</h2>
        </div>
        {!isMobile && <button className="ghost" onClick={onCancel}>{t("common.cancel")}</button>}
      </div>
      <div className="form-panel-body form-panel">
        <form onSubmit={submit}>
          <label>{t("clients.fieldName")} *<input required value={draft.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label>{t("clients.fieldEmail")} *<input required type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label>{t("clients.fieldPhone")}<input value={draft.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></label>
          <label>{t("clients.fieldVat")}<input value={draft.vatNumber ?? ""} onChange={(e) => set("vatNumber", e.target.value)} /></label>
          <label>{t("clients.fieldAddress1")}<input value={draft.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} /></label>
          <label>{t("clients.fieldAddress2")}<input value={draft.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} /></label>
          <div className="form-row">
            <label>{t("clients.fieldCity")}<input value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} /></label>
            <label>{t("clients.fieldPostal")}<input value={draft.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} /></label>
          </div>
          <label>{t("clients.fieldCountry")}<input value={draft.country ?? ""} onChange={(e) => set("country", e.target.value)} /></label>
          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {editing ? t("common.save") : t("common.create")}
            </button>
            <button type="button" className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </form>
      </div>
    </>
  );
}

function SiteFormPanel({
  clientId: _clientId, editing, isMobile, submitting, onCancel, onSubmit
}: {
  clientId: UUID;
  editing: Site | null;
  isMobile: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: SiteUpsert) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [lat, setLat] = useState<string>(editing?.lat != null ? String(editing.lat) : "");
  const [lng, setLng] = useState<string>(editing?.lng != null ? String(editing.lng) : "");
  const [locationLabel, setLocationLabel] = useState<string>(editing?.locationLabel ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      lat: lat ? Number(lat) : null,
      lng: lng ? Number(lng) : null,
      locationLabel: locationLabel || null
    });
  }

  const numLat = lat ? Number(lat) : NaN;
  const numLng = lng ? Number(lng) : NaN;
  const hasCoords = Number.isFinite(numLat) && Number.isFinite(numLng);

  return (
    <>
      <div className="form-panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {isMobile && <MobileBack onClick={onCancel} label={t("common.cancel")} />}
          <h2>{editing ? t("sites.editSite") : t("sites.addSite")}</h2>
        </div>
        {!isMobile && <button className="ghost" onClick={onCancel}>{t("common.cancel")}</button>}
      </div>
      <div className="form-panel-body form-panel">
        <form onSubmit={submit}>
          <label>{t("sites.fieldName")} *
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label>{t("sites.fieldAddressLookup")}
            <AddressLookup
              onPick={(h) => {
                setLat(String(h.lat));
                setLng(String(h.lng));
                setLocationLabel(h.displayName);
              }}
              placeholder={t("sites.addressPlaceholder")}
            />
          </label>

          <label>{t("sites.fieldLocationLabel")}
            <input
              value={locationLabel}
              placeholder="e.g. Via Roma 1, Milan, IT"
              onChange={(e) => setLocationLabel(e.target.value)}
            />
          </label>
          <div className="form-row">
            <label>{t("sites.fieldLat")}
              <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} />
            </label>
            <label>{t("sites.fieldLng")}
              <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} />
            </label>
          </div>

          {hasCoords && (
            <div>
              <div className="site-meta-label" style={{ marginBottom: 4 }}>{t("sites.mapPreview")}</div>
              <div className="site-map-wrap">
                <SiteMap lat={numLat} lng={numLng} label={locationLabel || name} height={200} />
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {editing ? t("common.save") : t("common.create")}
            </button>
            <button type="button" className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
          </div>
        </form>
      </div>
    </>
  );
}
