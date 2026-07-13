// Klient til Open-Meteo's gratis API (ingen API-nøgle). Vejrdata hentes fra to
// nationale vejrmodeller, så de kan sammenlignes:
//   - dmi_seamless:   DMI's Harmonie-model (Danmark)
//   - metno_seamless: MET Norges model, som driver YR (Norge/Norden)

export type Model = 'dmi_seamless' | 'metno_seamless'

export const MODELLER: { id: Model; navn: string; kort: string }[] = [
  { id: 'dmi_seamless', navn: 'DMI · Harmonie', kort: 'DMI' },
  { id: 'metno_seamless', navn: 'YR · MET Norge', kort: 'YR' },
]

export interface Sted {
  id: number
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

export interface ModelVejr {
  hourly: {
    time: string[]
    temperature_2m: (number | null)[]
    precipitation: (number | null)[]
    weather_code: (number | null)[]
    wind_speed_10m: (number | null)[]
    relative_humidity_2m: (number | null)[]
  }
  daily: {
    time: string[]
    weather_code: (number | null)[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
  }
}

export async function soegSted(navn: string): Promise<Sted[]> {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', navn)
  url.searchParams.set('count', '6')
  url.searchParams.set('language', 'da')
  url.searchParams.set('format', 'json')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kunne ikke søge efter byer')
  const data = await res.json()
  return data.results ?? []
}

export async function hentModelVejr(
  latitude: number,
  longitude: number,
  model: Model,
): Promise<ModelVejr> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('models', model)
  url.searchParams.set(
    'hourly',
    'temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m',
  )
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
  )
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Kunne ikke hente data for ${model}`)
  return res.json()
}

// Ensemble-sandsynlighed for nedbør fra den samlede prognose (best_match).
// De nationale modeller hos Open-Meteo har ikke egne sandsynligheder — de
// falder alle tilbage til denne fælles beregning.
export async function hentNedboersSandsynlighed(
  latitude: number,
  longitude: number,
): Promise<{
  time: string[]
  precipitation_probability: (number | null)[]
  utc_offset_seconds: number
}> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set('hourly', 'precipitation_probability')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '3')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kunne ikke hente nedbørssandsynlighed')
  const data = await res.json()
  return { ...data.hourly, utc_offset_seconds: data.utc_offset_seconds }
}

// Ægte YR-sandsynlighed for nedbør fra MET Norges officielle API.
// (DMI udgiver ikke sandsynligheder uden registrering og API-nøgle.)
// Returnerer et opslag fra epoch-millisekunder til procent.
export async function hentYrSandsynlighed(
  latitude: number,
  longitude: number,
): Promise<Map<number, number>> {
  const url = new URL('https://api.met.no/weatherapi/locationforecast/2.0/complete')
  url.searchParams.set('lat', latitude.toFixed(4))
  url.searchParams.set('lon', longitude.toFixed(4))
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kunne ikke hente data fra MET Norge')
  const data = await res.json()
  const kort = new Map<number, number>()
  for (const punkt of data.properties?.timeseries ?? []) {
    const detaljer =
      punkt.data?.next_1_hours?.details ?? punkt.data?.next_6_hours?.details ?? null
    const p = detaljer?.probability_of_precipitation
    if (typeof p === 'number') kort.set(Date.parse(punkt.time), p)
  }
  return kort
}

// WMO-vejrkoder oversat til dansk.
const VEJRKODER: Record<number, string> = {
  0: 'Klart',
  1: 'Mest klart',
  2: 'Delvist skyet',
  3: 'Overskyet',
  45: 'Tåge',
  48: 'Rimtåge',
  51: 'Let støvregn',
  53: 'Støvregn',
  55: 'Kraftig støvregn',
  56: 'Let isslag',
  57: 'Isslag',
  61: 'Let regn',
  63: 'Regn',
  65: 'Kraftig regn',
  66: 'Let isregn',
  67: 'Isregn',
  71: 'Let sne',
  73: 'Sne',
  75: 'Kraftig sne',
  77: 'Snekorn',
  80: 'Lette byger',
  81: 'Byger',
  82: 'Kraftige byger',
  85: 'Snebyger',
  86: 'Kraftige snebyger',
  95: 'Torden',
  96: 'Torden, hagl',
  99: 'Kraftig torden, hagl',
}

export function beskrivVejr(code: number | null | undefined): string {
  return code == null ? '–' : (VEJRKODER[code] ?? 'Ukendt')
}
