import { api } from "./client";

export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
};

export const geoApi = {
  geocode: (q: string, limit = 5) =>
    api.get<GeocodeResult[]>(`/geo/geocode?q=${encodeURIComponent(q)}&limit=${limit}`)
};
