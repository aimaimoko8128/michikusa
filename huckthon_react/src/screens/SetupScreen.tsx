import { useState } from 'react';
import { useGame } from '../state/useGame';
import { RouteMap } from '../components/RouteMap';
import { fmtDist } from '../lib/geo';

export function SetupScreen() {
  const {
    destination,
    destStatus,
    destSuggestions,
    destChips,
    selectDestination,
    selectDestinationFromMap,
    geocodeDestination,
    route,
    routeOrigin,
    destCoord,
    userGeo,
    stopsCountChoice,
    setStopsCountChoice,
    depart,
  } = useGame();

  const [inputValue, setInputValue] = useState(destination?.name ?? '');

  const runSearch = (q: string) => {
    setInputValue(q);
    void geocodeDestination(q);
  };

  return (
    <section className="screen active" id="screen-setup">
      <p className="eyebrow">旅のしたく</p>
      <h2 className="heading">目的地を決めよう</h2>
      <p className="subheading">現在地は自動で取得します。行き先を決めれば、すぐに出発できます。</p>
      <div className="card setup-card">
        <div className="field">
          <label>目的地</label>
          <div className="geo-row">
            <input
              type="text"
              placeholder="行き先を入力（例: 二条城、清水寺、嵐山 など）"
              autoComplete="off"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch(inputValue.trim());
                }
              }}
            />
            <button className="btn ghost small" type="button" onClick={() => runSearch(inputValue.trim())}>
              検索
            </button>
          </div>
          <div className="dest-chips">
            {destChips.map((name) => (
              <button key={name} type="button" className="chip" onClick={() => runSearch(name)}>
                {name}
              </button>
            ))}
          </div>
          <p className="dest-status">{destStatus}</p>
          {destSuggestions.length > 0 && (
            <ul className="dest-suggestions">
              <li className="dest-suggestion-note">現在地に近い順に表示しています。違う場所の場合はこちらから選び直してください:</li>
              {destSuggestions.map((item, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className="dest-suggestion-btn"
                    onClick={() => {
                      selectDestination({ name: item.name || item.displayName, lat: item.lat, lng: item.lng });
                      setInputValue(item.name || item.displayName);
                    }}
                  >
                    {item.displayName}
                    {item.distance != null ? `（約${fmtDist(item.distance)}）` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="field">
          <label>写真の枚数</label>
          <select value={stopsCountChoice} onChange={(e) => setStopsCountChoice(Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}問
              </option>
            ))}
          </select>
        </div>
        <div className="route-map-wrap">
          <RouteMap
            className="route-map"
            origin={routeOrigin()}
            originKnown={!!userGeo}
            dest={destCoord()}
            route={route}
            onMapClick={(lat, lng) => void selectDestinationFromMap(lat, lng)}
          />
          <div className="map-legend">
            <span>
              <i className="dot dot-user" />現在地
            </span>
            <span>
              <i className="dot dot-target" />目的地
            </span>
          </div>
          <p className="map-click-hint">地図をクリックしても目的地を選べます</p>
        </div>
        <div className="field apikey-field">
          <p className="apikey-note">
            道中で探す写真には、実際のストリートビューのみを使用します。ストリートビューが見つからない地点は自動でスキップされます。
          </p>
        </div>
        <div className="setup-actions">
          <button className="btn" onClick={() => void depart()}>
            出発する →
          </button>
        </div>
      </div>
    </section>
  );
}
