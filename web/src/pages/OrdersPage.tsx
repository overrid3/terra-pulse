import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { X, Plus } from "lucide-react";
import { serviceOrdersApi, CreateOrderBody, ServiceOrderPatchBody } from "../api/serviceOrders";
import { queryKeys } from "../api/client";
import { ServiceOrder, ServiceOrderState } from "../types";
import { SearchInput } from "../components/SearchInput";
import { OrderDetailsCard } from "../components/OrderDetailsCard";
import { OrderSaveBody } from "../components/OrderEditForm";
import { CreateOrderForm } from "../components/CreateOrderForm";
import { fmtDateTime } from "../i18n/format";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useIsMobile, useResizableSplit } from "@/hooks/useResizableSplit";
import { ResizableSplitHandle } from "@/components/ResizableSplitHandle";

const CLOSED = new Set<ServiceOrderState>(["COMPLETED", "CANCELLED"]);

type StatusFilter = "OPEN" | "ALL" | "REQUESTED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

const STATUS_FILTERS: StatusFilter[] = ["OPEN", "ALL", "REQUESTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED"];

function matchStatusFilter(state: ServiceOrderState, f: StatusFilter): boolean {
  switch (f) {
    case "ALL":         return true;
    case "OPEN":        return !CLOSED.has(state);
    case "REQUESTED":   return state === "REQUESTED" || state === "QUOTED" || state === "APPROVED";
    case "SCHEDULED":   return state === "SCHEDULED";
    case "IN_PROGRESS": return state === "IN_PROGRESS";
    case "COMPLETED":   return state === "COMPLETED" || state === "CANCELLED";
  }
}

export function OrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ordersQ   = useQuery({ queryKey: queryKeys.serviceOrders, queryFn: serviceOrdersApi.list });
  const isMobile = useIsMobile();
  const { panelRef: listPanelRef, initialWidth: listInitialWidth, startDrag } = useResizableSplit({
    storageKey: "tp.orders.listWidth",
    defaultWidth: 760,
    minWidth: 480,
    maxWidth: 1100,
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ServiceOrder | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = ordersQ.data ?? [];
    return all
      .filter((o) => matchStatusFilter(o.state, statusFilter))
      .filter((o) => {
        if (!q) return true;
        return (
          (o.title ?? "").toLowerCase().includes(q) ||
          o.vmrsCode.toLowerCase().includes(q) ||
          (o.clientName ?? "").toLowerCase().includes(q) ||
          (o.vmrsDescription ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.requestedAt ?? "").localeCompare(a.requestedAt ?? ""));
  }, [ordersQ.data, statusFilter, search]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.serviceOrders });
    qc.invalidateQueries({ queryKey: queryKeys.mechanics });
  };

  const createMut = useMutation({
    mutationFn: (body: CreateOrderBody) => serviceOrdersApi.create(body),
    onSuccess: () => { invalidate(); setCreateOpen(false); },
  });
  const overrideMut = useMutation({
    mutationFn: (args: {
      id: string;
      state: ServiceOrderState;
      reason: string;
      mechanicId?: string;
      actualMinutes?: number;
    }) => serviceOrdersApi.override(args.id, {
      state: args.state,
      reason: args.reason,
      mechanicId: args.mechanicId,
      actualMinutes: args.actualMinutes,
    }),
    onSuccess: (updated) => { invalidate(); setSelected(updated); }
  });
  const renameMut = useMutation({
    mutationFn: (args: { id: string; title: string }) => serviceOrdersApi.renameTitle(args.id, args.title),
    onSuccess: (updated) => {
      invalidate();
      setSelected(updated);
    }
  });
  const patchMut = useMutation({
    mutationFn: (args: { id: string; body: ServiceOrderPatchBody }) => serviceOrdersApi.patch(args.id, args.body),
    onSuccess: (updated) => { invalidate(); setSelected(updated); }
  });

  async function handleSave(id: string, body: OrderSaveBody) {
    if (body.patch) await patchMut.mutateAsync({ id, body: body.patch });
    if (body.override) {
      await overrideMut.mutateAsync({
        id,
        state: body.override.state,
        reason: body.override.reason,
        mechanicId: body.override.mechanicId,
        actualMinutes: body.override.actualMinutes,
      });
    }
  }

  return (
    <main className="flex-1 min-h-0 p-3.5 flex flex-row gap-0">
      <section
        ref={listPanelRef}
        style={{ width: !isMobile && selected ? listInitialWidth : undefined }}
        className={cn(
          "bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 flex flex-col gap-3",
          selected ? "md:shrink-0 md:min-w-[480px] md:max-w-[1100px]" : "flex-1"
        )}
      >
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[var(--color-text)] m-0 mb-1">
              {t("orders.pageTitle")}
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] m-0">
              {t("orders.pageSubtitle")}
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="default" type="button" className="shrink-0">
                <Plus className="h-4 w-4 mr-1" />
                {t("orders.newOrder")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{t("orders.newOrder")}</DialogTitle></DialogHeader>
              <CreateOrderForm
                submitting={createMut.isPending}
                onCancel={() => setCreateOpen(false)}
                onSubmit={(body) => createMut.mutate(body)}
              />
            </DialogContent>
          </Dialog>
        </header>

        <div className="flex flex-wrap items-center gap-2 p-2 bg-[var(--color-surface-sunken)] border border-[var(--color-hairline)] rounded-[var(--radius-md)]">
          <ToggleGroup
            type="single"
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v as StatusFilter)}
            variant="outline"
            size="sm"
          >
            {STATUS_FILTERS.map((f) => (
              <ToggleGroupItem key={f} value={f}>
                {t(`orders.filter${f === "IN_PROGRESS" ? "InProgress" : f.charAt(0) + f.slice(1).toLowerCase()}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t("orders.searchPlaceholder")}
            className="ml-auto w-full sm:w-72"
          />

          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {t("common.rows", { count: orders.length })}
          </span>
        </div>

        <div className="border border-[var(--color-hairline)] rounded-[var(--radius-md)] overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[var(--color-surface-sunken)] hover:bg-[var(--color-surface-sunken)]">
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnState")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnTitle")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnVmrs")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnClient")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">{t("orders.columnEstimated")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)] text-right">{t("orders.columnActual")}</TableHead>
                <TableHead className="uppercase tracking-wider text-xs font-semibold text-[var(--color-text-muted)]">{t("orders.columnRequested")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className={cn(
                    "group cursor-pointer",
                    selected?.id === o.id && "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
                  )}
                >
                  <TableCell><Badge className={"state-" + o.state} variant="secondary">{t(`state.${o.state}`)}</Badge></TableCell>
                  <TableCell className="font-medium">{o.title ?? <span className="text-[var(--color-text-muted)] italic">{t("common.dash")}</span>}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs text-[var(--color-text)] bg-[var(--color-surface-container)] px-1.5 py-0.5 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] whitespace-nowrap">
                      {o.vmrsCode}
                    </span>
                  </TableCell>
                  <TableCell>{o.clientName ?? <span className="text-[var(--color-text-muted)] italic">{t("common.dash")}</span>}</TableCell>
                  <TableCell className="font-mono text-sm text-right">{t("common.minutesShort", { count: o.estimatedMinutes })}</TableCell>
                  <TableCell className="font-mono text-sm text-right text-[var(--color-text-muted)]">{o.actualMinutes ?? t("common.dash")}</TableCell>
                  <TableCell className="text-[var(--color-text-muted)] text-xs">{fmtDateTime(o.requestedAt)}</TableCell>
                  <TableCell>
                    <div
                      className={cn(
                        "flex gap-1 whitespace-nowrap justify-end transition-opacity",
                        "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                        selected?.id === o.id && "opacity-100"
                      )}
                    >
                      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setSelected(o); }}>{t("common.inspect")}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-[var(--color-text-muted)] py-6">{t("orders.noOrders")}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {selected && (
        <>
          {!isMobile && <ResizableSplitHandle onStart={startDrag} />}
          <section className="flex-1 min-w-0 bg-[var(--color-surface-panel)] border border-[var(--color-hairline)] rounded-[var(--radius-md)] p-3.5 overflow-auto min-h-0 md:ml-0">
          <OrderDetail
            order={selected}
            onClose={() => setSelected(null)}
            onRename={(title) => renameMut.mutate({ id: selected.id, title })}
            renaming={renameMut.isPending}
            onSave={(body) => handleSave(selected.id, body)}
            saving={patchMut.isPending || overrideMut.isPending}
          />
          </section>
        </>
      )}
    </main>
  );
}

function OrderDetail({
  order, onClose, onRename, renaming, onSave, saving
}: {
  order: ServiceOrder;
  onClose: () => void;
  onRename: (title: string) => void;
  renaming: boolean;
  onSave: (body: OrderSaveBody) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="m-0 text-[var(--text-lg)] font-semibold">{t("orders.orderDetail")}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={t("common.close")}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <OrderDetailsCard
        order={order}
        onRename={onRename}
        renaming={renaming}
        showNotes
        onSave={onSave}
        saving={saving}
      />
    </div>
  );
}

