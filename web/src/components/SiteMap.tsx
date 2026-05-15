import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

type SiteMapProps = {
  lat: number;
  lng: number;
  label?: string;
  height?: number | string;
  zoom?: number;
};

type RecenterProps = {
  lat: number;
  lng: number;
  zoom: number;
};

function Recenter({ lat, lng, zoom }: RecenterProps) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], zoom);
  }, [map, lat, lng, zoom]);
  return null;
}

export function SiteMap({ lat, lng, label, height = 240, zoom = 14 }: SiteMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      style={{ height, width: "100%", borderRadius: 8 }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Marker position={[lat, lng]}>
        {label ? <Popup>{label}</Popup> : null}
      </Marker>
      <Recenter lat={lat} lng={lng} zoom={zoom} />
    </MapContainer>
  );
}

export default SiteMap;
