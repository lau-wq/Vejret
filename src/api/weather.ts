// Klient til Open-Meteo's gratis vejr- og geokodnings-API (kræver ingen API-nøgle).

export interface Sted {
  id: number
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

export interface Vejrdata {
  current: {
    time: string
    temperature_2m: number
    apparent_temperature: number
    relative_humidity_2m: number
    wind_speed_10m: number
    weather_code: number
  }
  hourly: {
    time: string[]
    temperature_2m: number[]
    weather_code: number[]
    precipitation_probability: number[]
  }
  daily: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
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

export async function hentVejr(latitude: number, longitude: number): Promise<Vejrdata> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(latitude))
  url.searchParams.set('longitude', String(longitude))
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code',
  )
  url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability')
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
  )
  url.searchParams.set('wind_speed_unit', 'ms')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', '7')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Kunne ikke hente vejrdata')
  return res.json()
}

// WMO-vejrkoder oversat til dansk beskrivelse og ikon.
const VEJRKODER: Record<number, { tekst: string; ikon: string }> = {
  0: { tekst: 'Klar himmel', ikon: '☀️' },
  1: { tekst: 'Overvejende klart', ikon: '🌤️' },
  2: { tekst: 'Delvist skyet', ikon: '⛅' },
  3: { tekst: 'Overskyet', ikon: '☁️' },
  45: { tekst: 'Tåge', ikon: '🌫️' },
  48: { tekst: 'Rimtåge', ikon: '🌫️' },
  51: { tekst: 'Let støvregn', ikon: '🌦️' },
  53: { tekst: 'Støvregn', ikon: '🌦️' },
  55: { tekst: 'Kraftig støvregn', ikon: '🌧️' },
  56: { tekst: 'Let isslag', ikon: '🌧️' },
  57: { tekst: 'Isslag', ikon: '🌧️' },
  61: { tekst: 'Let regn', ikon: '🌦️' },
  63: { tekst: 'Regn', ikon: '🌧️' },
  65: { tekst: 'Kraftig regn', ikon: '🌧️' },
  66: { tekst: 'Let isregn', ikon: '🌧️' },
  67: { tekst: 'Isregn', ikon: '🌧️' },
  71: { tekst: 'Let sne', ikon: '🌨️' },
  73: { tekst: 'Sne', ikon: '🌨️' },
  75: { tekst: 'Kraftig sne', ikon: '❄️' },
  77: { tekst: 'Snekorn', ikon: '❄️' },
  80: { tekst: 'Lette byger', ikon: '🌦️' },
  81: { tekst: 'Byger', ikon: '🌧️' },
  82: { tekst: 'Kraftige byger', ikon: '⛈️' },
  85: { tekst: 'Snebyger', ikon: '🌨️' },
  86: { tekst: 'Kraftige snebyger', ikon: '❄️' },
  95: { tekst: 'Tordenvejr', ikon: '⛈️' },
  96: { tekst: 'Torden med hagl', ikon: '⛈️' },
  99: { tekst: 'Kraftig torden med hagl', ikon: '⛈️' },
}

export function beskrivVejr(code: number): { tekst: string; ikon: string } {
  return VEJRKODER[code] ?? { tekst: 'Ukendt', ikon: '❓' }
}
