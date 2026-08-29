import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLng, RouteResult } from '../lib/types';

interface RouteMapProps {
  origin: LatLng;
  originKnown: boolean;
  dest: LatLng & { name: string };
  route: RouteResult | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

// Leaflet + OpenStreetMap tiles (no API key needed). Ported from the original
// renderRouteMap(): shows origin/destination markers and the walking route line,
// optionally letting the player click the map to pick a destination.
export function RouteMap({ origin, originKnown, dest, route, onMapClick, className }: RouteMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ userMarker: L.CircleMarker | null; destMarker: L.CircleMarker | null; line: L.Polyline | null }>({
    userMarker: null,
    destMarker: null,
    line: null,
  });
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const map = L.map(elRef.current, { attributionControl: true, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    map.on('click', (e) => onMapClickRef.current?.(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layers = layersRef.current;

    if (layers.destMarker) map.removeLayer(layers.destMarker);
    layers.destMarker = L.circleMarker([dest.lat, dest.lng], {
      radius: 9,
      color: '#faf9f6',
      weight: 2,
      fillColor: '#c1321a',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip('目的地');

    if (layers.userMarker) map.removeLayer(layers.userMarker);
    layers.userMarker = L.circleMarker([origin.lat, origin.lng], {
      radius: 9,
      color: '#faf9f6',
      weight: 2,
      fillColor: '#15130f',
      fillOpacity: 1,
    })
      .addTo(map)
      .bindTooltip(originKnown ? '現在地' : '現在地（未取得のため仮の位置）');

    if (layers.line) {
      map.removeLayer(layers.line);
      layers.line = null;
    }
    const useReal = !!(route && route.isReal);
    const lineCoords: [number, number][] = useReal && route ? route.coords : [[origin.lat, origin.lng], [dest.lat, dest.lng]];
    layers.line = L.polyline(lineCoords, useReal ? { color: '#15130f', weight: 4, opacity: 0.85 } : { color: '#15130f', weight: 2, dashArray: '4 6', opacity: 0.7 }).addTo(map);

    map.fitBounds(lineCoords, { padding: [30, 30], maxZoom: 15 });
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [origin.lat, origin.lng, originKnown, dest.lat, dest.lng, route]);

  return <div ref={elRef} className={className} />;
}
