import type { Mechanic, MechanicAbsence, ServiceOrder, Vehicle } from "../../../types";

export type GanttView = "day" | "week" | "month";

export type GanttRowDragData =
  | { kind: "row"; mechanicId: string };

export type GanttPoolDragData = {
  kind: "pool";
  orderId: string;
  orderState: string;
  estimatedMinutes: number;
};

export type GanttEventDragData = {
  kind: "event";
  orderId: string;
  orderState: string;
  currentMechanicId: string;
  scheduledStartAt?: string | null;
  scheduledEndAt?: string | null;
};

export type GanttResizeDragData = {
  kind: "resize";
  orderId: string;
  edge: "start" | "end";
  scheduledStartAt: string;
  scheduledEndAt: string;
  currentMechanicId: string;
  estimatedMinutes: number;
};

export type GanttDragData =
  | GanttPoolDragData
  | GanttEventDragData
  | GanttResizeDragData;

export type GanttRenderProps = {
  mechanics: Mechanic[];
  orders: ServiceOrder[];
  absences: MechanicAbsence[];
  vehicleById: Map<string, Vehicle>;
  selectedMechanicId: string | null;
  view: GanttView;
  date: Date;
  winStart: Date;
  winEnd: Date;
  onSelectOrder: (id: string) => void;
  onEditOrder: (id: string) => void;
  onUnassignOrder: (id: string) => void;
  onDeleteOrder: (id: string) => void;
  onAddAbsence: (mechanicId: string) => void;
  registerRow: (mechanicId: string, el: HTMLDivElement | null) => void;
};
