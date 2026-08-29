import { useCallback, useEffect, useRef, useState } from 'react';
import type { Destination, HistoryEntry, LatLng, QuizResult, Room, RouteResult, ScreenId, Stop } from '../lib/types';
import * as api from '../lib/api';
import type { GeocodeSearchResult } from '../lib/api';
import * as rt from '../lib/rooms';
import { getOrCreatePlayerId, saveHistoryEntry, saveRecentRoom, compressImageDataUrl } from '../lib/storage';
import { haversine, scoreForDistance, simulateDistance } from '../lib/geo';
import { generateBlackoutCircles, type BlackoutCircle } from '../lib/blackout';

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

  // ---------------- facing direction (compass heading) ----------------
  const [heading, setHeading] = useState<number | null>(null);
  const headingWatchStarted = useRef(false);
  // Once a true compass reading (iOS's webkitCompassHeading, or a "deviceorientationabsolute"
  // event) has arrived, ignore plain relative "deviceorientation" events so they can't override
  // it with a heading that's only relative to wherever the phone happened to be pointed at
  // page-load. Until then, relative events are used as a best-effort fallback.
  const gotReliableHeadingRef = useRef(false);

  const handleOrientation = useCallback((e: DeviceOrientationEvent) => {
    const webkitHeading = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (typeof webkitHeading === 'number') {
      gotReliableHeadingRef.current = true;
      setHeading(webkitHeading);
      return;
    }
    if (typeof e.alpha !== 'number') return;
    const isAbsolute = e.type === 'deviceorientationabsolute' || (e as DeviceOrientationEvent & { absolute?: boolean }).absolute === true;
    if (!isAbsolute && gotReliableHeadingRef.current) return;
    if (isAbsolute) gotReliableHeadingRef.current = true;
    // Standard DeviceOrientation alpha increases counter-clockwise from north; flip it to a compass heading.
    setHeading((360 - e.alpha) % 360);
  }, []);

  // Starts listening for the device's compass heading. Must be called from a user-gesture handler
  // on iOS (Safari requires DeviceOrientationEvent.requestPermission() to be triggered by a tap).
  const startHeadingWatch = useCallback(() => {
    if (headingWatchStarted.current || typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return;
    headingWatchStarted.current = true;
    const attach = () => {
      // Attach both event types rather than feature-detecting which one to use: on a number of
      // Android/Chrome versions "ondeviceorientationabsolute" tests as supported but the event
      // never actually fires (or vice versa), which was silently leaving the arrow unshown.
      window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.addEventListener('deviceorientation', handleOrientation);
    };
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
    if (typeof DOE.requestPermission === 'function') {
      DOE.requestPermission()
        .then((state) => {
          if (state === 'granted') attach();
        })
        .catch(() => {
          /* permission denied/unavailable — just skip the heading arrow */
        });
    } else {
      attach();
    }
  }, [handleOrientation]);

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [handleOrientation]);

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
        startHeadingWatch();
      },
      () => {
        geoInFlight.current = false; // couldn't get a fix — carry on in "experience mode"
      },
      { timeout: 8000 }
    );
  }, [startGeoWatch, startHeadingWatch]);

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
  // One fixed random circle-blackout layout per stop, generated once when the round starts —
  // so switching back and forth between photos in group mode no longer reshuffles the black
  // circles each time (that used to defeat the "peek by switching away and back" protection).
  const [blackoutByStop, setBlackoutByStop] = useState<BlackoutCircle[][]>([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<QuizResult[]>([]);
  const [revealIdx, setRevealIdx] = useState(0);
  const [revealFinal, setRevealFinal] = useState(false);

  const isStopAnswered = useCallback((i: number) => results.some((r) => r.stopIdx === i), [results]);
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

  // Shared by both the passive Firebase listener (onRevealReady, below) and the explicit
  // post-submit check in submitPhoto: moves this player on to the reveal screen. Guarded by
  // groupRevealStartedRef so whichever path notices "everyone's done" first wins.
  const triggerGroupReveal = useCallback(() => {
    if (groupRevealStartedRef.current) return;
    groupRevealStartedRef.current = true;
    setResults((prev) => {
      const sorted = [...prev].sort((a, b) => a.stopIdx - b.stopIdx);
      return sorted;
    });
    setRevealIdx(0);
    setRevealFinal(false);
    setScreen('reveal');
  }, []);

  useEffect(() => {
    const offUpdate = rt.onRoomUpdate((r) => {
      setRoom(r);
      if (!isHost && r.status === 'playing' && r.stops.length && !groupQuizStartedRef.current) {
        groupQuizStartedRef.current = true;
        if (r.destination) setDestinationState(r.destination);
        setStops(r.stops);
        setStopsCount(r.stops.length);
        setBlackoutByStop(r.stops.map(() => generateBlackoutCircles()));
        setIdx(0);
        setResults([]);
        setRevealIdx(0);
        setRevealFinal(false);
        groupRevealStartedRef.current = false;
        setScreen('quiz');
      }
    });
    const offReveal = rt.onRevealReady(triggerGroupReveal);
    return () => {
      offUpdate();
      offReveal();
    };
  }, [isHost, triggerGroupReveal]);

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
      startHeadingWatch();
    } catch (err) {
      setGroupMenuStatus('ルーム作成に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
    }
  }, [startGeoWatch, startHeadingWatch, playerId]);

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
        startHeadingWatch();
      } catch (err) {
        setGroupMenuStatus('参加に失敗しました: ' + (err instanceof Error ? err.message : String(err)));
      }
    },
    [startGeoWatch, startHeadingWatch, playerId]
  );

  const leaveGroup = useCallback(() => {
    if (roomCode) rt.leaveRoomSocket();
    setRoomCode(null);
    setRoom(null);
    setIsHost(false);
    setGroupMode(false);
    groupQuizStartedRef.current = false;
    groupRevealStartedRef.current = false;
  }, [roomCode]);

  // ---------------- quiz flow ----------------
  const initQuizFromStops = useCallback(
    (newStops: Stop[], destForTitle: Destination) => {
      setStops(newStops);
      setStopsCount(newStops.length);
      setBlackoutByStop(newStops.map(() => generateBlackoutCircles()));
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
    startHeadingWatch();
  }, [autoRequestGeoOnce, startHeadingWatch]);

  const hostStartTrip = useCallback(() => {
    goToSetup();
  }, [goToSetup]);

  const GEO_TIMEOUT_MS = 10000;

  type GeoOutcome =
    | { ok: true; distance: number; simulated: boolean; userGeo: LatLng | null }
    | { ok: false; message: string };

  // Resolves the distance to `target` for scoring. If the device has no geolocation
  // support at all, falls back to a simulated ("experience mode") distance. Otherwise,
  // a failed/denied/timed-out fix does NOT get a simulated fallback — the caller is asked
  // to retake the photo instead, matching the original app's stricter behavior.
  const getGeoOrSimulate = useCallback((target: LatLng): Promise<GeoOutcome> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ ok: true, distance: simulateDistance(), simulated: true, userGeo: null });
        return;
      }
      let done = false;
      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        resolve({ ok: false, message: '10秒以内に位置情報を取得できませんでした。電波状況の良い場所で、もう一度撮影してください。' });
      }, GEO_TIMEOUT_MS);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          const d = haversine(pos.coords.latitude, pos.coords.longitude, target.lat, target.lng);
          resolve({ ok: true, distance: d, simulated: false, userGeo: { lat: pos.coords.latitude, lng: pos.coords.longitude } });
        },
        (err) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          if (err && err.code === 1) {
            resolve({ ok: false, message: '位置情報の利用が許可されていません。ブラウザの設定で位置情報を許可してから、もう一度撮影してください。' });
          } else {
            resolve({ ok: false, message: '位置情報を取得できませんでした。もう一度撮影してください。' });
          }
        },
        { timeout: GEO_TIMEOUT_MS, enableHighAccuracy: true }
      );
    });
  }, []);

  // Shared by submitPhoto (after a successful GPS fix) and skipGeoAndSubmit (when the player
  // gives up waiting for one) — everything past "we have a distance" is identical either way.
  const finalizeAnswer = useCallback(
    async (
      dataUrl: string,
      distance: number,
      simulated: boolean,
      shotGeo: LatLng | null,
      scoreOverride?: number
    ): Promise<string | null> => {
      const lm = stops[idx];
      if (!lm) return null;
      const score = scoreOverride ?? scoreForDistance(distance);
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
        const thumb = (await compressImageDataUrl(dataUrl, 360, 0.65)) || dataUrl;
        const justFinished = nextResults.length >= stopsCount;
        const submitPromise = rt.submitAnswerToRoom(roomCode, playerId, playerName, {
          stopIdx: idx,
          score,
          distance,
          stopName: lm.name,
          userImgThumb: thumb,
          targetImg: lm.liveImg,
          totalScore,
          answeredCount: nextResults.length,
          finished: justFinished,
        });
        if (justFinished) {
          // This was our last photo. Don't just fire-and-forget and wait on the passive realtime
          // listener — re-check the room ourselves right away. This matters most when testing/
          // playing group mode solo (no other players to ever push a further update): the listener
          // should already catch this, but without this direct check a lone player could be left
          // stuck on "waiting for everyone" forever since nothing else would nudge the room again.
          try {
            await submitPromise;
            const { room: freshRoom } = await rt.getRoomSnapshot(roomCode);
            const pids = Object.keys(freshRoom.players);
            const allFinished = pids.length > 0 && pids.every((pid) => freshRoom.players[pid].finished);
            if (allFinished) triggerGroupReveal();
          } catch {
            /* the realtime listener is still the primary path; this was just a redundant nudge */
          }
        } else {
          submitPromise.catch(() => {});
        }
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
        // If this submission just triggered (or raced with the passive listener triggering)
        // the group reveal, screen is already 'reveal' — don't stomp it back to 'quiz'. That
        // stomp was the bug: the last player to submit would flash to the reveal screen and then
        // immediately bounce back to "全員の撮影を待っています…" because this fall-through used to
        // run unconditionally.
        if (!groupRevealStartedRef.current) {
          // Use the freshly-computed `nextResults` (not a memoized helper reading the `results` state, which
          // closes over the `results` state from before this setResults() call took effect) —
          // otherwise this looks up "first unanswered stop" against stale data that doesn't yet
          // include the photo we just submitted, lands back on the same stop we just answered, and
          // with idx unchanged the screen never advances (and the "位置情報を確認中…" status label,
          // which only gets cleared by an effect keyed on idx, is left stuck on screen too).
          const nextIdx = (() => {
            for (let i = 0; i < stops.length; i++) if (!nextResults.some((r) => r.stopIdx === i)) return i;
            return 0;
          })();
          setIdx(nextIdx);
          setScreen('quiz');
        }
        return null;
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
        return null;
      }
    },
    [stops, idx, groupMode, roomCode, destination, playerName, stopsCount, playerId, triggerGroupReveal]
  );

  // Guards against a slow/rare-but-possible GPS resolution racing a later user action for the
  // same photo (typically: the player gets impatient and taps "skip" while a still-pending
  // getGeoOrSimulate() from the original attempt is stuck waiting — some mobile browsers can, in
  // rare cases, never invoke either geolocation callback at all, e.g. if a system permission
  // dialog is left unanswered). Every new submission attempt claims a fresh token; if a call
  // resolves under a stale token, its result is dropped instead of double-submitting/overwriting
  // an already-finalized answer or yanking the player back after they've moved on.
  const submissionTokenRef = useRef(0);

  const submitPhoto = useCallback(
    async (dataUrl: string): Promise<string | null> => {
      const lm = stops[idx];
      if (!lm) return null;
      const myToken = ++submissionTokenRef.current;
      const geoOutcome = await getGeoOrSimulate(lm);
      if (submissionTokenRef.current !== myToken) return null; // superseded — e.g. the player already skipped
      if (!geoOutcome.ok) {
        return geoOutcome.message;
      }
      const { distance, simulated, userGeo: shotGeo } = geoOutcome;
      return finalizeAnswer(dataUrl, distance, simulated, shotGeo);
    },
    [stops, idx, getGeoOrSimulate, finalizeAnswer]
  );

  // Lets the player give up on getting a GPS fix for the current photo and move on anyway,
  // using a simulated ("experience mode") distance — the escape hatch for when location truly
  // can't be obtained (permission denied at the OS level, no signal indoors, desktop testing, …)
  // so a failed fix never leaves them stuck retaking the same photo forever.
  const skipGeoAndSubmit = useCallback(
    async (dataUrl: string): Promise<string | null> => {
      submissionTokenRef.current++; // invalidate any still-pending submitPhoto() for this photo
      // Explicitly giving up on GPS and skipping is worth 0 points — unlike the "device has no
      // geolocation support at all" experience-mode fallback (which still scores a simulated
      // distance), this is the player choosing not to verify their location, so it shouldn't be
      // possible to luck into a high score. The distance is still simulated purely for the
      // "体験モード" flavor text/estimate shown on the reveal screen.
      return finalizeAnswer(dataUrl, simulateDistance(), true, null, 0);
    },
    [finalizeAnswer]
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
    heading,
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
    blackoutByStop,
    idx,
    setIdx,
    results,
    revealIdx,
    revealFinal,
    isStopAnswered,
    depart,
    goToSetup,
    submitPhoto,
    skipGeoAndSubmit,
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
