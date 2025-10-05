// client/src/components/MapView.jsx
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  LayersControl,
  useMap,
  useMapEvents,
  Marker,
  Popup,
} from "react-leaflet";
import dayjs from "dayjs";
import GlobeLayer from "./GlobeLayer";

// (Opcional) Corrige íconos por defecto en Vite si el marcador no se ve:
import L from "leaflet";
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Centroides rápidos de zonas agrícolas en Chihuahua (puedes editar)
const REGIONS = {
  "Delicias (walnut/alfalfa)": { lat: 28.190, lng: -105.470, zoom: 9 },
  "Cuauhtémoc (apple)": { lat: 28.407, lng: -106.865, zoom: 9 },
  "Valle de Juárez (corn/cotton)": { lat: 31.614, lng: -106.135, zoom: 9 },
  Camargo: { lat: 27.666, lng: -105.170, zoom: 10 },
};

function FlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo([center.lat, center.lng], center.zoom || 7);
  }, [center, map]);
  return null;
}

// Nuevo: componente para capturar el clic en el mapa
function ClickHandler({ onClick }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onClick?.(lat, lng);
    },
  });
  return null;
}

export default function MapView({
  selectedRegion,
  dateISO,
  globePoints = [],
  onMapClick, // NUEVO: callback opcional
  mapCenter,
}) {
  // Fecha en formato YYYY-MM-DD para GIBS Time
  const gibsDate = useMemo(() => dayjs(dateISO).format("YYYY-MM-DD"), [dateISO]);
  const center =
    selectedRegion ? REGIONS[selectedRegion] : { lat: 28.6, lng: -106.1, zoom: 6 };

  // Estado local para dibujar un marcador donde se hizo clic
  const [clicked, setClicked] = useState(null); // { lat, lon }

  // URLs de capas GIBS
  const TRUE_COLOR = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  const MODIS_NDVI_16 = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_16Day/default/${gibsDate}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`;

  // Maneja clic: guarda marcador y propaga al padre
  const handleClick = (lat, lon) => {
    setClicked({ lat, lon });
    onMapClick?.(lat, lon);
  };

  // Nuevo: efecto para centrar el mapa según el prop mapCenter
  useEffect(() => {
    if (mapCenter) {
      setClicked(null); // Opcional: limpiar el marcador al cambiar el centro del mapa
    }
  }, [mapCenter]);

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={center.zoom}
      style={{ height: "calc(100vh - 170px)", width: "100%" }}
      scrollWheelZoom
    >
      <FlyTo center={center} />
      <ClickHandler onClick={handleClick} />

      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="VIIRS True Color (NASA GIBS)">
          <TileLayer
            url={TRUE_COLOR}
            attribution="Imagery: NASA/GSFC GIBS & VIIRS"
            tileSize={256}
            zoomOffset={0}
            detectRetina={false}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="MODIS Terra NDVI 16-day (GIBS)">
          <TileLayer
            url={MODIS_NDVI_16}
            opacity={0.75}
            attribution="MODIS NDVI: NASA/LP DAAC via GIBS"
          />
        </LayersControl.Overlay>
      </LayersControl>

      {/* Puntos de GLOBE (si existen) */}
      {globePoints?.length > 0 && <GlobeLayer points={globePoints} />}

      {/* Marcador del punto clicado */}
      {clicked && (
        <Marker position={[clicked.lat, clicked.lon]}>
          <Popup>
            Punto seleccionado<br />
            {clicked.lat.toFixed(4)}, {clicked.lon.toFixed(4)}<br />
            Fecha GIBS: {gibsDate}
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
