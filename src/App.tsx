import { useEffect, useRef, useState } from 'react'
import { beskrivVejr, hentVejr, soegSted, type Sted, type Vejrdata } from './api/weather.ts'

const STANDARD_STED: Sted = {
  id: 2618425,
  name: 'København',
  latitude: 55.6759,
  longitude: 12.5655,
  country: 'Danmark',
}

const UGEDAGE = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

function formatDag(isoDato: string, index: number): string {
  if (index === 0) return 'I dag'
  if (index === 1) return 'I morgen'
  const d = new Date(isoDato + 'T00:00:00')
  return UGEDAGE[d.getDay()].charAt(0).toUpperCase() + UGEDAGE[d.getDay()].slice(1)
}

function stedLabel(sted: Sted): string {
  const dele = [sted.name]
  if (sted.admin1 && sted.admin1 !== sted.name) dele.push(sted.admin1)
  if (sted.country) dele.push(sted.country)
  return dele.join(', ')
}

export default function App() {
  const [sted, setSted] = useState<Sted>(STANDARD_STED)
  const [vejr, setVejr] = useState<Vejrdata | null>(null)
  const [fejl, setFejl] = useState<string | null>(null)
  const [henter, setHenter] = useState(true)

  const [soegetekst, setSoegetekst] = useState('')
  const [forslag, setForslag] = useState<Sted[]>([])
  const soegRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let annulleret = false
    setHenter(true)
    setFejl(null)
    hentVejr(sted.latitude, sted.longitude)
      .then((data) => {
        if (!annulleret) setVejr(data)
      })
      .catch(() => {
        if (!annulleret) setFejl('Kunne ikke hente vejrdata. Tjek din internetforbindelse og prøv igen.')
      })
      .finally(() => {
        if (!annulleret) setHenter(false)
      })
    return () => {
      annulleret = true
    }
  }, [sted])

  function onSoeg(tekst: string) {
    setSoegetekst(tekst)
    window.clearTimeout(soegRef.current)
    if (tekst.trim().length < 2) {
      setForslag([])
      return
    }
    soegRef.current = window.setTimeout(() => {
      soegSted(tekst.trim())
        .then(setForslag)
        .catch(() => setForslag([]))
    }, 300)
  }

  function vaelgSted(nyt: Sted) {
    setSted(nyt)
    setSoegetekst('')
    setForslag([])
  }

  const nu = vejr ? beskrivVejr(vejr.current.weather_code) : null

  // De næste 12 timer fra nuværende tidspunkt.
  const timer = (() => {
    if (!vejr) return []
    const start = vejr.hourly.time.findIndex((t) => t >= vejr.current.time)
    const fra = start === -1 ? 0 : start
    return vejr.hourly.time.slice(fra, fra + 12).map((t, i) => ({
      tid: t.slice(11, 16),
      temp: Math.round(vejr.hourly.temperature_2m[fra + i]),
      ikon: beskrivVejr(vejr.hourly.weather_code[fra + i]).ikon,
      regn: vejr.hourly.precipitation_probability[fra + i],
    }))
  })()

  return (
    <div className="app">
      <header>
        <h1>Vejret</h1>
        <div className="soeg">
          <input
            type="search"
            placeholder="Søg efter en by …"
            value={soegetekst}
            onChange={(e) => onSoeg(e.target.value)}
            aria-label="Søg efter en by"
          />
          {forslag.length > 0 && (
            <ul className="forslag">
              {forslag.map((f) => (
                <li key={f.id}>
                  <button onClick={() => vaelgSted(f)}>{stedLabel(f)}</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      {fejl && <p className="fejl">{fejl}</p>}
      {henter && !vejr && <p className="status">Henter vejret …</p>}

      {vejr && nu && (
        <main className={henter ? 'dæmpet' : ''}>
          <section className="nu-kort">
            <h2>{stedLabel(sted)}</h2>
            <div className="nu-hoved">
              <span className="nu-ikon" role="img" aria-label={nu.tekst}>
                {nu.ikon}
              </span>
              <span className="nu-temp">{Math.round(vejr.current.temperature_2m)}°</span>
            </div>
            <p className="nu-tekst">{nu.tekst}</p>
            <dl className="nu-detaljer">
              <div>
                <dt>Føles som</dt>
                <dd>{Math.round(vejr.current.apparent_temperature)}°</dd>
              </div>
              <div>
                <dt>Vind</dt>
                <dd>{Math.round(vejr.current.wind_speed_10m)} m/s</dd>
              </div>
              <div>
                <dt>Luftfugtighed</dt>
                <dd>{vejr.current.relative_humidity_2m} %</dd>
              </div>
            </dl>
          </section>

          <section>
            <h3>De næste timer</h3>
            <div className="timer">
              {timer.map((t) => (
                <div className="time" key={t.tid}>
                  <span className="time-tid">{t.tid}</span>
                  <span className="time-ikon">{t.ikon}</span>
                  <span className="time-temp">{t.temp}°</span>
                  <span className="time-regn">💧 {t.regn}%</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3>7-dages prognose</h3>
            <ul className="dage">
              {vejr.daily.time.map((dato, i) => {
                const v = beskrivVejr(vejr.daily.weather_code[i])
                return (
                  <li className="dag" key={dato}>
                    <span className="dag-navn">{formatDag(dato, i)}</span>
                    <span className="dag-ikon" title={v.tekst}>
                      {v.ikon}
                    </span>
                    <span className="dag-regn">
                      {vejr.daily.precipitation_sum[i] > 0
                        ? `${vejr.daily.precipitation_sum[i].toFixed(1)} mm`
                        : ''}
                    </span>
                    <span className="dag-temp">
                      <strong>{Math.round(vejr.daily.temperature_2m_max[i])}°</strong> /{' '}
                      {Math.round(vejr.daily.temperature_2m_min[i])}°
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        </main>
      )}

      <footer>Vejrdata fra Open-Meteo.com</footer>
    </div>
  )
}
