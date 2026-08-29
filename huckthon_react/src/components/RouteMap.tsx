import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLng, RouteResult } from '../lib/types';
import headingArrowUrl from '../assets/heading-arrow.png';

interface RouteMapProps {
  origin: LatLng;
  originKnown: boolean;
  dest: LatLng & { name: string };
  route: RouteResult | null;
  heading?: number | null;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

// Leaflet + OpenStreetMap tiles (no API key needed). Ported from the original
// renderRouteMap(): shows origin/destination markers and the walking route line,
// optionally letting the player click the map to pick a destination.
export function RouteMap({ origin, originKnown, dest, route, heading, onMapClick, className }: RouteMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<{ destMarker: L.CircleMarker | null; line: L.Polyline | null }>({
    destMarker: null,
    line: null,
  });
  // The user's own position is shown as a single marker: the arrow-illustration icon (rotated to
  // the compass heading) when we have one, or a plain dot when we don't know which way they're
  // facing yet. Kept in its own effect (no fitBounds call here) so it can update on every GPS/
  // compass reading without ever touching the map's zoom/pan.
  const positionMarkerRef = useRef<L.Marker | L.CircleMarker | null>(null);
  const positionMarkerKindRef = useRef<'arrow' | 'dot' | null>(null);
  const fittedKeyRef = useRef<string | null>(null);
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

    if (layers.line) {
      map.removeLayer(layers.line);
      layers.line = null;
    }
    const useReal = !!(route && route.isReal);
    const lineCoords: [number, number][] = useReal && route ? route.coords : [[origin.lat, origin.lng], [dest.lat, dest.lng]];
    layers.line = L.polyline(lineCoords, useReal ? { color: '#15130f', weight: 4, opacity: 0.85 } : { color: '#15130f', weight: 2, dashArray: '4 6', opacity: 0.7 }).addTo(map);

    // Only auto-fit/re-zoom the view the first time this route/destination is shown — subsequent
    // marker-position updates (e.g. from GPS jitter while the player holds a zoomed-in view) must
    // not reset a zoom level the player chose themselves (this was the "zooming in on mobile keeps
    // snapping back out" bug).
    const fitKey = `${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}|${useReal ? 'r' : 's'}|${lineCoords.length}`;
    if (fittedKeyRef.current !== fitKey) {
      fittedKeyRef.current = fitKey;
      map.fitBounds(lineCoords, { padding: [30, 30], maxZoom: 15 });
    }
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [origin.lat, origin.lng, dest.lat, dest.lng, route]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const wantKind: 'arrow' | 'dot' = heading != null ? 'arrow' : 'dot';
    const tooltipText =
      wantKind === 'arrow' ? '現在地（進んでいる方向）' : originKnown ? '現在地' : '現在地（未取得のため仮の位置）';

    if (positionMarkerRef.current && positionMarkerKindRef.current !== wantKind) {
      map.removeLayer(positionMarkerRef.current);
      positionMarkerRef.current = null;
      positionMarkerKindRef.current = null;
    }

    if (wantKind === 'arrow') {
      const icon = L.divIcon({
        className: 'heading-arrow-icon',
        html: `<div class="heading-arrow-img" style="background-image:url('${headingArrowUrl}'); transform:rotate(${heading}deg)"></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      if (!positionMarkerRef.current) {
        positionMarkerRef.current = L.marker([origin.lat, origin.lng], { icon, interactive: false, zIndexOffset: 1000 })
          .addTo(map)
          .bindTooltip(tooltipText);
        positionMarkerKindRef.current = 'arrow';
      } else {
        const m = positionMarkerRef.current as L.Marker;
        m.setLatLng([origin.lat, origin.lng]);
        m.setIcon(icon);
        m.setTooltipContent(tooltipText);
      }
    } else {
      if (!positionMarkerRef.current) {
        positionMarkerRef.current = L.circleMarker([origin.lat, origin.lng], {
          radius: 9,
          color: '#faf9f6',
          weight: 2,
          fillColor: '#15130f',
          fillOpacity: 1,
        })
          .addTo(map)
          .bindTooltip(tooltipText);
        positionMarkerKindRef.current = 'dot';
      } else {
        const m = positionMarkerRef.current as L.CircleMarker;
        m.setLatLng([origin.lat, origin.lng]);
        m.setTooltipContent(tooltipText);
      }
    }
  }, [heading, origin.lat, origin.lng, originKnown]);

  return <div ref={elRef} className={className} />;
}
