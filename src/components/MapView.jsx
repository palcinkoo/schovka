import { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** Ikony sú čisté CSS/emoji (divIcon) – nepotrebujú žiadny externý obrázok. */
const pin = (emoji, cls, size = 34) =>
  L.divIcon({
    className: 'schovka-icon',
    html: `<div class="schovka-pin ${cls}">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size - 2],
    popupAnchor: [0, -(size - 4)],
  });

export const icons = {
  user: pin('🧭', 'schovka-pin--user'),
  start: pin('🟢', 'schovka-pin--start', 28),
  end: pin('🏁', 'schovka-pin--end', 28),
  target: pin('🎯', 'schovka-pin--target'),
};

function ClickPicker({ onPick }) {
  useMapEvents({
    click(e) {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.flyTo(center, zoom ?? map.getZoom(), { duration: 0.6 });
  }, [center?.[0], center?.[1], zoom, map]);
  return null;
}

/**
 * @param {object}   props
 * @param {number[]} props.center   [lat, lng]
 * @param {object[]} props.markers  [{key,lat,lng,icon,label}]
 * @param {object[]} props.lines    [{key,coords:[[lat,lng]],color,dashed,weight}]
 * @param {object}   props.circle   {lat,lng,radius}
 * @param {Function} props.onPick   klik do mapy → {lat,lng}
 */
export default function MapView({
  center = [48.8103, 17.1631],
  zoom = 15,
  markers = [],
  lines = [],
  circle = null,
  onPick = null,
  className = '',
  scrollWheelZoom = true,
}) {
  return (
    <div className={`map-wrap ${className}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom={scrollWheelZoom} className="map">
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
            radius={Math.max(circle.radius || 20, 15)}
            pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.1 }}
          />
        )}

        {lines
          .filter((l) => l.coords?.length > 1)
          .map((l) => (
            <Polyline
              key={l.key}
              positions={l.coords.map((p) => [p.lat, p.lng])}
              pathOptions={{
                color: l.color || '#2563eb',
                weight: l.weight || 4,
                opacity: 0.9,
                dashArray: l.dashed ? '8 8' : undefined,
                lineCap: 'round',
              }}
            />
          ))}

        {markers.map((m) => (
          <Marker key={m.key} position={[m.lat, m.lng]} icon={icons[m.icon] || icons.target}>
            {m.label && <Popup>{m.label}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
