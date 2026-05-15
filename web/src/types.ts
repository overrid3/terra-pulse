export type UUID = string;

export type LatLng = { lat: number; lng: number };

export type MechanicStatus = "IDLE" | "EN_ROUTE" | "IN_PROGRESS" | "OFF_DUTY";

export type Mechanic = {
  id: UUID;
  fullName: string;
  phone?: string | null;
  skills: string[];
  status: MechanicStatus;
  location: LatLng | null;
  locationUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceOrderState =
  | "REQUESTED" | "QUOTED" | "APPROVED" | "DISPATCHED"
  | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export const SERVICE_ORDER_STATES: ServiceOrderState[] = [
  "REQUESTED", "QUOTED", "APPROVED", "DISPATCHED", "IN_PROGRESS", "COMPLETED", "CANCELLED"
];

export type ServiceOrder = {
  id: UUID;
  title?: string;
  vehicleId: UUID;
  mechanicId: UUID | null;
  clientId: UUID | null;
  siteId: UUID;
  clientName: string | null;
  vmrsCode: string;
  vmrsDescription?: string;
  state: ServiceOrderState;
  estimatedMinutes: number;
  actualMinutes: number | null;
  siteLocation: LatLng;
  requestedAt: string;
  dispatchedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type VehicleClass = "EXCAVATOR" | "DOZER" | "LOADER" | "GRADER" | "DUMP_TRUCK";
export const VEHICLE_CLASSES: VehicleClass[] = ["EXCAVATOR", "DOZER", "LOADER", "GRADER", "DUMP_TRUCK"];

export type VehicleStatus = "AVAILABLE" | "RESERVED" | "IN_SERVICE" | "OUT_OF_ORDER";
export const VEHICLE_STATUSES: VehicleStatus[] = ["AVAILABLE", "RESERVED", "IN_SERVICE", "OUT_OF_ORDER"];

export type Vehicle = {
  id: UUID;
  make: string;
  model: string;
  serialNumber: string;
  vehicleClass: VehicleClass;
  engineHours: number;
  status: VehicleStatus;
  siteId: UUID | null;
  createdAt?: string;
  updatedAt?: string;
};

export type VehicleUpsert = {
  make: string;
  model: string;
  serialNumber: string;
  vehicleClass: VehicleClass;
  engineHours: number;
  status: VehicleStatus;
};

export type Client = {
  id: UUID;
  name: string;
  email: string;
  phone: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientUpsert = Omit<Client, "id" | "createdAt" | "updatedAt">;

export type ClientSummary = {
  id: UUID;
  name: string;
  email: string;
  phone: string | null;
  vatNumber: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  siteCount: number;
  openOrderCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Site = {
  id: UUID;
  clientId: UUID;
  name: string;
  lat: number | null;
  lng: number | null;
  locationLabel: string | null;
  openOrderCount: number;
  equipmentCount: number;
  personnelCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SiteUpsert = {
  name: string;
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string | null;
};

export type Skill = {
  id: UUID;
  name: string;
  createdAt?: string | null;
};

export type AbsenceType = "VACATION" | "SICK" | "TRAINING" | "OTHER";
export const ABSENCE_TYPES: AbsenceType[] = ["VACATION", "SICK", "TRAINING", "OTHER"];

export type MechanicAbsence = {
  id: UUID;
  mechanicId: UUID;
  startAt: string;
  endAt: string;
  type: AbsenceType;
  reason: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type AbsenceUpsert = {
  mechanicId: UUID;
  startAt: string;
  endAt: string;
  type: AbsenceType;
  reason?: string | null;
};
