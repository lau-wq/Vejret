import { beskrivVejr } from '../api/weather.ts'

// Minimale stroke-SVG-vejrikoner i appens stramme stil (aldrig emoji).
// Alle glyffer tegnes i currentColor med 1.6px streg.

type Glyf =
  | 'sol'
  | 'solsky'
  | 'skyet'
  | 'taage'
  | 'stoevregn'
  | 'regn'
  | 'sne'
  | 'torden'

function glyfForKode(code: number | null | undefined): Glyf {
  if (code == null) return 'skyet'
  if (code === 0) return 'sol'
  if (code === 1 || code === 2) return 'solsky'
  if (code === 3) return 'skyet'
  if (code === 45 || code === 48) return 'taage'
  if (code >= 51 && code <= 57) return 'stoevregn'
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'regn'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'sne'
  if (code >= 95) return 'torden'
  return 'skyet'
}

const SKY = 'M7 17 a4 4 0 1 1 .6-7.96 A5 5 0 0 1 17.4 10 A3.5 3.5 0 0 1 17 17 Z'
const LILLE_SKY = 'M5.5 19 a3.5 3.5 0 1 1 .5-6.96 A4.4 4.4 0 0 1 14.6 13 A3 3 0 0 1 14.3 19 Z'
const LILLE_SOL =
  'M17 5 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M17 .8 v1.2 M17 8 v1.2 ' +
  'M12.8 5 h1.2 M20 5 h1.2 M14 2 l.85.85 M19.15 7.15 l.85.85 M20 2 l-.85.85 M14.85 7.15 l-.85.85'

const GLYFFER: Record<Glyf, React.ReactNode> = {
  sol: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19" />
    </>
  ),
  solsky: (
    <>
      <path d={LILLE_SOL} />
      <path d={LILLE_SKY} />
    </>
  ),
  skyet: <path d={SKY} />,
  taage: <path d="M4 10 h13 M6 13.5 h13 M4 17 h13" />,
  stoevregn: (
    <>
      <path d={SKY} />
      <path d="M9 19.5 v.1 M13 19.5 v.1 M11 21.5 v.1" />
    </>
  ),
  regn: (
    <>
      <path d={SKY} />
      <path d="M9 19 l-.8 2.2 M12.5 19 l-.8 2.2 M16 19 l-.8 2.2" />
    </>
  ),
  sne: (
    <>
      <path d={SKY} />
      <path d="M9.5 19.4 l0 2 M8.6 20.4 l1.8 0 M14.5 19.4 l0 2 M13.6 20.4 l1.8 0" />
    </>
  ),
  torden: (
    <>
      <path d={SKY} />
      <path d="M12.5 18 l-2 3 h2.4 l-1.6 2.6" />
    </>
  ),
}

export function Vejrikon({
  code,
  stoerrelse = 18,
}: {
  code: number | null | undefined
  stoerrelse?: number
}) {
  return (
    <svg
      width={stoerrelse}
      height={stoerrelse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={beskrivVejr(code)}
    >
      {GLYFFER[glyfForKode(code)]}
    </svg>
  )
}
