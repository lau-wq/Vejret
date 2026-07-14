import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Vejrikon } from './ikoner.tsx'

// Fælles SVG-grafer: linjegraf (temperatur) og søjlegraf (nedbør m.m.).
// Farver og mål følger et fast sæt specifikationer: 2px linjer, hårfine
// gridlinjer, 2px "surface"-mellemrum mellem søjler og tooltip med alle serier.

export interface Serie {
  navn: string
  farve: string
  vaerdier: (number | null)[]
  enhed?: string // pr. serie (fx i KombiGraf); ellers bruges grafens enhed
  decimaler?: number
  mark?: 'linje' | 'soejle' // styrer legendens nøgleform
  skjulILegend?: boolean // fx stød-serier, der kun skal med i tooltip
}

export interface GrafProps {
  serier: Serie[]
  tider: string[] // ISO-timestamps, én pr. punkt
  enhed: string
  maxY?: number // fast loft, fx 100 til procent
  decimaler?: number
}

const MARGEN = { top: 8, hoejre: 8, bund: 22, venstre: 34 }
const HOEJDE = 200

const UGEDAGE_KORT = ['søn', 'man', 'tir', 'ons', 'tor', 'fre', 'lør']

export function useBredde(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [bredde, setBredde] = useState(600)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new ResizeObserver((es) => {
      const b = es[0]?.contentRect.width
      if (b) setBredde(b)
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, bredde]
}

function pæneTicks(min: number, max: number, antal = 4): number[] {
  const span = max - min || 1
  const raaTrin = span / antal
  const mag = 10 ** Math.floor(Math.log10(raaTrin))
  const trin = [1, 2, 2.5, 5, 10].map((t) => t * mag).find((t) => span / t <= antal) ?? mag * 10
  const start = Math.ceil(min / trin) * trin
  const ticks: number[] = []
  for (let v = start; v <= max + 1e-9; v += trin) ticks.push(Number(v.toFixed(6)))
  return ticks
}

function tidLabel(iso: string): { tekst: string; erMidnat: boolean } {
  const time = iso.slice(11, 13)
  if (time === '00') {
    const d = new Date(iso)
    return { tekst: UGEDAGE_KORT[d.getDay()], erMidnat: true }
  }
  return { tekst: time, erMidnat: false }
}

interface TooltipData {
  index: number
  x: number
}

function Tooltip({
  data,
  serier,
  tider,
  enhed,
  bredde,
  decimaler,
}: {
  data: TooltipData
  serier: Serie[]
  tider: string[]
  enhed: string
  bredde: number
  decimaler: number
}) {
  const iso = tider[data.index]
  const d = new Date(iso)
  const titel = `${UGEDAGE_KORT[d.getDay()]} kl. ${iso.slice(11, 16)}`
  const tilVenstre = data.x > bredde / 2
  return (
    <div
      className="graf-tooltip"
      style={tilVenstre ? { right: bredde - data.x + 10 } : { left: data.x + 10 }}
    >
      <div className="graf-tooltip-titel">{titel}</div>
      {serier.map((s) => {
        const v = s.vaerdier[data.index]
        return (
          <div className="graf-tooltip-raekke" key={s.navn}>
            <span className="graf-tooltip-noegle" style={{ background: s.farve }} />
            <span className="graf-tooltip-vaerdi">
              {v == null ? '–' : `${v.toFixed(s.decimaler ?? decimaler)} ${s.enhed ?? enhed}`}
            </span>
            <span className="graf-tooltip-navn">{s.navn}</span>
          </div>
        )
      })}
    </div>
  )
}

function GrafRamme({
  serier,
  tider,
  enhed,
  decimaler,
  children,
  tooltip,
  bredde,
  ref,
  onPointerMove,
  onPointerLeave,
  yTicks,
  yTilPx,
  visLegend,
  margenHoejre = MARGEN.hoejre,
  hoejde = HOEJDE,
  margenBund = MARGEN.bund,
}: {
  serier: Serie[]
  tider: string[]
  enhed: string
  decimaler: number
  children: React.ReactNode
  tooltip: TooltipData | null
  bredde: number
  ref: React.RefObject<HTMLDivElement | null>
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void
  onPointerLeave: () => void
  yTicks: number[]
  yTilPx: (v: number) => number
  visLegend: boolean
  margenHoejre?: number
  hoejde?: number
  margenBund?: number
}) {
  const plotBredde = bredde - MARGEN.venstre - margenHoejre
  return (
    <div className="graf" ref={ref}>
      {visLegend && (
        <div className="graf-legend">
          {serier.filter((s) => !s.skjulILegend).map((s) => (
            <span className="graf-legend-punkt" key={s.navn}>
              <span
                className={
                  s.mark === 'soejle' ? 'graf-legend-noegle soejle' : 'graf-legend-noegle'
                }
                style={{ background: s.farve }}
              />
              {s.navn}
            </span>
          ))}
        </div>
      )}
      <div className="graf-flade">
        <svg
          width={bredde}
          height={hoejde}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={MARGEN.venstre}
                x2={MARGEN.venstre + plotBredde}
                y1={yTilPx(t)}
                y2={yTilPx(t)}
                className="graf-grid"
              />
              <text x={MARGEN.venstre - 6} y={yTilPx(t) + 3} className="graf-akse" textAnchor="end">
                {t}
              </text>
            </g>
          ))}
          {tider.map((iso, i) => {
            const { tekst, erMidnat } = tidLabel(iso)
            if (i % 6 !== 0) return null
            const x = MARGEN.venstre + (plotBredde * (i + 0.5)) / tider.length
            return (
              <text
                key={iso}
                x={x}
                y={hoejde - margenBund + 16}
                className={erMidnat ? 'graf-akse graf-akse-dag' : 'graf-akse'}
                textAnchor="middle"
              >
                {tekst}
              </text>
            )
          })}
          {children}
          {tooltip && (
            <line
              x1={tooltip.x}
              x2={tooltip.x}
              y1={MARGEN.top}
              y2={hoejde - margenBund}
              className="graf-krydssigte"
            />
          )}
        </svg>
        {tooltip && (
          <Tooltip
            data={tooltip}
            serier={serier}
            tider={tider}
            enhed={enhed}
            bredde={bredde}
            decimaler={decimaler}
          />
        )}
      </div>
    </div>
  )
}

// Rækker af små vejrikoner, justeret til grafernes plotområde.
export interface IkonRaekke {
  navn: string
  farve: string
  koder: (number | null)[]
}

export function IkonRaekker({ raekker }: { raekker: IkonRaekke[] }) {
  const [ref, bredde] = useBredde()
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
  // Hver 3. time; på smalle skærme hver 6. så ikonerne ikke klumper.
  const trin = plotBredde / raekker[0].koder.length < 11 ? 6 : 3
  return (
    <div ref={ref}>
      {raekker.map((r) => (
        <div className="ikonraekke" key={r.navn}>
          <span className="ikonraekke-navn" style={{ width: MARGEN.venstre - 6 }}>
            {r.navn}
          </span>
          <span className="ikonraekke-ikoner" style={{ marginRight: MARGEN.hoejre }}>
            {r.koder.map((code, i) =>
              i % trin === 0 ? <Vejrikon key={i} code={code} stoerrelse={17} /> : null,
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

function brugTooltip(tider: string[], bredde: number, margenHoejre = MARGEN.hoejre) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const plotBredde = bredde - MARGEN.venstre - margenHoejre
  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - rect.left
    const index = Math.max(
      0,
      Math.min(tider.length - 1, Math.floor(((px - MARGEN.venstre) / plotBredde) * tider.length)),
    )
    const x = MARGEN.venstre + (plotBredde * (index + 0.5)) / tider.length
    setTooltip({ index, x })
  }
  return { tooltip, onPointerMove, onPointerLeave: () => setTooltip(null) }
}

export function LinjeGraf({ serier, tider, enhed, decimaler = 1 }: GrafProps) {
  const [ref, bredde] = useBredde()
  const { tooltip, onPointerMove, onPointerLeave } = brugTooltip(tider, bredde)

  const alle = serier.flatMap((s) => s.vaerdier).filter((v): v is number => v != null)
  const reelMin = alle.length ? Math.floor(Math.min(...alle)) - 1 : 0
  const reelMax = alle.length ? Math.ceil(Math.max(...alle)) + 1 : 1
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
  const plotHoejde = HOEJDE - MARGEN.top - MARGEN.bund
  const yTilPx = (v: number) =>
    MARGEN.top + plotHoejde - ((v - reelMin) / (reelMax - reelMin)) * plotHoejde
  const xTilPx = (i: number) => MARGEN.venstre + (plotBredde * (i + 0.5)) / tider.length
  const yTicks = pæneTicks(reelMin, reelMax)

  return (
    <GrafRamme
      serier={serier}
      tider={tider}
      enhed={enhed}
      decimaler={decimaler}
      tooltip={tooltip}
      bredde={bredde}
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      yTicks={yTicks}
      yTilPx={yTilPx}
      visLegend={serier.length > 1}
    >
      {serier.map((s) => (
        <path
          key={s.navn}
          d={linjeSti(s.vaerdier, xTilPx, yTilPx)}
          fill="none"
          stroke={s.farve}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {tooltip &&
        serier.map((s) => {
          const v = s.vaerdier[tooltip.index]
          if (v == null) return null
          return (
            <circle
              key={s.navn}
              cx={xTilPx(tooltip.index)}
              cy={yTilPx(v)}
              r={4}
              fill={s.farve}
              className="graf-punkt"
            />
          )
        })}
    </GrafRamme>
  )
}

// Tegner en linje med "pen op" ved manglende værdier.
function linjeSti(
  vaerdier: (number | null)[],
  xTilPx: (i: number) => number,
  yTilPx: (v: number) => number,
): string {
  let sti = ''
  let penNede = false
  vaerdier.forEach((v, i) => {
    if (v == null) {
      penNede = false
      return
    }
    sti += `${penNede ? 'L' : 'M'}${xTilPx(i)},${yTilPx(v)} `
    penNede = true
  })
  return sti.trim()
}

// Søjle med 4px afrundet datatop og skarp bund.
function soejleSti(x: number, y: number, b: number, h: number): string {
  const r = Math.min(2, b / 2, h)
  const bund = y + h
  return `M${x},${bund} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + b - r},${y} Q${x + b},${y} ${x + b},${y + r} L${x + b},${bund} Z`
}

export function SoejleGraf({ serier, tider, enhed, maxY, decimaler = 1 }: GrafProps) {
  const [ref, bredde] = useBredde()
  const { tooltip, onPointerMove, onPointerLeave } = brugTooltip(tider, bredde)

  const alle = serier.flatMap((s) => s.vaerdier).filter((v): v is number => v != null)
  const max = maxY ?? Math.max(1, Math.ceil(Math.max(...alle, 0) * 1.15))
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
  const plotHoejde = HOEJDE - MARGEN.top - MARGEN.bund
  const yTilPx = (v: number) => MARGEN.top + plotHoejde - (v / max) * plotHoejde
  const yTicks = pæneTicks(0, max)

  const baandBredde = plotBredde / tider.length
  // 2px mellemrum mellem søjler i samme bånd og lidt luft mellem bånd.
  const soejleBredde = Math.max(1.5, Math.min(24, (baandBredde - 3 - 2 * (serier.length - 1)) / serier.length))

  return (
    <GrafRamme
      serier={serier}
      tider={tider}
      enhed={enhed}
      decimaler={decimaler}
      tooltip={tooltip}
      bredde={bredde}
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      yTicks={yTicks}
      yTilPx={yTilPx}
      visLegend={serier.length > 1}
    >
      {serier.map((s, sIndex) =>
        s.vaerdier.map((v, i) => {
          if (v == null || v <= 0) return null
          const gruppeBredde = serier.length * soejleBredde + (serier.length - 1) * 2
          const x0 =
            MARGEN.venstre + baandBredde * i + (baandBredde - gruppeBredde) / 2 + sIndex * (soejleBredde + 2)
          const y = yTilPx(v)
          const h = MARGEN.top + plotHoejde - y
          if (h < 0.5) return null
          return (
            <path
              key={`${s.navn}-${i}`}
              d={soejleSti(x0, y, soejleBredde, h)}
              fill={s.farve}
              opacity={tooltip && tooltip.index !== i ? 0.55 : 1}
            />
          )
        }),
      )}
    </GrafRamme>
  )
}

// Kombineret graf: søjler (fx nedbør i mm, venstre akse) og linjer
// (fx sandsynlighed i %, fast 0–100 på højre akse) i samme plot.
export function KombiGraf({
  soejler,
  linjer,
  tider,
}: {
  soejler: Serie[]
  linjer: Serie[]
  tider: string[]
}) {
  const HOEJRE = 30
  const TOP = 24 // ekstra luft til enheds-mærkaterne over akserne
  const [ref, bredde] = useBredde()
  const { tooltip, onPointerMove, onPointerLeave } = brugTooltip(tider, bredde, HOEJRE)

  const alleMm = soejler.flatMap((s) => s.vaerdier).filter((v): v is number => v != null)
  const maxMm = Math.max(1, Math.ceil(Math.max(...alleMm, 0) * 1.15))
  const plotBredde = bredde - MARGEN.venstre - HOEJRE
  const plotHoejde = HOEJDE - TOP - MARGEN.bund
  const yMm = (v: number) => TOP + plotHoejde - (v / maxMm) * plotHoejde
  const yPct = (v: number) => TOP + plotHoejde - (v / 100) * plotHoejde
  const xTilPx = (i: number) => MARGEN.venstre + (plotBredde * (i + 0.5)) / tider.length
  const yTicks = pæneTicks(0, maxMm)

  const baandBredde = plotBredde / tider.length
  const soejleBredde = Math.max(
    1.5,
    Math.min(24, (baandBredde - 3 - 2 * (soejler.length - 1)) / soejler.length),
  )

  return (
    <GrafRamme
      serier={[...soejler, ...linjer]}
      tider={tider}
      enhed=""
      decimaler={1}
      tooltip={tooltip}
      bredde={bredde}
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      yTicks={yTicks}
      yTilPx={yMm}
      visLegend
      margenHoejre={HOEJRE}
    >
      {/* Højre akse: fast procentskala */}
      {[0, 50, 100].map((v) => (
        <text
          key={v}
          x={MARGEN.venstre + plotBredde + 6}
          y={yPct(v) + 3}
          className="graf-akse"
        >
          {v}
        </text>
      ))}
      <text x={MARGEN.venstre - 6} y={12} className="graf-akse" textAnchor="end">
        mm
      </text>
      <text x={MARGEN.venstre + plotBredde + 6} y={12} className="graf-akse">
        %
      </text>
      {soejler.map((s, sIndex) =>
        s.vaerdier.map((v, i) => {
          if (v == null || v <= 0) return null
          const gruppeBredde = soejler.length * soejleBredde + (soejler.length - 1) * 2
          const x0 =
            MARGEN.venstre +
            baandBredde * i +
            (baandBredde - gruppeBredde) / 2 +
            sIndex * (soejleBredde + 2)
          const y = yMm(v)
          const h = TOP + plotHoejde - y
          if (h < 0.5) return null
          return (
            <path
              key={`${s.navn}-${i}`}
              d={soejleSti(x0, y, soejleBredde, h)}
              fill={s.farve}
              opacity={tooltip && tooltip.index !== i ? 0.55 : 1}
            />
          )
        }),
      )}
      {linjer.map((s) => (
        <path
          key={s.navn}
          d={linjeSti(s.vaerdier, xTilPx, yPct)}
          fill="none"
          stroke={s.farve}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {tooltip &&
        linjer.map((s) => {
          const v = s.vaerdier[tooltip.index]
          if (v == null) return null
          return (
            <circle
              key={s.navn}
              cx={xTilPx(tooltip.index)}
              cy={yPct(v)}
              r={4}
              fill={s.farve}
              className="graf-punkt"
            />
          )
        })}
    </GrafRamme>
  )
}

// Vindgraf: linje = middelvind, bånd = op til vindstød, pile = retning.
export interface VindSerie {
  navn: string
  farve: string
  hastighed: (number | null)[]
  stoed: (number | null)[]
  retning: (number | null)[]
}

const PILE_RAEKKE_HOEJDE = 18

export function VindGraf({ vind, tider }: { vind: VindSerie[]; tider: string[] }) {
  const margenBund = MARGEN.bund + 4 + vind.length * PILE_RAEKKE_HOEJDE
  const hoejde = HOEJDE + vind.length * PILE_RAEKKE_HOEJDE + 4
  const [ref, bredde] = useBredde()
  const { tooltip, onPointerMove, onPointerLeave } = brugTooltip(tider, bredde)

  const alle = vind
    .flatMap((s) => [...s.hastighed, ...s.stoed])
    .filter((v): v is number => v != null)
  const max = Math.max(2, Math.ceil(Math.max(...alle, 0) * 1.1))
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
  const plotHoejde = hoejde - MARGEN.top - margenBund
  const yTilPx = (v: number) => MARGEN.top + plotHoejde - (v / max) * plotHoejde
  const xTilPx = (i: number) => MARGEN.venstre + (plotBredde * (i + 0.5)) / tider.length
  const yTicks = pæneTicks(0, max)
  const pileTrin = plotBredde / tider.length < 11 ? 6 : 3

  // Tooltip-serier: vind + stød pr. model (stød skjules i legenden).
  const tooltipSerier: Serie[] = vind.flatMap((s) => [
    { navn: s.navn, farve: s.farve, vaerdier: s.hastighed, enhed: 'm/s', decimaler: 1 },
    {
      navn: `${s.navn} stød`,
      farve: s.farve,
      vaerdier: s.stoed,
      enhed: 'm/s',
      decimaler: 1,
      skjulILegend: true,
    },
  ])

  // Areal mellem hastighed og stød (kun hvor begge findes).
  function baandSti(s: VindSerie): string {
    let sti = ''
    let start = -1
    for (let i = 0; i <= s.hastighed.length; i++) {
      const ok = i < s.hastighed.length && s.hastighed[i] != null && s.stoed[i] != null
      if (ok && start === -1) start = i
      if (!ok && start !== -1) {
        const op = []
        const ned = []
        for (let j = start; j < i; j++) {
          // Stød kan aldrig være under middelvinden — klem for en sikkerheds skyld.
          op.push(`${xTilPx(j)},${yTilPx(Math.max(s.stoed[j]!, s.hastighed[j]!))}`)
          ned.unshift(`${xTilPx(j)},${yTilPx(s.hastighed[j]!)}`)
        }
        sti += `M${op.join(' L')} L${ned.join(' L')} Z `
        start = -1
      }
    }
    return sti.trim()
  }

  return (
    <GrafRamme
      serier={tooltipSerier}
      tider={tider}
      enhed="m/s"
      decimaler={1}
      tooltip={tooltip}
      bredde={bredde}
      ref={ref}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      yTicks={yTicks}
      yTilPx={yTilPx}
      visLegend={vind.length > 1}
      hoejde={hoejde}
      margenBund={margenBund}
    >
      {vind.map((s) => (
        <path key={s.navn + '-baand'} d={baandSti(s)} fill={s.farve} opacity={0.14} />
      ))}
      {vind.map((s) => (
        <path
          key={s.navn}
          d={linjeSti(s.hastighed, xTilPx, yTilPx)}
          fill="none"
          stroke={s.farve}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {/* Pile-rækker under aksen: peger hvorhen vinden blæser (retning + 180°) */}
      {vind.map((s, r) => {
        const y = hoejde - margenBund + 24 + r * PILE_RAEKKE_HOEJDE + PILE_RAEKKE_HOEJDE / 2
        return (
          <g key={s.navn + '-pile'}>
            <text x={MARGEN.venstre - 6} y={y + 3} className="graf-akse" textAnchor="end">
              {s.navn}
            </text>
            {s.retning.map((retn, i) => {
              if (retn == null || i % pileTrin !== 0) return null
              return (
                <g
                  key={i}
                  transform={`translate(${xTilPx(i)},${y}) rotate(${retn + 180})`}
                  opacity={0.9}
                >
                  <path
                    d="M0 4.5 L0 -4.5 M0 -4.5 L-3 -1 M0 -4.5 L3 -1"
                    stroke={s.farve}
                    strokeWidth={1.6}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              )
            })}
          </g>
        )
      })}
      {tooltip &&
        vind.map((s) => {
          const v = s.hastighed[tooltip.index]
          if (v == null) return null
          return (
            <circle
              key={s.navn}
              cx={xTilPx(tooltip.index)}
              cy={yTilPx(v)}
              r={4}
              fill={s.farve}
              className="graf-punkt"
            />
          )
        })}
    </GrafRamme>
  )
}
