import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Vlastné ikony (divIcon), aby nebol potrebný žiadny externý obrázok. */
export const icons = {
  hide: L.divIcon({
    className: 'schovka-icon',
    html: '<div class="schovka-pin schovka-pin--hide">🫣</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 32],
    popupAnchor: [0, -30],
  }),
  pick: L.divIcon({
    className: 'schovka-icon',
    html: '<div class="schovka-pin schovka-pin--pick">📍</div>',
    iconSize: [36, 36],
    iconAnchor: [18, 32],
    popupAnchor: [0, -30],
  }),
  me: L.divIcon({
    className: 'schovka-icon',
    html: '<div class="schovka-pin schovka-pin--me">🧭</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 26],
    popupAnchor: [0, -22],
  }),
};

/** Kliknutie do mapy → výber súradníc (admin). */
function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Plynulé precentrovanie pri zmene cieľa. */
function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.8 });
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

export default function MapView({
  center = [48.8103, 17.1631],
  zoom = 15,
  markers = [],
  circle = null,
  onPick = null,
  className = '',
}) {
  return (
    <div className={`map-wrap ${className}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {onPick && <ClickPicker onPick={onPick} />}
        <Recenter center={center} zoom={zoom} />

        {circle && (
          <Circle
            center={[circle.lat, circle.lng]}
            radius={circle.radius}
            pathOptions={{ color: '#2563eb', fillOpacity: 0.08 }}
          />
        )}

        {markers.map((m) => (
          <Marker key={m.key} position={[m.lat, m.lng]} icon={icons[m.icon] || icons.hide}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
