import { useEffect, useRef, useState } from 'react'
import { useBredde } from './grafer.tsx'

// Nedbørsradar (fast centreret på Danmark, uafhængig af søgt by) med zoom og
// panorering. Data: RainViewer (frit, ingen nøgle) — ca. 1 time tilbage i
// 10-min trin og ~30 min fremskrivning (nowcast kan være tom).
// Baggrundskort: CARTO dark (OpenStreetMap-data).

const START_CENTER = { lat: 56.0, lon: 11.5 } // Danmarks midte
const START_ZOOM = 7
const MIN_ZOOM = 5
const MAX_ZOOM = 9
const GRAENSER = { minLat: 50, maxLat: 62, minLon: 0, maxLon: 22 }
const FLISE = 256

interface Frame {
  time: number
  path: string
}

// Web-Mercator: længde/bredde ↔ "verdens-pixels" ved givet zoom.
function verdensPx(zoom: number): number {
  return FLISE * 2 ** zoom
}

function lonTilPx(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * verdensPx(zoom)
}

function latTilPx(lat: number, zoom: number): number {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * verdensPx(zoom)
}

function pxTilLon(px: number, zoom: number): number {
  return (px / verdensPx(zoom)) * 360 - 180
}

function pxTilLat(py: number, zoom: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / verdensPx(zoom)))) * 180) / Math.PI
}

function klem(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

function formatTid(unix: number): string {
  const d = new Date(unix * 1000)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

export function RadarKort() {
  const [host, setHost] = useState('')
  const [frames, setFrames] = useState<Frame[]>([])
  const [nuIndeks, setNuIndeks] = useState(0)
  const [valgt, setValgt] = useState(0)
  const [fejl, setFejl] = useState(false)
  const [afspiller, setAfspiller] = useState(false)
  const [zoom, setZoom] = useState(START_ZOOM)
  const [center, setCenter] = useState(START_CENTER)
  const [kortRef, kortBredde] = useBredde()
  const traek = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    let annulleret = false
    fetch('https://api.rainviewer.com/public/weather-maps.json')
      .then((r) => r.json())
      .then((d) => {
        if (annulleret) return
        const past: Frame[] = (d.radar?.past ?? []).slice(-7) // ca. 60 min
        const nowcast: Frame[] = d.radar?.nowcast ?? []
        if (!past.length) throw new Error('ingen frames')
        setHost(d.host)
        setFrames([...past, ...nowcast])
        setNuIndeks(past.length - 1)
        setValgt(past.length - 1)
      })
      .catch(() => {
        if (!annulleret) setFejl(true)
      })
    return () => {
      annulleret = true
    }
  }, [])

  useEffect(() => {
    if (!afspiller || frames.length === 0) return
    const id = window.setInterval(() => setValgt((v) => (v + 1) % frames.length), 600)
    return () => window.clearInterval(id)
  }, [afspiller, frames.length])

  if (fejl) return <p className="fodnote">Radar utilgængelig lige nu.</p>
  if (frames.length === 0) return <p className="fodnote">Henter radar …</p>

  // Synlige fliser ud fra centrum, zoom og kortets (kvadratiske) størrelse.
  const stoerrelse = Math.min(kortBredde || 480, 480)
  const topVenstreX = lonTilPx(center.lon, zoom) - stoerrelse / 2
  const topVenstreY = latTilPx(center.lat, zoom) - stoerrelse / 2
  const maxFlise = 2 ** zoom - 1
  const fliser: { x: number; y: number; left: number; top: number }[] = []
  for (
    let tx = Math.floor(topVenstreX / FLISE);
    tx * FLISE < topVenstreX + stoerrelse;
    tx++
  ) {
    for (
      let ty = Math.floor(topVenstreY / FLISE);
      ty * FLISE < topVenstreY + stoerrelse;
      ty++
    ) {
      if (tx < 0 || ty < 0 || tx > maxFlise || ty > maxFlise) continue
      fliser.push({ x: tx, y: ty, left: tx * FLISE - topVenstreX, top: ty * FLISE - topVenstreY })
    }
  }

  function flyt(dx: number, dy: number) {
    setCenter((c) => ({
      lat: klem(pxTilLat(latTilPx(c.lat, zoom) - dy, zoom), GRAENSER.minLat, GRAENSER.maxLat),
      lon: klem(pxTilLon(lonTilPx(c.lon, zoom) - dx, zoom), GRAENSER.minLon, GRAENSER.maxLon),
    }))
  }

  const frame = frames[valgt]
  const relativMin = Math.round((frame.time - frames[nuIndeks].time) / 60)
  const tidLabel =
    valgt === nuIndeks
      ? `nu · ${formatTid(frame.time)}`
      : `${relativMin > 0 ? '+' : ''}${relativMin} min · ${formatTid(frame.time)}`

  return (
    <div>
      <div
        className="radar-billede"
        ref={kortRef}
        onPointerDown={(e) => {
          traek.current = { x: e.clientX, y: e.clientY }
          e.currentTarget.setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!traek.current) return
          flyt(e.clientX - traek.current.x, e.clientY - traek.current.y)
          traek.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={(e) => {
          traek.current = null
          e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => {
          traek.current = null
        }}
      >
        {fliser.map((f) => (
          <img
            key={`kort-${zoom}-${f.x}-${f.y}`}
            className="radar-flise"
            style={{ left: f.left, top: f.top }}
            src={`https://a.basemaps.cartocdn.com/dark_all/${zoom}/${f.x}/${f.y}.png`}
            alt=""
            draggable={false}
          />
        ))}
        {/* Alle frames rendres stablet (kun synlige fliser), så browseren
            preloader dem — kun den valgte frame er synlig. */}
        {frames.map((fr, fi) =>
          fliser.map((f) => (
            <img
              key={`${fr.path}-${zoom}-${f.x}-${f.y}`}
              className="radar-flise radar-ekko"
              style={{ left: f.left, top: f.top, visibility: fi === valgt ? 'visible' : 'hidden' }}
              src={`${host}${fr.path}/256/${zoom}/${f.x}/${f.y}/2/1_1.png`}
              alt=""
              draggable={false}
            />
          )),
        )}
        <span className="radar-tid">{tidLabel}</span>
        <div className="radar-zoomknapper" onPointerDown={(e) => e.stopPropagation()}>
          <button
            className="afspil"
            onClick={() => setZoom((z) => klem(z + 1, MIN_ZOOM, MAX_ZOOM))}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom ind"
          >
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M6 1.5 v9 M1.5 6 h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
          <button
            className="afspil"
            onClick={() => setZoom((z) => klem(z - 1, MIN_ZOOM, MAX_ZOOM))}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom ud"
          >
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M1.5 6 h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
      <div className="radar-kontrol">
        <button
          className="afspil"
          onClick={() => setAfspiller(!afspiller)}
          aria-label={afspiller ? 'Pause' : 'Afspil'}
        >
          {afspiller ? (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M2.5 1.5 h2.4 v9 h-2.4 Z M7.1 1.5 h2.4 v9 h-2.4 Z" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="12" height="12">
              <path d="M2.5 1.5 L10.5 6 L2.5 10.5 Z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="slider-wrap">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={valgt}
            onChange={(e) => {
              setAfspiller(false)
              setValgt(Number(e.target.value))
            }}
            aria-label="Radar-tidspunkt"
          />
          <div className="slider-labels">
            <span>{Math.round((frames[0].time - frames[nuIndeks].time) / 60)} min</span>
            {nuIndeks > 0 && nuIndeks < frames.length - 1 && (
              <span
                className="nu"
                style={{
                  position: 'absolute',
                  left: `${(nuIndeks / (frames.length - 1)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                nu
              </span>
            )}
            <span>
              {nuIndeks === frames.length - 1
                ? 'nu'
                : `+${Math.round((frames[frames.length - 1].time - frames[nuIndeks].time) / 60)} min`}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
