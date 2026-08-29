import { useCallback, useEffect, useRef, useState } from 'react';
import type { Destination, HistoryEntry, LatLng, QuizResult, Room, RouteResult, ScreenId, Stop } from '../lib/types';
import * as api from '../lib/api';
import type { GeocodeSearchResult } from '../lib/api';
import * as rt from '../lib/socket';
import { getOrCreatePlayerId, saveHistoryEntry, saveRecentRoom, compressImageDataUrl } from '../lib/storage';
import { haversine, scoreForDistance, simulateDistance } from '../lib/geo';

const DEFAULT_ORIGIN: LatLng = { lat: 34.9858, lng: 135.7588 }; // Kyoto station (fallback "current location")
const DEFAULT_DEST: Destination = { name: '京都駅', lat: 34.9858, lng: 135.7588 };
const DEST_CHIPS = ['祇園・八坂神社', '嵐山', '伏見稲荷大社', '金閣寺', '京都駅'];

function routeKeyFor(origin: LatLng, dest: LatLng): string {
  return `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}|${dest.lat.toFixed(3)},${dest.lng.toFixed(3)}`;
}

export function useGameEngine() {
  const [screen, setScreen] = useState<ScreenId>('hero');

  // ---------------- geolocation ----------------
  const [userGeo, setUserGeo] = useState<LatLng | null>(null);
  const geoWatchId = useRef<number | null>(null);
  const geoInFlight = useRef(false);

  const startGeoWatch = useCallback(() => {
    if (!navigator.geolocation || geoWatchId.current !== null) return;
    geoWatchId.current = navigator.geolocation.watchPosition(
      (pos) => setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        /* keep showing the last known position if we can't keep tracking */
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }, []);

  const requestGeo = useCallback(() => {
    if (!navigator.geolocation || geoInFlight.current) return;
    geoInFlight.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        geoInFlight.current = false;
        setUserGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        startGeoWatch();
      },
      () => {
        geoInFlight.current = false; // couldn't get a fix — carry on in "experience mode"
      },
      { timeout: 8000 }
    );
  }, [startGeoWatch]);

  const autoRequestGeoOnce = useCallback(() => {
    setUserGeo((cur) => {
      if (!cur) requestGeo();
      return cur;
    });
  }, [requestGeo]);

  const routeOrigin = useCallback((): LatLng => userGeo || DEFAULT_ORIGIN, [userGeo]);

  // ---------------- destination picking ----------------
  const [destination, setDestinationState] = useState<Destination | null>(null);
  const [destStatus, setDestStatus] = useState('目的地を入力するか、下の地図をクリックして選んでください');
  const [destSuggestions, setDestSuggestions] = useState<GeocodeSearchResult[]>([]);
  const destCoord = useCallback((): Destination => destination || DEFAULT_DEST, [destination]);

  const selectDestination = useCallback((dest: Destination) => {
    setDestinationState(dest);
    setDestStatus('目的地: ' + dest.name);
    setDestSuggestions([]);
  }, []);

  const selectDestinationFromMap = useCallback(
    async (lat: number, lng: number) => {
      setDestStatus('地図の地点を確認中…');
      try {
        const { name } = await api.geocodeReverse(lat, lng, 'destination');
        const finalName = name || `地図上の地点 (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        selectDestination({ name: finalName, lat, lng });
      } catch {
        selectDestination({ name: `地図上の地点 (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng });
      }
    },
    [selectDestination]
  );

  const geocodeDestination = useCallback(
    async (query: string) => {
      setDestSuggestions([]);
      if (!query) {
        setDestStatus('目的地を入力してください');
        return;
      }
      setDestStatus('検索中…');
      try {
        const ref = userGeo || DEFAULT_ORIGIN;
        const { results } = await api.geocodeSearch(query, ref);
        if (!results.length) {
          setDestStatus('見つかりませんでした。別のキーワードで試してください');
          return;
        }
        const top = results[0];
        selectDestination({ name: top.name || top.displayName, lat: top.lat, lng: top.lng });
        setDestSuggestions(results.length > 1 ? results : []);
      } catch {
        setDestStatus('検索できませんでした（通信環境をご確認ください）');
      }
    },
    [userGeo, selectDestination]
  );

  // ---------------- route (for the live map preview) ----------------
  const [route, setRoute] = useState<RouteResult | null>(null);
  const routeKeyRef = useRef<string | null>(null);
  const routeLoadingRef = useRef(false);

  const ensureRoute = useCallback(() => {
    const origin = routeOrigin();
    const dest = destCoord();
    const key = routeKeyFor(origin, dest);
    if (routeKeyRef.current === key || routeLoadingRef.current) return;
    routeLoadingRef.current = true;
    api
      .fetchRoute(origin, dest)
      .then((result) => {
        routeKeyRef.current = key;
        setRoute(result);
      })
      .catch(() => {
        /* map preview is best-effort */
      })
      .finally(() => {
        routeLoadingRef.current = false;
      });
  }, [routeOrigin, destCoord]);

  useEffect(() => {
    ensureRoute();
  }, [ensureRoute]);

  // ---------------- quiz stops / results ----------------
  const [stopsCountChoice, setStopsCountChoice] = useState(2);
  const [loadingText, setLoadingText] = useState('現在地から経路を検索中…');
  const [stops, setStops] = useState<Stop[]>([]);
  const [stopsCount, setStopsCount] = useState(0);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealFinal, setRevealFinal] = useState(false);

  const isStopAnswered = useCallback((i: number) => results.some((r) => r.stopIdx === i), [results]);
  const firstUnansweredIdx = useCallback(() => {
    for (let i = 0; i < stops.length; i++) if (!isStopAnswered(i)) return i;
    return 0;
  }, [stops, isStopAnswered]);

  // ---------------- group battle ----------------
  const [playerId] = useState(() => getOrCreatePlayerId());
  const [playerName, setPlayerName] = useState('');
  const [groupMode, setGroupMode] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [groupMenuStatus, setGroupMenuStatus] = useState('');
  const [groupWaitStatus, setGroupWaitStatus] = useState('');
  const groupQuizStartedRef = useRef(false);
  const groupRevealStartedRef = useRef(false);

  useEffect(() => {
    const offUpdate = rt.onRoomUpdate((r) => {
      setRoom(r);
      if (!isHost && r.status === 'playing' && r.stops.length && !groupQuizStartedRef.current) {
        groupQuizStartedRef.current = true;
        if (r.destination) setDestinationState(r.destination);
        setStops(r.stops);
        setStopsCount(r.stops.length);
        setIdx(0);
        setResults([]);
        setRevealIdx(0);
        setRevealFinal(false);
        groupRevealStartedRef.current = false;
        setScreen('quiz');
      }
    });
    const offReveal = rt.onRevealReady(() => {
      if (groupRevealStartedRef.current) return;
      groupRevealStartedRef.current = true;
      setResults((prev) => {
        const sorted = [...prev].sort((a, b) => a.stopIdx - b.stopIdx);
        return sorted;
      });
      setRevealIdx(0);
      setRevealFinal(false);
      setScreen('reveal');
    });
    return () => {
      offUpdate();
      offReveal();
    };
  }, [isHost]);

  const openGroupMenu = useCallback(() => {
    setGroupMenuStatus('');
    setScreen('group-menu');
  }, []);

  const createGroupRoom = useCallback(async (name: string) => {
    if (!name.trim()) {
      setGroupMenuStatus('プレイヤー名を入力してください');
      return;
    }
    setPlayerName(name);
    setGroupMenuStatus('ルームを作成しています…');
    try {
      const { room: r } = await rt.createRoom(playerId, name);
      setRoomCode(r.code);
      setRoom(r);
      setIsHost(true);
      setGroupMode(true);
      groupQuizStartedRef.current = false;
      groupRevealStartedRef.current = false;
      setGroupWaitStatus('全員が揃ったら「旅のしたくへ進む」を押してください。');
      setScreen('group-wait');
      startGeoWatch();
    } catch (err) {
      setGroupMenuStatus('ルーム作成に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [startGeoWatch, playerId]);

  const joinGroupRoom = useCallback(
    async (name: string, code: string) => {
      if (!name.trim()) {
        setGroupMenuStatus('プレイヤー名を入力してください');
        return;
      }
      const upper = code.trim().toUpperCase();
      if (!upper) {
        setGroupMenuStatus('ルームコードを入力してください');
        return;
      }
      setPlayerName(name);
      setGroupMenuStatus('ルームを確認しています…');
      try {
        const { room: r } = await rt.joinRoom(upper, playerId, name);
        setRoomCode(r.code);
        setRoom(r);
        setIsHost(false);
        setGroupMode(true);
        groupQuizStartedRef.current = false;
        groupRevealStartedRef.current = false;
        setGroupWaitStatus('ホストが目的地と写真を決めるのを待っています…（自動で始まります）');
        setScreen('group-wait');
        startGeoWatch();
      } catch (err) {
        setGroupMenuStatus('参加に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
      }
    },
    [startGeoWatch, playerId]
  );

  const leaveGroup = useCallback(() => {
    if (roomCode) rt.leaveRoomSocket(roomCode, playerId);
    setRoomCode(null);
    setRoom(null);
    setIsHost(false);
    setGroupMode(false);
    groupQuizStartedRef.current = false;
    groupRevealStartedRef.current = false;
  }, [roomCode, playerId]);

  // ---------------- quiz flow ----------------
  const initQuizFromStops = useCallback(
    (newStops: Stop[], destForTitle: Destination) => {
      setStops(newStops);
      setStopsCount(newStops.length);
      setIdx(0);
      setResults([]);
      setRevealIdx(0);
      setRevealFinal(false);
      groupRevealStartedRef.current = false;
      if (groupMode && roomCode) saveRecentRoom(roomCode, destForTitle.name);
      setScreen('quiz');
    },
    [groupMode, roomCode]
  );

  const depart = useCallback(async () => {
    if (!destination) {
      setDestStatus('先に目的地を検索して選んでください');
      return;
    }
    setScreen('loading');
    setLoadingText('現在地から目的地までの経路を検索中…');
    await new Promise((r) => setTimeout(r, 600));

    const origin = routeOrigin();
    const dest = destCoord();
    setLoadingText('道中のストリートビューを確認しています…');
    try {
      const { route: r, stops: confirmed } = await api.generateQuiz(origin, dest, stopsCountChoice);
      routeKeyRef.current = routeKeyFor(origin, dest);
      setRoute(r);

      if (!confirmed.length) {
        setLoadingText('この道沿いのストリートビューが見つかりませんでした。目的地を変えてお試しください。');
        setTimeout(() => setScreen('setup'), 2400);
        return;
      }

      if (groupMode && isHost && roomCode) {
        try {
          await rt.startQuizOnRoom(roomCode, playerId, dest, confirmed);
        } catch {
          /* if the room push fails we still let the host play locally */
        }
      }
      initQuizFromStops(confirmed, dest);
    } catch {
      setLoadingText('道中のお題を生成できませんでした。通信環境をご確認のうえ、もう一度お試しください。');
      setTimeout(() => setScreen('setup'), 2400);
    }
  }, [destination, routeOrigin, destCoord, stopsCountChoice, groupMode, isHost, roomCode, initQuizFromStops, playerId]);

  const goToSetup = useCallback(() => {
    setScreen('setup');
    autoRequestGeoOnce();
  }, [autoRequestGeoOnce]);

  const hostStartTrip = useCallback(() => {
    goToSetup();
  }, [goToSetup]);

  const getGeoOrSimulate = useCallback((target: LatLng): Promise<{ distance: number; simulated: boolean; userGeo: LatLng | null }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ distance: simulateDistance(), simulated: true, userGeo: null });
        return;
      }
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ distance: simulateDistance(), simulated: true, userGeo: null });
      }, 8000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const d = haversine(pos.coords.latitude, pos.coords.longitude, target.lat, target.lng);
          resolve({ distance: d, simulated: false, userGeo: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        },
        () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve({ distance: simulateDistance(), simulated: true, userGeo: null });
        },
        { timeout: 7500, enableHighAccuracy: true }
      );
    });
  }, []);

  const submitPhoto = useCallback(
    async (dataUrl: string) => {
      const lm = stops[idx];
      if (!lm) return;
      const { distance, simulated, userGeo: shotGeo } = await getGeoOrSimulate(lm);
      const score = scoreForDistance(distance);
      const newResult: QuizResult = {
        stopIdx: idx,
        key: lm.key,
        name: lm.name,
        fact: lm.fact,
        targetImg: lm.liveImg,
        targetLat: lm.lat,
        targetLng: lm.lng,
        userImg: dataUrl,
        userGeo: shotGeo,
        distance,
        score,
        simulated,
      };

      let nextResults: QuizResult[] = [];
      setResults((prev) => {
        const existingIdx = prev.findIndex((r) => r.stopIdx === idx);
        nextResults = existingIdx >= 0 ? prev.map((r, i) => (i === existingIdx ? newResult : r)) : [...prev, newResult];
        return nextResults;
      });

      if (groupMode && roomCode) {
        const totalScore = nextResults.reduce((s, r) => s + r.score, 0);
        void totalScore; // server recomputes the total from history; kept for clarity
        const thumb = (await compressImageDataUrl(dataUrl, 360, 0.65)) || dataUrl;
        rt
          .submitAnswerToRoom(roomCode, playerId, {
            stopIdx: idx,
            score,
            distance,
            stopName: lm.name,
            userImgThumb: thumb,
            targetImg: lm.liveImg,
          })
          .catch(() => {});
        saveHistoryEntry({
          ts: Date.now(),
          mode: 'group',
          destination: destination?.name || '',
          playerName,
          stopName: lm.name,
          score,
          distance,
          userImg: thumb,
          targetImg: lm.liveImg,
        });
        setIdx(firstUnansweredIdx());
        setScreen('quiz');
      } else {
        compressImageDataUrl(dataUrl, 360, 0.65).then((thumb) => {
          saveHistoryEntry({
            ts: Date.now(),
            mode: 'solo',
            destination: destination?.name || '',
            playerName: 'あなた',
            stopName: lm.name,
            score,
            distance,
            userImg: thumb || dataUrl,
            targetImg: lm.liveImg,
          });
        });
        if (nextResults.length >= stopsCount) {
          const sorted = [...nextResults].sort((a, b) => a.stopIdx - b.stopIdx);
          setResults(sorted);
          setRevealIdx(0);
          setRevealFinal(false);
          setScreen('reveal');
        } else {
          const next = (() => {
            for (let i = 0; i < stops.length; i++) if (!nextResults.some((r) => r.stopIdx === i)) return i;
            return 0;
          })();
          setIdx(next);
          setScreen('quiz');
        }
      }
    },
    [stops, idx, getGeoOrSimulate, groupMode, roomCode, destination, playerName, firstUnansweredIdx, stopsCount, playerId]
  );

  const advanceReveal = useCallback(() => {
    if (revealIdx < results.length - 1) {
      setRevealIdx((i) => i + 1);
    } else if (groupMode) {
      setScreen('group-result');
    } else {
      setRevealFinal(true);
    }
  }, [revealIdx, results.length, groupMode]);

  const replay = useCallback(() => {
    goToSetup();
  }, [goToSetup]);

  const goHome = useCallback(() => {
    setScreen('hero');
  }, []);

  const goHomeFromGroup = useCallback(() => {
    leaveGroup();
    setScreen('hero');
  }, [leaveGroup]);

  return {
    screen,
    setScreen,
    userGeo,
    autoRequestGeoOnce,
    destination,
    destStatus,
    destSuggestions,
    destChips: DEST_CHIPS,
    selectDestination,
    selectDestinationFromMap,
    geocodeDestination,
    route,
    routeOrigin,
    destCoord,
    stopsCountChoice,
    setStopsCountChoice,
    loadingText,
    stops,
    stopsCount,
    idx,
    setIdx,
    results,
    revealIdx,
    revealFinal,
    isStopAnswered,
    depart,
    goToSetup,
    submitPhoto,
    advanceReveal,
    replay,
    goHome,
    // group
    groupMode,
    isHost,
    playerId,
    playerName,
    roomCode,
    room,
    groupMenuStatus,
    groupWaitStatus,
    openGroupMenu,
    createGroupRoom,
    joinGroupRoom,
    hostStartTrip,
    goHomeFromGroup,
    getRoomHistory: rt.getRoomSnapshot,
  };
}

export type GameEngine = ReturnType<typeof useGameEngine>;
export type { HistoryEntry, Room, RouteResult };
