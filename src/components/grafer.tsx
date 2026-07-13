import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

// Fælles SVG-grafer: linjegraf (temperatur) og søjlegraf (nedbør m.m.).
// Farver og mål følger et fast sæt specifikationer: 2px linjer, hårfine
// gridlinjer, 2px "surface"-mellemrum mellem søjler og tooltip med alle serier.

export interface Serie {
  navn: string
  farve: string
  vaerdier: (number | null)[]
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

function useBredde(): [React.RefObject<HTMLDivElement | null>, number] {
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
              {v == null ? '–' : `${v.toFixed(decimaler)} ${enhed}`}
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
}) {
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
  return (
    <div className="graf" ref={ref}>
      {visLegend && (
        <div className="graf-legend">
          {serier.map((s) => (
            <span className="graf-legend-punkt" key={s.navn}>
              <span className="graf-legend-noegle" style={{ background: s.farve }} />
              {s.navn}
            </span>
          ))}
        </div>
      )}
      <div className="graf-flade">
        <svg
          width={bredde}
          height={HOEJDE}
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
                y={HOEJDE - 6}
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
              y2={HOEJDE - MARGEN.bund}
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

function brugTooltip(tider: string[], bredde: number) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  const plotBredde = bredde - MARGEN.venstre - MARGEN.hoejre
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
      {serier.map((s) => {
        const sti = s.vaerdier
          .map((v, i) => (v == null ? null : `${i === 0 ? 'M' : 'L'}${xTilPx(i)},${yTilPx(v)}`))
          .filter(Boolean)
          .join(' ')
        return (
          <path
            key={s.navn}
            d={sti}
            fill="none"
            stroke={s.farve}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )
      })}
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
