import { useEffect, useRef, useState } from 'react'
import {
  MODELLER,
  beskrivVejr,
  hentModelVejr,
  hentSamletPrognose,
  hentStednavn,
  hentYrSandsynlighed,
  soegSted,
  type Model,
  type ModelVejr,
  type Sted,
} from './api/weather.ts'
import {
  IkonRaekker,
  KombiGraf,
  LinjeGraf,
  UvGraf,
  VindGraf,
  type Serie,
  type VindSerie,
} from './components/grafer.tsx'
import { Vejrikon } from './components/ikoner.tsx'
import { RadarKort } from './components/radar.tsx'

const STANDARD_STED: Sted = {
  id: 2618425,
  name: 'København',
  latitude: 55.6759,
  longitude: 12.5655,
  country: 'Danmark',
}

// Seriefarver (validerede mod den mørke flade): DMI = blå, YR = grøn.
const FARVER: Record<Model, string> = {
  dmi_seamless: '#3987e5',
  metno_seamless: '#199e70',
}
const FARVE_SANDSYNLIGHED = '#9085e9'

const UGEDAGE = ['Søndag', 'Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag']
const TIMER_I_GRAF = 48

interface Datasæt {
  dmi: ModelVejr | null
  yr: ModelVejr | null
  sandsynlighed: {
    time: string[]
    precipitation_probability: (number | null)[]
    uv_index: (number | null)[]
    utc_offset_seconds: number
  } | null
  yrSandsynlighed: Map<number, number> | null
}

function stedLabel(sted: Sted): string {
  const dele = [sted.name]
  if (sted.admin1 && sted.admin1 !== sted.name) dele.push(sted.admin1)
  if (sted.country) dele.push(sted.country)
  return dele.join(', ')
}

function nuIndex(hourly: { time: string[] }): number {
  const nu = new Date()
  const i = hourly.time.findIndex((t) => new Date(t) > nu)
  return Math.max(0, i === -1 ? hourly.time.length - 1 : i - 1)
}

function udsnit<T>(arr: T[] | undefined, fra: number, antal: number): T[] {
  return (arr ?? []).slice(fra, fra + antal)
}

function fmt(v: number | null | undefined, decimaler = 0): string {
  return v == null ? '–' : v.toFixed(decimaler).replace('.', ',')
}

export default function App() {
  const [sted, setSted] = useState<Sted>(STANDARD_STED)
  const [data, setData] = useState<Datasæt | null>(null)
  const [fejl, setFejl] = useState<string | null>(null)
  const [henter, setHenter] = useState(true)

  const [soegetekst, setSoegetekst] = useState('')
  const [forslag, setForslag] = useState<Sted[]>([])
  const soegRef = useRef<number | undefined>(undefined)
  const harValgtManuelt = useRef(false)

  // Brug brugerens egen position som startby, hvis browseren giver lov.
  // Appen starter på København med det samme og skifter, når svaret kommer —
  // medmindre brugeren i mellemtiden selv har valgt en by.
  useEffect(() => {
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (harValgtManuelt.current) return
        const { latitude, longitude } = pos.coords
        setSted({ id: -1, name: 'Din placering', latitude, longitude })
        // Slå det faktiske stednavn op og opdater kun navnet (samme koordinater).
        hentStednavn(latitude, longitude)
          .then((navn) => {
            if (!navn || harValgtManuelt.current) return
            setSted((s) => (s.id === -1 ? { ...s, name: navn } : s))
          })
          .catch(() => {})
      },
      () => {}, // afvist/fejl → bliv på København
      { timeout: 8000, maximumAge: 600000 },
    )
  }, [])

  useEffect(() => {
    let annulleret = false
    setHenter(true)
    setFejl(null)
    Promise.allSettled([
      hentModelVejr(sted.latitude, sted.longitude, 'dmi_seamless'),
      hentModelVejr(sted.latitude, sted.longitude, 'metno_seamless'),
      hentSamletPrognose(sted.latitude, sted.longitude),
      hentYrSandsynlighed(sted.latitude, sted.longitude),
    ]).then(([dmi, yr, ps, yrPs]) => {
      if (annulleret) return
      const næste: Datasæt = {
        dmi: dmi.status === 'fulfilled' ? dmi.value : null,
        yr: yr.status === 'fulfilled' ? yr.value : null,
        sandsynlighed: ps.status === 'fulfilled' ? ps.value : null,
        yrSandsynlighed: yrPs.status === 'fulfilled' ? yrPs.value : null,
      }
      if (!næste.dmi && !næste.yr) {
        setFejl('Kunne ikke hente vejrdata. Tjek din internetforbindelse og prøv igen.')
      } else {
        setData(næste)
      }
      setHenter(false)
    })
    return () => {
      annulleret = true
    }
    // Kun nye koordinater skal genhente data — et rent navneskift skal ikke.
  }, [sted.latitude, sted.longitude])

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
    harValgtManuelt.current = true
    setSted(nyt)
    setSoegetekst('')
    setForslag([])
  }

  const modeller = data
    ? MODELLER.map((m) => ({
        ...m,
        vejr: m.id === 'dmi_seamless' ? data.dmi : data.yr,
        farve: FARVER[m.id],
      })).filter((m) => m.vejr)
    : []

  const reference = modeller[0]?.vejr ?? null
  const fra = reference ? nuIndex(reference.hourly) : 0
  const tider = reference ? udsnit(reference.hourly.time, fra, TIMER_I_GRAF) : []

  const tempSerier: Serie[] = modeller.map((m) => ({
    navn: m.kort,
    farve: m.farve,
    vaerdier: udsnit(m.vejr!.hourly.temperature_2m, fra, TIMER_I_GRAF),
  }))
  const vindSerier: VindSerie[] = modeller.map((m) => ({
    navn: m.kort,
    farve: m.farve,
    hastighed: udsnit(m.vejr!.hourly.wind_speed_10m, fra, TIMER_I_GRAF),
    stoed: udsnit(m.vejr!.hourly.wind_gusts_10m, fra, TIMER_I_GRAF),
    retning: udsnit(m.vejr!.hourly.wind_direction_10m, fra, TIMER_I_GRAF),
  }))
  const nedboerSerier: Serie[] = modeller.map((m) => ({
    navn: `${m.kort} mm`,
    farve: m.farve,
    enhed: 'mm',
    decimaler: 1,
    vaerdier: udsnit(m.vejr!.hourly.precipitation, fra, TIMER_I_GRAF),
  }))

  // Sandsynlighedslinjerne mappes til modellernes tidslinje via epoch:
  // Open-Meteos tider er lokale for stedet, MET Norges er UTC.
  const psSerie: Serie[] = []
  if (data?.sandsynlighed) {
    const offset = data.sandsynlighed.utc_offset_seconds * 1000
    const epoch = (lokal: string) => Date.parse(lokal + 'Z') - offset
    if (data.yrSandsynlighed) {
      psSerie.push({
        navn: 'YR %',
        farve: FARVER.metno_seamless,
        enhed: '%',
        decimaler: 0,
        vaerdier: tider.map((t) => data.yrSandsynlighed!.get(epoch(t)) ?? null),
      })
    }
    const ensembleKort = new Map(
      data.sandsynlighed.time.map((t, i) => [
        epoch(t),
        data.sandsynlighed!.precipitation_probability[i],
      ]),
    )
    psSerie.push({
      navn: 'Ensemble %',
      farve: FARVE_SANDSYNLIGHED,
      enhed: '%',
      decimaler: 0,
      vaerdier: tider.map((t) => ensembleKort.get(epoch(t)) ?? null),
    })
  }

  // UV for dagens døgn (stedets lokale dato, som API'et leverer direkte).
  let uvIDag: (number | null)[] = []
  let uvNuTime = 0
  if (data?.sandsynlighed && reference) {
    const dagensDato = reference.hourly.time[fra]?.slice(0, 10)
    uvIDag = Array.from({ length: 24 }, (_, t) => {
      const i = data.sandsynlighed!.time.indexOf(
        `${dagensDato}T${String(t).padStart(2, '0')}:00`,
      )
      return i === -1 ? null : data.sandsynlighed!.uv_index[i]
    })
    const nuIso = reference.hourly.time[fra]
    uvNuTime = Number(nuIso.slice(11, 13)) + new Date().getMinutes() / 60
  }

  return (
    <div className="app">
      <header>
        <span className="logo">VEJRET</span>
        <div className="soeg">
          <input
            type="search"
            placeholder="Søg by"
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
      {henter && !data && <p className="status">Henter vejrdata …</p>}

      {reference && (
        <main className={henter ? 'daempet' : ''}>
          <div className="sted">
            {sted.id === -1 && (
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                role="img"
                aria-label="Din placering"
              >
                <path d="M12 21 C12 21 5 14.6 5 9.8 A7 7 0 0 1 19 9.8 C19 14.6 12 21 12 21 Z" />
                <circle cx="12" cy="9.8" r="2.4" />
              </svg>
            )}
            {stedLabel(sted)}
          </div>

          <section className="nu">
            {modeller.map((m) => {
              const h = m.vejr!.hourly
              return (
                <article className="nu-kort" key={m.id}>
                  <div className="kilde">
                    <span className="kilde-noegle" style={{ background: m.farve }} />
                    {m.kort}
                  </div>
                  <div className="nu-temp">{fmt(h.temperature_2m[fra])}°</div>
                  <div className="foeles">
                    Føles som <strong>{fmt(h.apparent_temperature[fra])}°</strong>
                  </div>
                  <div className="nu-vejr">
                    <Vejrikon code={h.weather_code[fra]} stoerrelse={22} />
                    {beskrivVejr(h.weather_code[fra])}
                  </div>
                  <div className="nu-vind">
                    Vind <strong>{fmt(h.wind_speed_10m[fra])} m/s</strong>
                  </div>
                </article>
              )
            })}
          </section>

          {modeller.length === 1 && (
            <p className="note">
              {modeller[0].id === 'dmi_seamless'
                ? 'YR/MET Norges model dækker kun Norden — kun DMI vises for dette sted.'
                : 'DMI’s model dækker ikke dette sted — kun YR vises.'}
            </p>
          )}

          <section className="kort">
            <h2>Temperatur · næste 48 timer · °C</h2>
            <LinjeGraf serier={tempSerier} tider={tider} enhed="°C" />
            <IkonRaekker
              raekker={modeller.map((m) => ({
                navn: m.kort,
                farve: m.farve,
                koder: udsnit(m.vejr!.hourly.weather_code, fra, TIMER_I_GRAF),
              }))}
            />
          </section>

          <section className="kort">
            <h2>Vind · næste 48 timer · m/s</h2>
            <VindGraf vind={vindSerier} tider={tider} />
            <p className="fodnote">
              Bånd = op til vindstød. Pile under aksen = vindens retning (hvorhen den blæser).
            </p>
          </section>

          {uvIDag.some((v) => v != null) && (
            <section className="kort">
              <h2>UV-indeks · i dag</h2>
              <UvGraf vaerdier={uvIDag} nuTime={uvNuTime} />
              <p className="fodnote">
                Farven på kurven viser niveauet nu og resten af dagen — fra gul (UV 3) bør du
                bruge solcreme. Grå = tid, der er gået. Prikken markerer nu. Kilde: samlet
                prognose.
              </p>
            </section>
          )}

          <section className="kort">
            <h2>Nedbør og sandsynlighed · næste 48 timer · mm / %</h2>
            <KombiGraf soejler={nedboerSerier} linjer={psSerie} tider={tider} />
            <p className="fodnote">
              Søjler = nedbør i mm (venstre akse). Linjer = sandsynlighed i % (højre akse).
              YR % = MET Norges officielle sandsynlighed; Ensemble % = samlet international
              prognose. DMI udgiver ikke sandsynligheder uden API-nøgle.
            </p>
          </section>

          <section className="kort">
            <h2>Radar · Danmark</h2>
            <RadarKort />
            <p className="fodnote">
              Radar: RainViewer · Kort: © OpenStreetMap · CARTO. Fremskrivningen rækker
              ~30 min; radaren dækker altid Danmark, uanset valgt by.
            </p>
          </section>

          <details className="tabelvisning">
            <summary>7 døgn · maks / min °C · nedbør mm</summary>
            <table className="uge">
              <thead>
                <tr>
                  <th>Dag</th>
                  {modeller.map((m) => (
                    <th key={m.id}>
                      <span className="kilde-noegle" style={{ background: m.farve }} />
                      {m.kort} °C
                    </th>
                  ))}
                  {modeller.map((m) => (
                    <th key={m.id + '-mm'}>{m.kort} mm</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reference.daily.time.map((dato, i) => (
                  <tr key={dato}>
                    <td>
                      {i === 0 ? 'I dag' : UGEDAGE[new Date(dato + 'T00:00:00').getDay()]}
                    </td>
                    {modeller.map((m) => (
                      <td key={m.id}>
                        <strong>{fmt(m.vejr!.daily.temperature_2m_max[i])}</strong>
                        {' / '}
                        {fmt(m.vejr!.daily.temperature_2m_min[i])}
                      </td>
                    ))}
                    {modeller.map((m) => (
                      <td key={m.id + '-mm'}>{fmt(m.vejr!.daily.precipitation_sum[i], 1)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

        </main>
      )}

      <footer>
        Prognoser: DMI Harmonie og MET Norge (YR) via Open-Meteo.com
      </footer>
    </div>
  )
}
