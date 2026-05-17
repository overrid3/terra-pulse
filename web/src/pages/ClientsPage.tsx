import {FormEvent, useMemo, useState} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {clientsApi} from "@/api/clients";
import {sitesApi} from "@/api/sites";
import {queryKeys} from "@/api/client";
import {
  ClientState, ClientSummary, ClientUpsert,
  Site, SiteUpsert, UUID
} from "@/types";
import {useToast} from "@/components/Toast";
import {AddressLookup} from "@/components/AddressLookup";
import {SiteMap} from "@/components/SiteMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {useIsMobile, useResizableSplit} from "@/hooks/useResizableSplit";
import {ResizableSplitHandle} from "@/components/ResizableSplitHandle";

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

export function ClientsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const isMobile = useIsMobile();
  const {panelRef: listPanelRef, initialWidth: listInitialWidth, startDrag} = useResizableSplit({
    storageKey: "tp.clients.listWidth",
    defaultWidth: 400,
    minWidth: 400,
    maxWidth: 560,
  });

  const clientsQ = useQuery({ queryKey: queryKeys.clients, queryFn: clientsApi.list });

  const [panelMode, setPanelMode] = useState<PanelMode>({ type: "empty" });
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const detailClientId =
      panelMode.type === "detail" || panelMode.type === "siteForm" || panelMode.type === "siteDetail"
          ? panelMode.clientId
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
  const mobileDetail = isMobile && isDetailView;

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
    <div
      className={cn(
        "flex-1 flex min-h-0 p-2 md:p-3.5 gap-0 relative",
        "flex-col md:flex-row"
      )}
    >
      {/* Left: client list */}
      <div
        className={cn(
          "flex flex-col gap-2 bg-(--color-surface-panel) border border-(--color-hairline) rounded-md p-3.5 overflow-hidden",
          "md:min-w-60 md:max-w-140 md:shrink-0",
          "w-full",
          mobileDetail && "hidden md:flex"
        )}
        ref={listPanelRef}
        style={{ width: isMobile ? undefined : listInitialWidth }}
      >
        <div className="flex justify-between items-center gap-2">
          <h2 className="m-0">{t("clients.pageTitle", { count: clientsQ.data?.length ?? 0 })}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelMode({ type: "clientForm", editing: null })}
          >
            <Plus className="w-4 h-4" />
            {t("clients.addClient")}
          </Button>
        </div>
        <Input
          type="text"
          placeholder={t("common.find") + "…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-(--color-surface-sunken)"
        />
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(v) => v && setFilter(v as typeof filter)}
          variant="outline"
          size="sm"
          className="self-start"
        >
          <ToggleGroupItem value="ALL">{t("clients.filterAll")}</ToggleGroupItem>
          <ToggleGroupItem value="ACTIVE">{t("clients.filterActive")}</ToggleGroupItem>
          <ToggleGroupItem value="INACTIVE">{t("clients.filterInactive")}</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1">
          {clients.map((c) => {
            const isSelected = selectedClientId === c.id;
            const isInactive = c.state === "INACTIVE";
            return (
              <div
                key={c.id}
                className={cn(
                  "cursor-pointer p-2.5 border rounded-[var(--radius-sm)] transition-colors",
                  "border-[var(--color-hairline)] bg-[var(--color-surface-panel)] hover:bg-[var(--color-surface-container)]",
                  isSelected && "bg-[var(--color-surface-container-high)] border-[var(--color-brand)]",
                  isInactive && "opacity-60"
                )}
                onClick={() => setPanelMode({ type: "detail", clientId: c.id })}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-semibold text-(--text-base)">{c.name}</span>
                  <span className={`status-dot ${clientDot(c)}`} />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
                      {t("sites.activeSites")}
                    </div>
                    <div className="font-mono text-(--text-sm) font-medium">
                      {c.siteCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
                      {t("sites.openOrders")}
                    </div>
                    <div className="font-mono font-medium text-(--color-text)">
                      {c.openOrderCount}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {clients.length === 0 && (
            <p className="text-(--color-text-muted) py-2">
              {clientsQ.data?.length === 0 ? t("clients.noClients") : t("errors.noMatches")}
            </p>
          )}
        </div>
      </div>

      {/* Drag handle (desktop only) */}
      {!isMobile && <ResizableSplitHandle onStart={startDrag}/>}

      {/* Right: detail / form panel */}
      <div
        className={cn(
          "flex-1 min-w-0 flex flex-col bg-(--color-surface-panel) border border-(--color-hairline) rounded-md overflow-hidden",
          !mobileDetail && isMobile && "hidden md:flex"
        )}
      >
        {panelMode.type === "empty" && (
          <div className="flex-1 flex flex-col items-center justify-center text-(--color-text-muted) gap-2">
            <Users className="w-12 h-12 opacity-40" />
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

function MobileBack({ onClick, label }: Readonly<{ onClick: () => void; label: string }>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      onClick={onClick}
      aria-label={label}
      className="md:hidden inline-flex items-center gap-1 text-(--color-text-muted)"
    >
      <ArrowLeft className="w-5 h-5" />
      <span>{label}</span>
    </Button>
  );
}

function ClientDetailView({
  client, sites, sitesLoading, isMobile,
  onBack, onEdit, onDelete, onToggleState, togglingState,
  onAddSite, onViewSite, onEditSite, onDeleteSite
}: Readonly<{
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
}>) {
  const { t } = useTranslation();
  const isActive = client.state === "ACTIVE";
  return (
    <>
      <div className="p-3.5 px-4 bg-(--color-surface-sunken) border-b border-(--color-hairline) flex justify-between items-start shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isMobile && <MobileBack onClick={onBack} label={t("clients.backToList")} />}
            <h2 className="text-(--text-lg) font-semibold m-0">{client.name}</h2>
            {isActive ? (
              <Badge
                variant="outline"
                className="border-(--color-brand) text-(--color-brand) bg-brand-soft"
              >
                {t(`clientState.${client.state}`)}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-(--color-hairline-strong) text-(--color-text-muted) bg-(--color-surface-sunken)"
              >
                {t(`clientState.${client.state}`)}
              </Badge>
            )}
          </div>
          <div className="text-(--text-sm)">
            {t("clients.columnEmail")}: <span className="font-mono">{client.email}</span>
            {client.phone && <span className="ml-3">{client.phone}</span>}
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
            {t("common.edit")}
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleState} disabled={togglingState}>
            {isActive ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
            {isActive ? t("clients.deactivate") : t("clients.reactivate")}
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            {t("common.delete")}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-between items-center border-b border-(--color-hairline) pb-1.5 mb-3">
          <h3 className="m-0 text-(--text-base) font-semibold">{t("sites.activeSites")}</h3>
          <Button variant="outline" size="sm" onClick={onAddSite}>
            <Plus className="w-4 h-4" />
            {t("sites.addSite")}
          </Button>
        </div>
        {sitesLoading && (
          <p className="text-(--color-text-muted)">{t("common.loading")}</p>
        )}
        {sites?.length === 0 && (
          <p className="text-(--color-text-muted)">{t("sites.noSites")}</p>
        )}
        {sites && sites.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {sites.map((site) => (
              <div
                key={site.id}
                className="border border-(--color-hairline) rounded-(--radius-sm) p-3 bg-(--color-surface-panel) cursor-pointer"
                onClick={() => onViewSite(site.id)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-(--text-base)">{site.name}</span>
                  <div
                    className="flex items-center gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className={`status-dot ${siteDot(site)}`} />
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditSite(site)}
                        title={t("common.edit")}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDeleteSite(site)}
                        title={t("common.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 mb-1.5">
                  <div>
                    <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
                      {t("sites.equipment")}
                    </div>
                    <div className="font-mono text-(--text-sm)">
                      {site.equipmentCount}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
                      {t("sites.personnel")}
                    </div>
                    <div className="font-mono text-(--text-sm)">
                      {site.personnelCount}
                    </div>
                  </div>
                </div>
                {site.locationLabel && (
                  <div className="text-(--text-xs) mt-1">
                    {site.locationLabel}
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
}: Readonly<{
  client: ClientSummary;
  site: Site | null;
  loading: boolean;
  isMobile: boolean;
  onBackToList: () => void;
  onBackToClient: () => void;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-(--text-sm)">{t("common.loading")}</p>
      </div>
    );
  }
  if (!site) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <Button variant="ghost" size="sm" onClick={onBackToClient}>
          <ArrowLeft className="w-4 h-4" />
          {client.name}
        </Button>
        <p className="text-(--text-sm)">{t("sites.noSites")}</p>
      </div>
    );
  }

  const hasCoords = site.lat != null && site.lng != null;
  return (
    <>
      <div className="p-3.5 px-4 bg-(--color-surface-sunken) border-b border-(--color-hairline) flex justify-between items-start shrink-0">
        <div className="flex-1 min-w-0">
          {isMobile && <MobileBack onClick={onBackToList} label={t("clients.backToList")} />}
          <Button variant="ghost" size="sm" onClick={onBackToClient} className="mb-1">
            <ArrowLeft className="w-4 h-4" />
            {client.name}
          </Button>
          <h2 className="text-(--text-lg) font-semibold m-0">{site.name}</h2>
          {site.locationLabel && (
            <div className="text-(--color-text-muted)">{site.locationLabel}</div>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4" />
            {t("common.edit")}
          </Button>
          <Button variant="destructive" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4" />
            {t("common.delete")}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-3 gap-1 mb-4">
          <div>
            <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
              {t("sites.equipment")}
            </div>
            <div className="font-mono text-(--color-text)">
              {site.equipmentCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
              {t("sites.personnel")}
            </div>
            <div className="font-mono text-(--color-text)">
              {site.personnelCount}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em]">
              {t("sites.openOrders")}
            </div>
            <div className="font-mono text-(--color-text)">
              {site.openOrderCount}
            </div>
          </div>
        </div>

        <h3 className="m-0 mb-2 text-(--text-base) font-semibold">{t("sites.mapPreview")}</h3>
        {hasCoords ? (
          <div className="mt-3 border border-(--color-hairline) rounded-(--radius-sm) overflow-hidden">
            <SiteMap lat={site.lat!} lng={site.lng!} label={site.locationLabel ?? site.name} />
          </div>
        ) : (
          <div className="mt-3 p-6 bg-(--color-surface-sunken) border border-dashed border-(--color-hairline) rounded-(--radius-sm) text-center text-(--color-text-muted)">
            {t("sites.noLocation")}
          </div>
        )}
      </div>
    </>
  );
}

function ClientFormPanel({
  editing, isMobile, submitting, onCancel, onSubmit
}: Readonly<{
  editing: ClientSummary | null;
  isMobile: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: ClientUpsert) => void;
}>) {
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
      <div className="p-3.5 px-4 bg-(--color-surface-sunken) border-b border-(--color-hairline) flex justify-between items-center shrink-0">
        <div className="flex items-center gap-1">
          {isMobile && <MobileBack onClick={onCancel} label={t("common.cancel")} />}
          <h2 className="m-0 text-(--text-lg) font-semibold">
            {editing ? t("clients.editClient", { name: editing.name }) : t("clients.newClient")}
          </h2>
        </div>
        {!isMobile && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-name">{t("clients.fieldName")} *</Label>
            <Input
              id="client-name"
              required
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-email">{t("clients.fieldEmail")} *</Label>
            <Input
              id="client-email"
              required
              type="email"
              value={draft.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-phone">{t("clients.fieldPhone")}</Label>
            <Input
              id="client-phone"
              value={draft.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-vat">{t("clients.fieldVat")}</Label>
            <Input
              id="client-vat"
              value={draft.vatNumber ?? ""}
              onChange={(e) => set("vatNumber", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-addr1">{t("clients.fieldAddress1")}</Label>
            <Input
              id="client-addr1"
              value={draft.addressLine1 ?? ""}
              onChange={(e) => set("addressLine1", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-addr2">{t("clients.fieldAddress2")}</Label>
            <Input
              id="client-addr2"
              value={draft.addressLine2 ?? ""}
              onChange={(e) => set("addressLine2", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1">
              <Label htmlFor="client-city">{t("clients.fieldCity")}</Label>
              <Input
                id="client-city"
                value={draft.city ?? ""}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="client-postal">{t("clients.fieldPostal")}</Label>
              <Input
                id="client-postal"
                value={draft.postalCode ?? ""}
                onChange={(e) => set("postalCode", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="client-country">{t("clients.fieldCountry")}</Label>
            <Input
              id="client-country"
              value={draft.country ?? ""}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>
          <div className="flex gap-2 mt-1.5">
            <Button type="submit" variant="default" disabled={submitting}>
              {editing ? t("common.save") : t("common.create")}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function SiteFormPanel({
  clientId: _clientId, editing, isMobile, submitting, onCancel, onSubmit
}: Readonly<{
  clientId: UUID;
  editing: Site | null;
  isMobile: boolean;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (body: SiteUpsert) => void;
}>) {
  const { t } = useTranslation();
  const [name, setName] = useState(editing?.name ?? "");
  const [lat, setLat] = useState<number | null>(editing?.lat ?? null);
  const [lng, setLng] = useState<number | null>(editing?.lng ?? null);
  const [locationLabel, setLocationLabel] = useState<string | null>(editing?.locationLabel ?? null);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ name, lat, lng, locationLabel });
  }

  const hasCoords = lat != null && lng != null;

  return (
    <>
      <div className="p-3.5 px-4 bg-(--color-surface-sunken) border-b border-(--color-hairline) flex justify-between items-center shrink-0">
        <div className="flex items-center gap-1">
          {isMobile && <MobileBack onClick={onCancel} label={t("common.cancel")} />}
          <h2 className="m-0 text-(--text-lg) font-semibold">
            {editing ? t("sites.editSite") : t("sites.addSite")}
          </h2>
        </div>
        {!isMobile && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={submit} className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="site-name">{t("sites.fieldName")} *</Label>
            <Input
              id="site-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label>{t("sites.fieldAddressLookup")}</Label>
            <AddressLookup
              onPick={(h) => {
                setLat(h.lat);
                setLng(h.lng);
                setLocationLabel(h.displayName);
              }}
              onChange={(text) => {
                setLocationLabel(text || null);
                if (!text) { setLat(null); setLng(null); }
              }}
              placeholder={t("sites.addressPlaceholder")}
            />
          </div>

          {hasCoords && (
            <div>
              {locationLabel && (
                <div className="text-(--text-xs) mb-1.5">
                  {locationLabel}
                </div>
              )}
              <div className="text-[10px] font-medium text-(--color-text-subtle) uppercase tracking-[0.04em] mb-1">
                {t("sites.mapPreview")}
              </div>
              <div className="mt-1 border border-(--color-hairline) rounded-(--radius-sm) overflow-hidden">
                <SiteMap lat={lat} lng={lng} label={locationLabel || name} height={200} />
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-1.5">
            <Button type="submit" variant="default" disabled={submitting}>
              {editing ? t("common.save") : t("common.create")}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
