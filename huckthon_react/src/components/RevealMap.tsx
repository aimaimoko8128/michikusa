import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLng, QuizResult, RouteResult } from '../lib/types';

interface RevealMapProps {
  result: QuizResult;
  origin: LatLng;
  originKnown: boolean;
  dest: LatLng & { name: string };
  route: RouteResult | null;
  className?: string;
}

// Ported from renderRevealMap(): shows the walking route, the sample-photo location,
// and (if we got a GPS fix) where the player actually took their photo.
export function RevealMap({ result, origin, originKnown, dest, route, className }: RevealMapProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  // Latest origin/originKnown, read (not watched) by the build effect below — this reveal is a
  // static one-shot snapshot, so a GPS update arriving after it's drawn must not tear the whole
  // map down and rebuild it (that reset any zoom the player had chosen, especially noticeable on
  // mobile where continued GPS watching keeps firing while this screen is open).
  const latestRef = useRef({ origin, originKnown });
  useEffect(() => {
    latestRef.current = { origin, originKnown };
  }, [origin, originKnown]);

  useEffect(() => {
    if (!elRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
    const { origin: originNow, originKnown: originKnownNow } = latestRef.current;
    const map = L.map(elRef.current, { attributionControl: true, zoomControl: true });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const target: [number, number] = [result.targetLat, result.targetLng];
    const destPt: [number, number] = [dest.lat, dest.lng];
    const originPt: [number, number] = [originNow.lat, originNow.lng];
    let boundsPts: [number, number][] = [target, destPt, originPt];

    const useReal = !!(route && route.isReal);
    const routeLineCoords: [number, number][] = useReal && route ? route.coords : [originPt, destPt];
    L.polyline(routeLineCoords, useReal ? { color: '#15130f', weight: 4, opacity: 0.85 } : { color: '#15130f', weight: 2, dashArray: '4 6', opacity: 0.7 }).addTo(map);
    boundsPts = boundsPts.concat(routeLineCoords);

    L.circleMarker(originPt, { radius: 7, color: '#15130f', weight: 2, fillColor: '#faf9f6', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip(originKnownNow ? 'スタート地点（現在地）' : 'スタート地点（未取得のため仮の位置）');

    L.circleMarker(destPt, { radius: 7, color: '#c1321a', weight: 2, fillColor: '#faf9f6', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip('目的地: ' + dest.name);

    L.circleMarker(target, { radius: 9, color: '#faf9f6', weight: 2, fillColor: '#c1321a', fillOpacity: 1 })
      .addTo(map)
      .bindTooltip('見本の地点');

    if (result.userGeo) {
      const userPt: [number, number] = [result.userGeo.lat, result.userGeo.lng];
      L.circleMarker(userPt, { radius: 9, color: '#faf9f6', weight: 2, fillColor: '#15130f', fillOpacity: 1 })
        .addTo(map)
        .bindTooltip('あなたの撮影地点');
      L.polyline([userPt, target], { color: '#15130f', weight: 2, dashArray: '4 6', opacity: 0.7 }).addTo(map);
      boundsPts.push(userPt);
    }

    map.fitBounds(boundsPts, { padding: [36, 36], maxZoom: 15 });
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [result, dest.lat, dest.lng, dest.name, route]);

  useEffect(
    () => () => {
      mapRef.current?.remove();
      mapRef.current = null;
    },
    []
  );

  return <div ref={elRef} className={className} />;
}
