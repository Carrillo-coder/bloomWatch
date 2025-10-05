import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Icono simple
const icon = L.divIcon({
  className: "globe-point",
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#1976d2;border:1px solid #fff"></div>`
});

export default function GlobeLayer({ points }) {
  return (
    <>
      {points.map((p, idx) => (
        <Marker key={idx} position={[p.lat, p.lon]} icon={icon}>
          <Popup>
            <div><b>GLOBE</b></div>
            <div>Fecha: {p.date || "—"}</div>
            <div>Color/Nota: {p.color || "—"}</div>
            <div>Lat/Lon: {p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
