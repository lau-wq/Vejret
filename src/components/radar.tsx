import { useEffect, useState } from 'react'

// Nedbørsradar over Danmark/Sydskandinavien (fast udsnit, uafhængig af søgt by).
// Data: RainViewer (frit, ingen nøgle) — ca. 1 time tilbage i 10-min trin og
// ~30 min fremskrivning. Baggrundskort: CARTO dark (OpenStreetMap-data).
// 2×2 kortfliser, zoom 6: ca. 5,6–16,9°Ø / 52,5–58,6°N.

const Z = 6
const FLISER = [
  { x: 33, y: 19 },
  { x: 34, y: 19 },
  { x: 33, y: 20 },
  { x: 34, y: 20 },
]

interface Frame {
  time: number
  path: string
}

function flisePos(i: number): React.CSSProperties {
  return {
    left: `${(i % 2) * 50}%`,
    top: `${Math.floor(i / 2) * 50}%`,
  }
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

  const frame = frames[valgt]
  const relativMin = Math.round((frame.time - frames[nuIndeks].time) / 60)
  const tidLabel =
    valgt === nuIndeks
      ? `nu · ${formatTid(frame.time)}`
      : `${relativMin > 0 ? '+' : ''}${relativMin} min · ${formatTid(frame.time)}`

  return (
    <div>
      <div className="radar-billede">
        {FLISER.map((f, i) => (
          <img
            key={`kort-${i}`}
            className="radar-flise"
            style={flisePos(i)}
            src={`https://a.basemaps.cartocdn.com/dark_all/${Z}/${f.x}/${f.y}.png`}
            alt=""
            draggable={false}
          />
        ))}
        {/* Alle frames rendres stablet, så browseren preloader dem — kun den
            valgte er synlig, og skift er øjeblikkeligt. */}
        {frames.map((fr, fi) =>
          FLISER.map((f, i) => (
            <img
              key={`${fr.path}-${i}`}
              className="radar-flise radar-ekko"
              style={{ ...flisePos(i), visibility: fi === valgt ? 'visible' : 'hidden' }}
              src={`${host}${fr.path}/256/${Z}/${f.x}/${f.y}/2/1_1.png`}
              alt=""
              draggable={false}
            />
          )),
        )}
        <span className="radar-tid">{tidLabel}</span>
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
