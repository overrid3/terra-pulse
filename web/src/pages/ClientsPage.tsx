import { FormEvent, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { clientsApi } from "../api/clients";
import { sitesApi } from "../api/sites";
import { queryKeys } from "../api/client";
import { Client, ClientSummary, ClientUpsert, Site, SiteUpsert, UUID } from "../types";

type PanelMode =
  | { type: "empty" }
  | { type: "detail"; clientId: UUID }
  | { type: "clientForm"; editing: ClientSummary | null }
  | { type: "siteForm"; clientId: UUID; editing: Site | null };

const EMPTY_CLIENT: ClientUpsert = {
  name: "", email: "", phone: "", vatNumber: "",
  addressLine1: "", addressLine2: "", city: "", postalCode: "", country: ""
};

const EMPTY_SITE: SiteUpsert = { name: "", lat: null, lng: null, locationLabel: null };

function clientDot(c: ClientSummary): string {
  if (c.openOrderCount > 0) return "dot-has-orders";
  if (c.siteCount > 0)      return "dot-has-sites";
  return "dot-inactive";
}

function siteDot(s: Site): string {
  if (s.openOrderCount > 0) return "dot-has-orders";
  if (s.equipmentCount > 0) return "dot-has-sites";
  return "dot-inactive";
}

export function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const clientsQ = useQuery({ queryKey: queryKeys.clients, queryFn: clientsApi.list });

  const [panelMode, setPanelMode] = useState<PanelMode>({ type: "empty" });
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const detailClientId = panelMode.type === "detail" ? panelMode.clientId
    : panelMode.type === "siteForm" ? panelMode.clientId : null;

  const sitesQ = useQuery({
    queryKey: queryKeys.sites(detailClientId ?? ""),
    queryFn: () => sitesApi.list(detailClientId!),
    enabled: !!detailClientId
  });

  const clients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clientsQ.data ?? []).filter(c =>
      !q || c.name.toLowerCase().includes(q)
    );
  }, [clientsQ.data, search]);

  const selectedClientId = panelMode.type === "detail" || panelMode.type === "siteForm"
    ? (panelMode as any).clientId : null;
  const selectedClient = clients.find(c => c.id === selectedClientId) ?? null;

  function invalidateClients() { qc.invalidateQueries({ queryKey: queryKeys.clients }); }
  function invalidateSites(clientId: UUID) { qc.invalidateQueries({ queryKey: queryKeys.sites(clientId) }); }

  // Client mutations
  const createClientMut = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (created) => { invalidateClients(); setPanelMode({ type: "detail", clientId: created.id }); setError(null); },
    onError: (e: Error) => setError(e.message)
  });
  const updateClientMut = useMutation({
    mutationFn: ({ id, body }: { id: UUID; body: ClientUpsert }) => clientsApi.update(id, body),
    onSuccess: (updated) => { invalidateClients(); setPanelMode({ type: "detail", clientId: updated.id }); setError(null); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteClientMut = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => { invalidateClients(); setPanelMode({ type: "empty" }); },
    onError: (e: Error) => setError(e.message)
  });

  // Site mutations
  const createSiteMut = useMutation({
    mutationFn: ({ clientId, body }: { clientId: UUID; body: SiteUpsert }) => sitesApi.create(clientId, body),
    onSuccess: (_, vars) => { invalidateSites(vars.clientId); invalidateClients(); setPanelMode({ type: "detail", clientId: vars.clientId }); setError(null); },
    onError: (e: Error) => setError(e.message)
  });
  const updateSiteMut = useMutation({
    mutationFn: ({ clientId, siteId, body }: { clientId: UUID; siteId: UUID; body: SiteUpsert }) =>
      sitesApi.update(clientId, siteId, body),
    onSuccess: (_, vars) => { invalidateSites(vars.clientId); invalidateClients(); setPanelMode({ type: "detail", clientId: vars.clientId }); setError(null); },
    onError: (e: Error) => setError(e.message)
  });
  const deleteSiteMut = useMutation({
    mutationFn: ({ clientId, siteId }: { clientId: UUID; siteId: UUID }) => sitesApi.delete(clientId, siteId),
    onSuccess: (_, vars) => { invalidateSites(vars.clientId); invalidateClients(); },
    onError: (e: Error) => setError(e.message)
  });

  return (
    <div className="clients-layout">
      {/* Left: Client list */}
      <div className="client-list-panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>{t("clients.pageTitle", { count: clientsQ.data?.length ?? 0 })}</h2>
          <button
            className="ghost"
            onClick={() => { setError(null); setPanelMode({ type: "clientForm", editing: null }); }}
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
        <div className="client-list-scroll">
          {clients.map((c) => (
            <div
              key={c.id}
              className={`client-card ${selectedClientId === c.id ? "selected" : ""}`}
              onClick={() => { setError(null); setPanelMode({ type: "detail", clientId: c.id }); }}
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

      {/* Right: Detail / Form panel */}
      <div className="client-detail-panel">
        {panelMode.type === "empty" && (
          <div className="detail-empty-state">
            <span className="material-symbols-outlined">group</span>
            <span>{t("clients.selectClient")}</span>
          </div>
        )}

        {panelMode.type === "detail" && selectedClient && (
          <>
            <div className="client-detail-header">
              <div>
                <div className="client-detail-title-row">
                  <h2 className="client-detail-name">{selectedClient.name}</h2>
                  <span className="client-active-badge">{t("clients.active")}</span>
                </div>
                <div className="client-id-label">
                  {t("clients.columnEmail")}: <span className="mono">{selectedClient.email}</span>
                  {selectedClient.phone && <span style={{ marginLeft: 12 }}>{selectedClient.phone}</span>}
                </div>
              </div>
              <div className="client-detail-actions">
                <button
                  title={t("common.edit")}
                  onClick={() => { setError(null); setPanelMode({ type: "clientForm", editing: selectedClient }); }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  {t("common.edit")}
                </button>
                <button
                  className="danger"
                  title={t("common.delete")}
                  onClick={() => {
                    if (confirm(t("common.deleteConfirm", { label: selectedClient.name })))
                      deleteClientMut.mutate(selectedClient.id);
                  }}
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
            <div className="client-detail-body">
              <div className="sites-section-header">
                <h3>{t("sites.activeSites")}</h3>
                <button
                  onClick={() => { setError(null); setPanelMode({ type: "siteForm", clientId: selectedClient.id, editing: null }); }}
                >
                  + {t("sites.addSite")}
                </button>
              </div>
              {sitesQ.isLoading && <p className="muted">{t("common.loading")}</p>}
              {error && <p className="error">{error}</p>}
              {sitesQ.data && sitesQ.data.length === 0 && (
                <p className="muted">{t("sites.noSites")}</p>
              )}
              {sitesQ.data && sitesQ.data.length > 0 && (
                <div className="sites-grid">
                  {sitesQ.data.map((site) => (
                    <div key={site.id} className="site-card">
                      <div className="site-card-header">
                        <span className="site-card-name">{site.name}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className={`status-dot ${siteDot(site)}`} />
                          <div className="site-card-actions">
                            <button
                              onClick={() => { setError(null); setPanelMode({ type: "siteForm", clientId: selectedClient.id, editing: site }); }}
                              title={t("common.edit")}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (confirm(t("sites.deleteSiteConfirm", { name: site.name })))
                                  deleteSiteMut.mutate({ clientId: selectedClient.id, siteId: site.id });
                              }}
                              title={t("common.delete")}
                            >
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
                      {(site.lat != null && site.lng != null) && !site.locationLabel && (
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
        )}

        {panelMode.type === "clientForm" && (
          <ClientFormPanel
            editing={panelMode.editing}
            error={error}
            submitting={createClientMut.isPending || updateClientMut.isPending}
            onCancel={() => {
              setError(null);
              setPanelMode(panelMode.editing
                ? { type: "detail", clientId: panelMode.editing.id }
                : { type: "empty" });
            }}
            onSubmit={(draft) => {
              setError(null);
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
            error={error}
            submitting={createSiteMut.isPending || updateSiteMut.isPending}
            onCancel={() => { setError(null); setPanelMode({ type: "detail", clientId: panelMode.clientId }); }}
            onSubmit={(draft) => {
              setError(null);
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

function ClientFormPanel({
  editing, error, submitting, onCancel, onSubmit
}: {
  editing: ClientSummary | null;
  error: string | null;
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
        <h2>{editing ? t("clients.editClient", { name: editing.name }) : t("clients.newClient")}</h2>
        <button className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
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
          {error && <p className="error">{error}</p>}
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
  clientId, editing, error, submitting, onCancel, onSubmit
}: {
  clientId: UUID;
  editing: Site | null;
  error: string | null;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: SiteUpsert) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<SiteUpsert>(() => editing ? {
    name: editing.name,
    lat: editing.lat,
    lng: editing.lng,
    locationLabel: editing.locationLabel
  } : EMPTY_SITE);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      ...draft,
      lat: draft.lat != null && draft.lat !== "" as any ? Number(draft.lat) : null,
      lng: draft.lng != null && draft.lng !== "" as any ? Number(draft.lng) : null,
    });
  }

  return (
    <>
      <div className="form-panel-header">
        <h2>{editing ? t("sites.editSite") : t("sites.addSite")}</h2>
        <button className="ghost" onClick={onCancel}>{t("common.cancel")}</button>
      </div>
      <div className="form-panel-body form-panel">
        <form onSubmit={submit}>
          <label>{t("sites.fieldName")} *
            <input required value={draft.name} onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))} />
          </label>
          <label>{t("sites.fieldLocationLabel")}
            <input
              value={draft.locationLabel ?? ""}
              placeholder="e.g. Via Roma 1, Milan, IT"
              onChange={(e) => setDraft(d => ({ ...d, locationLabel: e.target.value || null }))}
            />
          </label>
          <div className="form-row">
            <label>{t("sites.fieldLat")}
              <input type="number" step="any" value={draft.lat ?? ""} onChange={(e) => setDraft(d => ({ ...d, lat: e.target.value ? Number(e.target.value) : null }))} />
            </label>
            <label>{t("sites.fieldLng")}
              <input type="number" step="any" value={draft.lng ?? ""} onChange={(e) => setDraft(d => ({ ...d, lng: e.target.value ? Number(e.target.value) : null }))} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
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
