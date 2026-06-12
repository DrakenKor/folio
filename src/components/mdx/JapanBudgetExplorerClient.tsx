'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FiDownload, FiRotateCcw } from 'react-icons/fi'

export interface JapanBudgetYear {
  year: number
  total: number
  food: number
  housing: number
  fuel: number
  furniture: number
  clothing: number
  medical: number
  transport: number
  education: number
  recreation: number
  other: number
  engel: number
  yearlyIncome: number
  persons: number
  age: number
  rice: number
  bread: number
  cookedFood: number
  eatingOut: number
  fish: number
  meat: number
  communication: number
  electricity: number
  books: number
  packageTours: number
  tobacco: number
  medicalServices: number
}

export interface JapanWorkersYear {
  year: number
  income: number
  disposableIncome: number
  nonConsumption: number
  directTaxes: number
  socialInsurance: number
  consumption: number
  surplus: number
  yearlyIncome: number
}

export interface JapanBudgetSummary {
  firstYear: number
  lastYear: number
  engelFirst: number
  engelLast: number
  totalFirst: number
  totalLast: number
  personsFirst: number
  personsLast: number
  apcFirst: number
  apcLast: number
}

export interface JapanBudgetSource {
  downloadUrl: string
  sourceUrl: string
}

interface JapanBudgetExplorerClientProps {
  budgetYears: JapanBudgetYear[]
  workersYears: JapanWorkersYear[]
  summary: JapanBudgetSummary
  source: JapanBudgetSource
}

type ViewMode = 'share' | 'yen' | 'items' | 'workers'

type CategoryKey =
  | 'food'
  | 'housing'
  | 'fuel'
  | 'furniture'
  | 'clothing'
  | 'medical'
  | 'transport'
  | 'education'
  | 'recreation'
  | 'other'

type ItemKey =
  | 'rice'
  | 'bread'
  | 'cookedFood'
  | 'eatingOut'
  | 'fish'
  | 'meat'
  | 'communication'
  | 'electricity'
  | 'books'
  | 'packageTours'

const VIEWBOX_WIDTH = 1040
const VIEWBOX_HEIGHT = 620
const CHART_LEFT = 88
const CHART_RIGHT = 30
const CHART_TOP = 46
const CHART_BOTTOM = 92
const PLOT_WIDTH = VIEWBOX_WIDTH - CHART_LEFT - CHART_RIGHT
const PLOT_HEIGHT = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM

const CATEGORIES: Array<{ key: CategoryKey; label: string; color: string }> = [
  { key: 'food', label: 'Food', color: '#fbbf24' },
  { key: 'housing', label: 'Housing', color: '#60a5fa' },
  { key: 'fuel', label: 'Fuel, light & water', color: '#2dd4bf' },
  { key: 'furniture', label: 'Furniture & utensils', color: '#bef264' },
  { key: 'clothing', label: 'Clothing & footwear', color: '#f472b6' },
  { key: 'medical', label: 'Medical care', color: '#34d399' },
  { key: 'transport', label: 'Transport & communication', color: '#f87171' },
  { key: 'education', label: 'Education', color: '#c084fc' },
  { key: 'recreation', label: 'Culture & recreation', color: '#fb923c' },
  { key: 'other', label: 'Other (incl. social expenses)', color: '#94a3b8' }
]

const ITEMS: Array<{ key: ItemKey; label: string; color: string }> = [
  { key: 'rice', label: 'Rice', color: '#fbbf24' },
  { key: 'bread', label: 'Bread', color: '#fde68a' },
  { key: 'cookedFood', label: 'Cooked food', color: '#fb923c' },
  { key: 'eatingOut', label: 'Eating out', color: '#f87171' },
  { key: 'fish', label: 'Fish & shellfish', color: '#60a5fa' },
  { key: 'meat', label: 'Meat', color: '#f472b6' },
  { key: 'communication', label: 'Communication', color: '#2dd4bf' },
  { key: 'electricity', label: 'Electricity', color: '#facc15' },
  { key: 'books', label: 'Books & reading', color: '#c084fc' },
  { key: 'packageTours', label: 'Package tours', color: '#34d399' }
]

const DEFAULT_ITEMS: ItemKey[] = ['rice', 'cookedFood', 'eatingOut', 'books']

const WORKERS_SERIES: Array<{
  key: 'income' | 'disposableIncome' | 'consumption'
  label: string
  color: string
}> = [
  { key: 'income', label: 'Monthly income', color: '#60a5fa' },
  { key: 'disposableIncome', label: 'Disposable income', color: '#2dd4bf' },
  { key: 'consumption', label: 'Consumption', color: '#fbbf24' }
]

const EVENTS: Array<{ year: number; label: string; row: 0 | 1 }> = [
  { year: 2008, label: 'Financial crisis', row: 0 },
  { year: 2011, label: 'Tohoku earthquake', row: 1 },
  { year: 2014, label: 'Tax to 8%', row: 0 },
  { year: 2018, label: 'Diary revised', row: 1 },
  { year: 2019, label: 'Tax to 10%', row: 0 },
  { year: 2020, label: 'COVID-19', row: 1 }
]

const VIEW_OPTIONS: Array<{ key: ViewMode; label: string }> = [
  { key: 'share', label: 'Budget shares' },
  { key: 'yen', label: 'Yen per month' },
  { key: 'items', label: 'What changed' },
  { key: 'workers', label: "Workers' ledger" }
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundTo(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString('en-US')}`
}

function formatYenCompact(value: number): string {
  if (value === 0) {
    return '0'
  }

  return `¥${Math.round(value / 1000)}k`
}

function formatShare(value: number): string {
  return `${roundTo(value, 1).toFixed(1)}%`
}

function formatSignedPoints(value: number): string {
  if (Math.abs(value) < 0.05) {
    return '±0.0pt'
  }

  return `${value > 0 ? '+' : '−'}${roundTo(Math.abs(value), 1).toFixed(1)}pt`
}

function formatIndex(value: number): string {
  return roundTo(value, 0).toFixed(0)
}

function getNiceStep(span: number, targetTicks: number): number {
  const rawStep = Math.max(span / targetTicks, 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const candidates = [1, 2, 2.5, 5, 10].map((candidate) => candidate * magnitude)

  return candidates.find((candidate) => candidate >= rawStep) ?? candidates[candidates.length - 1]
}

function createTicks(min: number, max: number, targetTicks: number): number[] {
  const step = getNiceStep(max - min, targetTicks)
  const ticks: number[] = []

  for (let tick = Math.ceil(min / step) * step; tick <= max + 1e-9; tick += step) {
    ticks.push(roundTo(tick, 4))
  }

  return ticks
}

function buildLinePath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(
  top: Array<{ x: number; y: number }>,
  bottom: Array<{ x: number; y: number }>
): string {
  const forward = top
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
  const backward = [...bottom]
    .reverse()
    .map((point) => `L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  return `${forward} ${backward} Z`
}

export function JapanBudgetExplorerClient({
  budgetYears,
  workersYears,
  summary,
  source
}: JapanBudgetExplorerClientProps) {
  const descId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [view, setView] = useState<ViewMode>('share')
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState(summary.lastYear)
  const [highlightedCategory, setHighlightedCategory] = useState<CategoryKey | null>(null)
  const [activeItems, setActiveItems] = useState<ItemKey[]>(DEFAULT_ITEMS)
  const [showEvents, setShowEvents] = useState(true)

  const activeYear = hoveredYear ?? selectedYear
  const activeBudget =
    budgetYears.find((row) => row.year === activeYear) ?? budgetYears[budgetYears.length - 1]
  const activeWorkers =
    workersYears.find((row) => row.year === activeYear) ?? workersYears[workersYears.length - 1]
  const baseBudget = budgetYears[0]

  const xScale = (year: number) =>
    CHART_LEFT + ((year - summary.firstYear) / (summary.lastYear - summary.firstYear)) * PLOT_WIDTH

  const { yMin, yMax } = useMemo(() => {
    if (view === 'share') {
      return { yMin: 0, yMax: 100 }
    }

    if (view === 'yen') {
      const maxTotal = Math.max(...budgetYears.map((row) => row.total))

      return { yMin: 0, yMax: Math.ceil(maxTotal / 20000) * 20000 }
    }

    if (view === 'workers') {
      const maxIncome = Math.max(...workersYears.map((row) => row.income))

      return { yMin: 0, yMax: Math.ceil(maxIncome / 50000) * 50000 }
    }

    const visibleItems = activeItems.length > 0 ? activeItems : DEFAULT_ITEMS
    const indices = budgetYears.flatMap((row) =>
      visibleItems.map((item) => (row[item] / baseBudget[item]) * 100)
    )
    const rawMin = Math.min(...indices, 100)
    const rawMax = Math.max(...indices, 100)

    return {
      yMin: Math.max(Math.floor((rawMin - 5) / 10) * 10, 0),
      yMax: Math.ceil((rawMax + 5) / 10) * 10
    }
  }, [activeItems, baseBudget, budgetYears, view, workersYears])

  const yScale = (value: number) =>
    CHART_TOP + ((yMax - value) / Math.max(yMax - yMin, 1)) * PLOT_HEIGHT

  const stackedBands = useMemo(() => {
    if (view !== 'share' && view !== 'yen') {
      return []
    }

    const cumulative = budgetYears.map(() => 0)

    return CATEGORIES.map((category) => {
      const bottom = budgetYears.map((row, index) => ({
        x: xScale(row.year),
        y: yScale(view === 'share' ? (cumulative[index] / row.total) * 100 : cumulative[index])
      }))
      const top = budgetYears.map((row, index) => {
        cumulative[index] += row[category.key]

        return {
          x: xScale(row.year),
          y: yScale(view === 'share' ? (cumulative[index] / row.total) * 100 : cumulative[index])
        }
      })

      return { category, path: buildAreaPath(top, bottom) }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetYears, view, yMax, yMin])

  const itemLines = useMemo(() => {
    if (view !== 'items') {
      return []
    }

    return ITEMS.filter((item) => activeItems.includes(item.key)).map((item) => ({
      item,
      path: buildLinePath(
        budgetYears.map((row) => ({
          x: xScale(row.year),
          y: yScale((row[item.key] / baseBudget[item.key]) * 100)
        }))
      )
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeItems, baseBudget, budgetYears, view, yMax, yMin])

  const workersLines = useMemo(() => {
    if (view !== 'workers') {
      return []
    }

    return WORKERS_SERIES.map((series) => ({
      series,
      path: buildLinePath(
        workersYears.map((row) => ({
          x: xScale(row.year),
          y: yScale(row[series.key])
        }))
      )
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, workersYears, yMax, yMin])

  const xTicks = budgetYears
    .map((row) => row.year)
    .filter((year) => year % 2 === 1 || year === summary.lastYear)
  const yTicks = createTicks(yMin, yMax, 6)

  function formatYTick(value: number): string {
    if (view === 'share') {
      return `${Math.round(value)}%`
    }

    if (view === 'items') {
      return formatIndex(value)
    }

    return formatYenCompact(value)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current

    if (!svg) {
      return
    }

    const bounds = svg.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH
    const yearSpan = summary.lastYear - summary.firstYear
    const fraction = clamp((pointerX - CHART_LEFT) / PLOT_WIDTH, 0, 1)

    setHoveredYear(summary.firstYear + Math.round(fraction * yearSpan))
  }

  function handleChartClick() {
    if (hoveredYear !== null) {
      setSelectedYear(hoveredYear)
    }
  }

  function toggleItem(key: ItemKey) {
    setActiveItems((current) => {
      if (current.includes(key)) {
        return current.length > 1 ? current.filter((item) => item !== key) : current
      }

      return [...current, key]
    })
  }

  function resetChart() {
    setView('share')
    setHoveredYear(null)
    setSelectedYear(summary.lastYear)
    setHighlightedCategory(null)
    setActiveItems(DEFAULT_ITEMS)
    setShowEvents(true)
  }

  const activeX = xScale(activeYear)
  const activeApc = (activeWorkers.consumption / activeWorkers.disposableIncome) * 100
  const yAxisTitle =
    view === 'share'
      ? 'Share of consumption spending'
      : view === 'items'
        ? `Spending index (${summary.firstYear} = 100)`
        : 'Yen per month'

  const categoryRows = [...CATEGORIES]
    .map((category) => ({
      category,
      value: activeBudget[category.key],
      share: (activeBudget[category.key] / activeBudget.total) * 100,
      baseShare: (baseBudget[category.key] / baseBudget.total) * 100
    }))
    .sort((left, right) => right.value - left.value)
  const maxCategoryValue = Math.max(...categoryRows.map((row) => row.value))

  const itemRows = ITEMS.filter((item) => activeItems.includes(item.key)).map((item) => ({
    item,
    value: activeBudget[item.key],
    index: (activeBudget[item.key] / baseBudget[item.key]) * 100
  }))

  const workersRows: Array<{ label: string; value: string; muted?: boolean }> = [
    { label: 'Monthly income', value: formatYen(activeWorkers.income) },
    { label: 'Direct taxes', value: `−${formatYen(activeWorkers.directTaxes).slice(1)}`, muted: true },
    {
      label: 'Social insurance',
      value: `−${formatYen(activeWorkers.socialInsurance).slice(1)}`,
      muted: true
    },
    { label: 'Disposable income', value: formatYen(activeWorkers.disposableIncome) },
    { label: 'Consumption', value: formatYen(activeWorkers.consumption) },
    { label: 'Surplus', value: formatYen(activeWorkers.surplus) },
    { label: 'Propensity to consume', value: formatShare(activeApc) }
  ]

  return (
    <div className="jp-budget-explorer blog-wide-figure">
      <div className="jp-budget-statbar" aria-label="Japan household budget summary">
        <div>
          <span>Span</span>
          <strong>
            {summary.firstYear}-{summary.lastYear}
          </strong>
        </div>
        <div>
          <span>Engel coefficient</span>
          <strong>
            {formatShare(summary.engelFirst)} → {formatShare(summary.engelLast)}
          </strong>
        </div>
        <div>
          <span>Monthly spending</span>
          <strong>
            {formatYen(summary.totalFirst)} → {formatYen(summary.totalLast)}
          </strong>
        </div>
        <div>
          <span>Propensity to consume</span>
          <strong>
            {formatShare(summary.apcFirst)} → {formatShare(summary.apcLast)}
          </strong>
        </div>
      </div>

      <div className="jp-budget-toolbar" aria-label="Budget chart controls">
        <div className="jp-budget-segmented" aria-label="Chart view">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={view === option.key ? 'is-active' : undefined}
              type="button"
              onClick={() => setView(option.key)}>
              {option.label}
            </button>
          ))}
        </div>

        <div className="jp-budget-action-row">
          <label className="jp-budget-toggle">
            <input
              checked={showEvents}
              type="checkbox"
              onChange={(event) => setShowEvents(event.target.checked)}
            />
            <span>Events</span>
          </label>
          <a className="jp-budget-icon-link" href={source.downloadUrl} download>
            <FiDownload aria-hidden="true" />
            <span>Data</span>
          </a>
          <button className="jp-budget-icon-button" type="button" onClick={resetChart}>
            <FiRotateCcw aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {view === 'share' || view === 'yen' ? (
        <div className="jp-budget-chips" aria-label="Spending categories">
          {CATEGORIES.map((category) => (
            <button
              key={category.key}
              className={
                highlightedCategory === category.key ? 'jp-budget-chip is-active' : 'jp-budget-chip'
              }
              type="button"
              onClick={() =>
                setHighlightedCategory((current) => (current === category.key ? null : category.key))
              }>
              <i style={{ background: category.color }} />
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      {view === 'items' ? (
        <div className="jp-budget-chips" aria-label="Commodity items">
          {ITEMS.map((item) => (
            <button
              key={item.key}
              className={activeItems.includes(item.key) ? 'jp-budget-chip is-active' : 'jp-budget-chip'}
              type="button"
              onClick={() => toggleItem(item.key)}>
              <i style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {view === 'workers' ? (
        <div className="jp-budget-chips" aria-label="Workers' household series">
          {WORKERS_SERIES.map((series) => (
            <span key={series.key} className="jp-budget-chip is-static">
              <i style={{ background: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="jp-budget-chart-grid">
        <div className="jp-budget-svg-panel">
          <svg
            ref={svgRef}
            aria-describedby={descId}
            aria-label={`Japanese household budget, ${summary.firstYear} to ${summary.lastYear}`}
            className="jp-budget-svg"
            role="img"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            onClick={handleChartClick}
            onPointerLeave={() => setHoveredYear(null)}
            onPointerMove={handlePointerMove}>
            <desc id={descId}>
              Interactive chart of Japanese household spending from the Family Income and
              Expenditure Survey, {summary.firstYear} to {summary.lastYear}.
            </desc>

            <rect
              className="jp-budget-plot-bg"
              height={PLOT_HEIGHT}
              width={PLOT_WIDTH}
              x={CHART_LEFT}
              y={CHART_TOP}
            />

            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  className="jp-budget-grid-line"
                  x1={CHART_LEFT}
                  x2={CHART_LEFT + PLOT_WIDTH}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                />
                <text className="jp-budget-axis-label" x={CHART_LEFT - 12} y={yScale(tick) + 4}>
                  {formatYTick(tick)}
                </text>
              </g>
            ))}

            {xTicks.map((year) => (
              <text
                key={`x-${year}`}
                className="jp-budget-axis-label"
                textAnchor="middle"
                x={xScale(year)}
                y={CHART_TOP + PLOT_HEIGHT + 30}>
                {year}
              </text>
            ))}

            {stackedBands.map(({ category, path }) => (
              <path
                key={category.key}
                className="jp-budget-band"
                d={path}
                fill={category.color}
                opacity={
                  highlightedCategory === null ? 0.82 : highlightedCategory === category.key ? 0.95 : 0.18
                }
              />
            ))}

            {itemLines.map(({ item, path }) => (
              <path key={item.key} className="jp-budget-line" d={path} stroke={item.color} />
            ))}

            {view === 'items' ? (
              <line
                className="jp-budget-baseline"
                x1={CHART_LEFT}
                x2={CHART_LEFT + PLOT_WIDTH}
                y1={yScale(100)}
                y2={yScale(100)}
              />
            ) : null}

            {workersLines.map(({ series, path }) => (
              <path key={series.key} className="jp-budget-line" d={path} stroke={series.color} />
            ))}

            {showEvents
              ? EVENTS.map((event) => (
                  <g key={event.year}>
                    <line
                      className="jp-budget-event-line"
                      x1={xScale(event.year)}
                      x2={xScale(event.year)}
                      y1={CHART_TOP}
                      y2={CHART_TOP + PLOT_HEIGHT}
                    />
                    <text
                      className="jp-budget-event-label"
                      textAnchor="middle"
                      x={xScale(event.year)}
                      y={CHART_TOP + PLOT_HEIGHT + (event.row === 0 ? 52 : 70)}>
                      {event.label}
                    </text>
                  </g>
                ))
              : null}

            <g className="jp-budget-crosshair">
              <line x1={activeX} x2={activeX} y1={CHART_TOP} y2={CHART_TOP + PLOT_HEIGHT} />
              <text
                className="jp-budget-active-label"
                textAnchor={activeX > CHART_LEFT + PLOT_WIDTH - 70 ? 'end' : 'start'}
                x={activeX > CHART_LEFT + PLOT_WIDTH - 70 ? activeX - 8 : activeX + 8}
                y={CHART_TOP + 20}>
                {activeYear}
              </text>
            </g>

            <text
              className="jp-budget-axis-title"
              textAnchor="middle"
              x={CHART_LEFT + PLOT_WIDTH / 2}
              y={VIEWBOX_HEIGHT - 6}>
              Year
            </text>
            <text
              className="jp-budget-axis-title"
              textAnchor="middle"
              transform={`translate(20 ${CHART_TOP + PLOT_HEIGHT / 2}) rotate(-90)`}>
              {yAxisTitle}
            </text>
          </svg>
        </div>

        <aside className="jp-budget-readout" aria-live="polite">
          <p className="jp-budget-readout-kicker">Selected year</p>
          <h3>{activeYear}</h3>
          <p className="jp-budget-readout-context">
            {activeBudget.persons} persons per household, head aged {activeBudget.age}.
            Consumption {formatYen(activeBudget.total)} per month.
          </p>

          {view === 'share' || view === 'yen' ? (
            <ul className="jp-budget-breakdown">
              {categoryRows.map(({ category, value, share, baseShare }) => (
                <li key={category.key}>
                  <span className="jp-budget-breakdown-label">
                    <i style={{ background: category.color }} />
                    {category.label}
                  </span>
                  <span className="jp-budget-breakdown-bar">
                    <i
                      style={{
                        background: category.color,
                        width: `${(value / maxCategoryValue) * 100}%`
                      }}
                    />
                  </span>
                  <span className="jp-budget-breakdown-value">
                    {formatYen(value)} · {formatShare(share)} ·{' '}
                    {formatSignedPoints(share - baseShare)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {view === 'items' ? (
            <ul className="jp-budget-breakdown">
              {itemRows.map(({ item, value, index }) => (
                <li key={item.key}>
                  <span className="jp-budget-breakdown-label">
                    <i style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="jp-budget-breakdown-value">
                    {formatYen(value)} · index {formatIndex(index)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {view === 'workers' ? (
            <ul className="jp-budget-ledger">
              {workersRows.map((row) => (
                <li key={row.label} className={row.muted ? 'is-muted' : undefined}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          ) : null}
        </aside>
      </div>

      <div className="jp-budget-caption">
        <p>
          Monthly averages per household, nominal yen. Total Households series; the workers&apos;
          ledger uses the Workers&apos; Households series. In the share view the top edge of the
          food band is the Engel coefficient. Source:{' '}
          <a href={source.sourceUrl} target="_blank" rel="noreferrer">
            Statistics Bureau of Japan, Family Income and Expenditure Survey
          </a>{' '}
          annual reports, 2007-2024, via e-Stat.
        </p>
        <p>
          The survey diary was revised in January 2018; the Bureau advises care when comparing
          periods that span 2018. Values are per household and reflect shrinking household size
          over the period.
        </p>
      </div>
    </div>
  )
}
