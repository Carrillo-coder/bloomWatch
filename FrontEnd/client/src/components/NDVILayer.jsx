import { Marker, Popup } from "react-leaflet";
import L from "leaflet";

// Function to get color based on NDVI value
const getColor = (ndvi) => {
  if (ndvi < 0.2) return "#d73027"; // red
  if (ndvi < 0.4) return "#fc8d59"; // orange
  if (ndvi < 0.6) return "#fee08b"; // yellow
  if (ndvi < 0.8) return "#91cf60"; // light green
  return "#1a9850"; // dark green
};

export default function NDVILayer({ points }) {
  if (!points || points.length === 0) {
    return null;
  }

  return (
    <>
      {points.map((p, idx) => {
        const icon = L.divIcon({
          className: "ndvi-point",
          html: `<div style="width:10px;height:10px;border-radius:50%;background:${getColor(p.ndvi)};border:1px solid #fff"></div>`
        });

        return (
          <Marker key={idx} position={[p.lat, p.lon]} icon={icon}>
            <Popup>
              <div><b>NDVI</b></div>
              <div>Date: {p.date}</div>
              <div>NDVI: {p.ndvi}</div>
              <div>Lat/Lon: {p.lat.toFixed(4)}, {p.lon.toFixed(4)}</div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}
