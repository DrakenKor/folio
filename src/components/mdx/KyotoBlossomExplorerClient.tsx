'use client'

import { useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { FiDownload, FiRotateCcw } from 'react-icons/fi'

export interface KyotoBlossomChartPoint {
  year: number
  day: number | null
  average: number | null
}

export interface KyotoBlossomObservedPoint extends KyotoBlossomChartPoint {
  day: number
}

export interface KyotoBlossomChartSummary {
  firstYear: number
  lastYear: number
  observedCount: number
  latestObserved: KyotoBlossomObservedPoint
  recordEarliest: KyotoBlossomObservedPoint
  recordLatest: KyotoBlossomObservedPoint
  earliestEight: KyotoBlossomObservedPoint[]
  earliestEightSince2021: number
  latestAverage: number
  latestDeviationFromAverage: number
  latestDeviationFromPre1900Average: number
  latestThirtyYearAverage: number
  modernAverage: number
  pre1900Average: number
  recentObservedCount: number
}

export interface KyotoBlossomChartSource {
  citation: string
  originalChartUrl: string
  originalSourceUrl: string
  downloadUrl: string
  fullMetadataUrl?: string
  dateDownloaded?: string
  lastUpdated?: string
  nextUpdate?: string
  note?: string
}

interface KyotoBlossomExplorerClientProps {
  points: KyotoBlossomChartPoint[]
  source: KyotoBlossomChartSource
  summary: KyotoBlossomChartSummary
}

type MetricMode = 'date' | 'deviation'

interface PositionedPoint extends KyotoBlossomObservedPoint {
  average: number | null
  value: number
  x: number
  y: number
}

const VIEWBOX_WIDTH = 1040
const VIEWBOX_HEIGHT = 610
const CHART_LEFT = 78
const CHART_RIGHT = 34
const CHART_TOP = 42
const CHART_BOTTOM = 82
const PLOT_WIDTH = VIEWBOX_WIDTH - CHART_LEFT - CHART_RIGHT
const PLOT_HEIGHT = VIEWBOX_HEIGHT - CHART_TOP - CHART_BOTTOM

const BLOSSOM_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC'
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function roundTo(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function formatNumber(value: number, digits = 1): string {
  return roundTo(value, digits).toFixed(digits)
}

function formatSignedNumber(value: number): string {
  if (Math.abs(value) < 0.05) {
    return '0.0'
  }

  return `${value > 0 ? '+' : ''}${formatNumber(value)}`
}

function formatDelta(value: number): string {
  if (Math.abs(value) < 0.05) {
    return 'right on the average'
  }

  return `${formatNumber(Math.abs(value))} days ${value < 0 ? 'earlier' : 'later'}`
}

function formatBloomDate(year: number, day: number): string {
  return BLOSSOM_DATE_FORMATTER.format(new Date(Date.UTC(year, 0, Math.round(day))))
}

function getMetricValue(point: KyotoBlossomChartPoint, metric: MetricMode): number | null {
  if (point.day === null) {
    return null
  }

  if (metric === 'date') {
    return point.day
  }

  return point.average === null ? null : point.day - point.average
}

function getNiceStep(span: number, targetTicks: number): number {
  const rawStep = Math.max(span / targetTicks, 1)
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const candidates = [1, 2, 5, 10].map((candidate) => candidate * magnitude)

  return candidates.find((candidate) => candidate >= rawStep) ?? candidates[candidates.length - 1]
}

function createYearTicks(startYear: number, endYear: number): number[] {
  const span = Math.max(endYear - startYear, 1)
  const step = getNiceStep(span, 7)
  const ticks = new Set<number>([startYear, endYear])
  const firstTick = Math.ceil(startYear / step) * step

  for (let tick = firstTick; tick <= endYear; tick += step) {
    ticks.add(tick)
  }

  return [...ticks].sort((left, right) => left - right)
}

function createValueTicks(minValue: number, maxValue: number, metric: MetricMode): number[] {
  const span = Math.max(maxValue - minValue, 1)
  const step = metric === 'date' ? (span > 30 ? 10 : 5) : getNiceStep(span, 6)
  const ticks: number[] = []
  const firstTick = Math.ceil(minValue / step) * step

  for (let tick = firstTick; tick <= maxValue; tick += step) {
    ticks.push(roundTo(tick, 2))
  }

  if (!ticks.includes(minValue)) {
    ticks.unshift(minValue)
  }

  if (!ticks.includes(maxValue)) {
    ticks.push(maxValue)
  }

  return ticks
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function getPointColor(point: KyotoBlossomObservedPoint, metric: MetricMode): string {
  if (metric === 'deviation' && point.average !== null) {
    const delta = point.day - point.average

    if (delta <= -8) {
      return '#ff4f8b'
    }

    if (delta < 0) {
      return '#f8a45f'
    }

    return '#75b7ff'
  }

  if (point.day <= 88) {
    return '#ff4f8b'
  }

  if (point.day <= 94) {
    return '#f8a45f'
  }

  return '#86a8d9'
}

function getPointRadius(pointCount: number): number {
  if (pointCount > 650) {
    return 2.35
  }

  if (pointCount > 250) {
    return 3
  }

  return 4.25
}

function getPointOpacity(point: KyotoBlossomObservedPoint, activeYear: number | null): number {
  if (activeYear === point.year) {
    return 1
  }

  if (point.year >= 2021 && point.day <= 88) {
    return 0.94
  }

  return 0.62
}

function getRankLabel(rank: number): string {
  const suffix =
    rank % 10 === 1 && rank % 100 !== 11
      ? 'st'
      : rank % 10 === 2 && rank % 100 !== 12
        ? 'nd'
        : rank % 10 === 3 && rank % 100 !== 13
          ? 'rd'
          : 'th'

  return `${rank}${suffix}`
}

export function KyotoBlossomExplorerClient({
  points,
  source,
  summary
}: KyotoBlossomExplorerClientProps) {
  const descId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [metric, setMetric] = useState<MetricMode>('date')
  const [startYear, setStartYear] = useState(summary.firstYear)
  const [endYear, setEndYear] = useState(summary.lastYear)
  const [showAverage, setShowAverage] = useState(true)
  const [highlightRecords, setHighlightRecords] = useState(true)
  const [hoveredYear, setHoveredYear] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState(summary.latestObserved.year)

  const observedPoints = useMemo(
    () => points.filter((point): point is KyotoBlossomObservedPoint => point.day !== null),
    [points]
  )
  const earliestYears = useMemo(
    () => new Set(summary.earliestEight.map((point) => point.year)),
    [summary.earliestEight]
  )
  const rankByYear = useMemo(() => {
    const ranks = new Map<number, number>()

    ;[...observedPoints]
      .sort((left, right) => {
        if (left.day === right.day) {
          return right.year - left.year
        }

        return left.day - right.day
      })
      .forEach((point, index) => {
        ranks.set(point.year, index + 1)
      })

    return ranks
  }, [observedPoints])

  const visiblePoints = useMemo(() => {
    return observedPoints.filter((point) => {
      if (point.year < startYear || point.year > endYear) {
        return false
      }

      return getMetricValue(point, metric) !== null
    })
  }, [endYear, metric, observedPoints, startYear])

  const visibleAverages = useMemo(() => {
    if (metric !== 'date' || !showAverage) {
      return []
    }

    return points.filter(
      (point) => point.average !== null && point.year >= startYear && point.year <= endYear
    )
  }, [endYear, metric, points, showAverage, startYear])

  const metricValues = useMemo(() => {
    const pointValues = visiblePoints
      .map((point) => getMetricValue(point, metric))
      .filter((value): value is number => value !== null)
    const averageValues =
      metric === 'date'
        ? visibleAverages
            .map((point) => point.average)
            .filter((value): value is number => value !== null)
        : [0]

    return [...pointValues, ...averageValues]
  }, [metric, visibleAverages, visiblePoints])

  const { yMin, yMax } = useMemo(() => {
    if (metricValues.length === 0) {
      return metric === 'date' ? { yMin: 80, yMax: 120 } : { yMin: -20, yMax: 20 }
    }

    if (metric === 'deviation') {
      const maxAbs = Math.max(...metricValues.map((value) => Math.abs(value)), 1)
      const roundedMax = Math.ceil((maxAbs + 1) / 5) * 5

      return {
        yMin: -roundedMax,
        yMax: roundedMax
      }
    }

    return {
      yMin: Math.floor((Math.min(...metricValues) - 2) / 5) * 5,
      yMax: Math.ceil((Math.max(...metricValues) + 2) / 5) * 5
    }
  }, [metric, metricValues])

  const xScale = (year: number) =>
    CHART_LEFT + ((year - startYear) / Math.max(endYear - startYear, 1)) * PLOT_WIDTH
  const yScale = (value: number) =>
    CHART_TOP + ((yMax - value) / Math.max(yMax - yMin, 1)) * PLOT_HEIGHT

  const positionedPoints = useMemo<PositionedPoint[]>(() => {
    return visiblePoints
      .map((point) => {
        const value = getMetricValue(point, metric)

        if (value === null) {
          return null
        }

        return {
          ...point,
          value,
          x: xScale(point.year),
          y: yScale(value)
        }
      })
      .filter((point): point is PositionedPoint => point !== null)
  }, [metric, visiblePoints, xScale, yScale])

  const averagePath = useMemo(() => {
    if (metric !== 'date' || visibleAverages.length === 0) {
      return ''
    }

    return buildPath(
      visibleAverages
        .filter((point): point is KyotoBlossomChartPoint & { average: number } => point.average !== null)
        .map((point) => ({
          x: xScale(point.year),
          y: yScale(point.average)
        }))
    )
  }, [metric, visibleAverages, xScale, yScale])

  const activePoint =
    positionedPoints.find((point) => point.year === hoveredYear) ??
    positionedPoints.find((point) => point.year === selectedYear) ??
    [...positionedPoints].sort((left, right) => right.year - left.year)[0]
  const activeYear = activePoint?.year ?? null
  const xTicks = createYearTicks(startYear, endYear)
  const yTicks = createValueTicks(yMin, yMax, metric)
  const pointRadius = getPointRadius(positionedPoints.length)
  const baselineValue = metric === 'date' ? summary.pre1900Average : 0
  const baselineY = yScale(baselineValue)
  const latestClusterStart = clamp(xScale(2021), CHART_LEFT, CHART_LEFT + PLOT_WIDTH)
  const latestClusterEnd = clamp(xScale(summary.lastYear), CHART_LEFT, CHART_LEFT + PLOT_WIDTH)
  const shouldShowLatestCluster = endYear >= 2021 && startYear <= summary.lastYear
  const latestClusterLabelX = clamp(
    latestClusterStart + 8,
    CHART_LEFT + 8,
    CHART_LEFT + PLOT_WIDTH - 8
  )
  const latestClusterLabelAnchor =
    latestClusterLabelX > CHART_LEFT + PLOT_WIDTH - 140 ? 'end' : 'start'

  function selectPreset(nextStartYear: number, nextEndYear: number) {
    setStartYear(nextStartYear)
    setEndYear(nextEndYear)
    setHoveredYear(null)
  }

  function resetChart() {
    setMetric('date')
    setStartYear(summary.firstYear)
    setEndYear(summary.lastYear)
    setShowAverage(true)
    setHighlightRecords(true)
    setHoveredYear(null)
    setSelectedYear(summary.latestObserved.year)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current

    if (!svg || positionedPoints.length === 0) {
      return
    }

    const bounds = svg.getBoundingClientRect()
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_WIDTH
    const pointerY = ((event.clientY - bounds.top) / bounds.height) * VIEWBOX_HEIGHT
    let nearestPoint = positionedPoints[0]
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const point of positionedPoints) {
      const distance = Math.hypot(point.x - pointerX, (point.y - pointerY) * 1.15)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestPoint = point
      }
    }

    setHoveredYear(nearestDistance < 42 ? nearestPoint.year : null)
  }

  function handleChartClick() {
    if (hoveredYear !== null) {
      setSelectedYear(hoveredYear)
    }
  }

  const activeAverageDelta =
    activePoint && activePoint.average !== null ? activePoint.day - activePoint.average : null
  const activePre1900Delta = activePoint ? activePoint.day - summary.pre1900Average : null
  const activeRank = activePoint ? rankByYear.get(activePoint.year) : undefined

  return (
    <div className="kyoto-blossom-explorer blog-wide-figure">
      <div className="kyoto-blossom-statbar" aria-label="Kyoto blossom record summary">
        <div>
          <span>Span</span>
          <strong>{summary.firstYear}-{summary.lastYear}</strong>
        </div>
        <div>
          <span>Observed seasons</span>
          <strong>{summary.observedCount}</strong>
        </div>
        <div>
          <span>Latest bloom</span>
          <strong>
            {summary.latestObserved.year}: day {summary.latestObserved.day}
          </strong>
        </div>
        <div>
          <span>2021-2026 signal</span>
          <strong>{summary.earliestEightSince2021} of top 8 earliest</strong>
        </div>
      </div>

      <div className="kyoto-blossom-toolbar" aria-label="Kyoto blossom chart controls">
        <div className="kyoto-blossom-segmented" aria-label="Chart mode">
          <button
            className={metric === 'date' ? 'is-active' : undefined}
            type="button"
            onClick={() => setMetric('date')}>
            Bloom date
          </button>
          <button
            className={metric === 'deviation' ? 'is-active' : undefined}
            type="button"
            onClick={() => setMetric('deviation')}>
            Deviation
          </button>
        </div>

        <div className="kyoto-blossom-segmented" aria-label="Time range presets">
          <button type="button" onClick={() => selectPreset(summary.firstYear, 1275)}>
            812-1275
          </button>
          <button type="button" onClick={() => selectPreset(summary.firstYear, summary.lastYear)}>
            Full
          </button>
          <button type="button" onClick={() => selectPreset(1900, summary.lastYear)}>
            1900-now
          </button>
          <button type="button" onClick={() => selectPreset(1980, summary.lastYear)}>
            1980-now
          </button>
        </div>

        <div className="kyoto-blossom-toggle-row">
          <label className="kyoto-blossom-toggle">
            <input
              checked={showAverage}
              disabled={metric === 'deviation'}
              type="checkbox"
              onChange={(event) => setShowAverage(event.target.checked)}
            />
            <span>30-year average</span>
          </label>
          <label className="kyoto-blossom-toggle">
            <input
              checked={highlightRecords}
              type="checkbox"
              onChange={(event) => setHighlightRecords(event.target.checked)}
            />
            <span>Record cluster</span>
          </label>
        </div>

        <div className="kyoto-blossom-action-row">
          <a className="kyoto-blossom-icon-link" href={source.downloadUrl} download>
            <FiDownload aria-hidden="true" />
            <span>Data</span>
          </a>
          <button className="kyoto-blossom-icon-button" type="button" onClick={resetChart}>
            <FiRotateCcw aria-hidden="true" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="kyoto-blossom-range-grid">
        <label>
          <span>Start</span>
          <input
            max={endYear - 1}
            min={summary.firstYear}
            step={1}
            type="range"
            value={startYear}
            onChange={(event) => setStartYear(Number(event.target.value))}
          />
          <strong>{startYear}</strong>
        </label>
        <label>
          <span>End</span>
          <input
            max={summary.lastYear}
            min={startYear + 1}
            step={1}
            type="range"
            value={endYear}
            onChange={(event) => setEndYear(Number(event.target.value))}
          />
          <strong>{endYear}</strong>
        </label>
      </div>

      <div className="kyoto-blossom-chart-grid">
        <div className="kyoto-blossom-svg-panel">
          <svg
            ref={svgRef}
            aria-describedby={descId}
            aria-label={`Kyoto cherry blossom peak dates, ${startYear} to ${endYear}`}
            className="kyoto-blossom-svg"
            role="img"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            onClick={handleChartClick}
            onPointerLeave={() => setHoveredYear(null)}
            onPointerMove={handlePointerMove}>
            <desc id={descId}>
              Interactive scatter plot of observed Kyoto peak cherry blossom dates and their
              thirty-year average.
            </desc>

            <rect
              className="kyoto-blossom-plot-bg"
              height={PLOT_HEIGHT}
              width={PLOT_WIDTH}
              x={CHART_LEFT}
              y={CHART_TOP}
            />

            {shouldShowLatestCluster ? (
              <g>
                <rect
                  className="kyoto-blossom-cluster-band"
                  height={PLOT_HEIGHT}
                  width={Math.max(latestClusterEnd - latestClusterStart, 0)}
                  x={latestClusterStart}
                  y={CHART_TOP}
                />
                <text
                  className="kyoto-blossom-cluster-label"
                  textAnchor={latestClusterLabelAnchor}
                  x={latestClusterLabelX}
                  y={CHART_TOP + 18}>
                  2021-2026 cluster
                </text>
              </g>
            ) : null}

            {yTicks.map((tick) => {
              const y = yScale(tick)

              return (
                <g key={`y-${tick}`}>
                  <line
                    className="kyoto-blossom-grid-line"
                    x1={CHART_LEFT}
                    x2={CHART_LEFT + PLOT_WIDTH}
                    y1={y}
                    y2={y}
                  />
                  <text className="kyoto-blossom-axis-label" x={CHART_LEFT - 12} y={y + 4}>
                    {metric === 'date' ? Math.round(tick) : formatSignedNumber(tick)}
                  </text>
                </g>
              )
            })}

            {xTicks.map((tick) => {
              const x = xScale(tick)

              return (
                <g key={`x-${tick}`}>
                  <line
                    className="kyoto-blossom-grid-line kyoto-blossom-grid-line-vertical"
                    x1={x}
                    x2={x}
                    y1={CHART_TOP}
                    y2={CHART_TOP + PLOT_HEIGHT}
                  />
                  <text
                    className="kyoto-blossom-axis-label"
                    textAnchor="middle"
                    x={x}
                    y={CHART_TOP + PLOT_HEIGHT + 32}>
                    {tick}
                  </text>
                </g>
              )
            })}

            <line
              className="kyoto-blossom-baseline"
              x1={CHART_LEFT}
              x2={CHART_LEFT + PLOT_WIDTH}
              y1={baselineY}
              y2={baselineY}
            />
            <text
              className="kyoto-blossom-baseline-label"
              x={CHART_LEFT + PLOT_WIDTH - 10}
              y={baselineY - 8}>
              {metric === 'date' ? 'pre-1900 mean' : '30-year norm'}
            </text>

            {averagePath ? <path className="kyoto-blossom-average-line" d={averagePath} /> : null}

            <g>
              {positionedPoints.map((point) => {
                const isRecordPoint = earliestYears.has(point.year)
                const isActive = point.year === activeYear

                return (
                  <circle
                    key={`${point.year}-${metric}`}
                    className={isActive ? 'kyoto-blossom-point is-active' : 'kyoto-blossom-point'}
                    cx={point.x}
                    cy={point.y}
                    fill={getPointColor(point, metric)}
                    opacity={getPointOpacity(point, activeYear)}
                    r={isActive ? pointRadius + 2.5 : pointRadius}
                  />
                )
              })}
            </g>

            {highlightRecords ? (
              <g>
                {positionedPoints
                  .filter((point) => earliestYears.has(point.year))
                  .map((point) => (
                    <circle
                      key={`record-${point.year}-${metric}`}
                      className="kyoto-blossom-record-ring"
                      cx={point.x}
                      cy={point.y}
                      r={pointRadius + 5.5}
                    />
                  ))}
              </g>
            ) : null}

            {activePoint ? (
              <g className="kyoto-blossom-crosshair">
                <line x1={activePoint.x} x2={activePoint.x} y1={CHART_TOP} y2={CHART_TOP + PLOT_HEIGHT} />
                <line x1={CHART_LEFT} x2={CHART_LEFT + PLOT_WIDTH} y1={activePoint.y} y2={activePoint.y} />
                <text
                  className="kyoto-blossom-active-label"
                  x={clamp(activePoint.x + 12, CHART_LEFT + 10, CHART_LEFT + PLOT_WIDTH - 170)}
                  y={clamp(activePoint.y - 12, CHART_TOP + 18, CHART_TOP + PLOT_HEIGHT - 12)}>
                  {activePoint.year}: day {activePoint.day}
                </text>
              </g>
            ) : null}

            <text
              className="kyoto-blossom-axis-title"
              textAnchor="middle"
              x={CHART_LEFT + PLOT_WIDTH / 2}
              y={VIEWBOX_HEIGHT - 18}>
              Year
            </text>
            <text
              className="kyoto-blossom-axis-title"
              textAnchor="middle"
              transform={`translate(22 ${CHART_TOP + PLOT_HEIGHT / 2}) rotate(-90)`}>
              {metric === 'date' ? 'Day of year' : 'Days from norm'}
            </text>
          </svg>
        </div>

        <aside className="kyoto-blossom-readout" aria-live="polite">
          {activePoint ? (
            <>
              <p className="kyoto-blossom-readout-kicker">Selected season</p>
              <h3>{activePoint.year}</h3>
              <p className="kyoto-blossom-readout-date">
                Day {activePoint.day}, roughly {formatBloomDate(activePoint.year, activePoint.day)}
              </p>
              <dl>
                <div>
                  <dt>Rank</dt>
                  <dd>
                    {activeRank ? getRankLabel(activeRank) : 'Unranked'} earliest of{' '}
                    {summary.observedCount}
                  </dd>
                </div>
                <div>
                  <dt>Local norm</dt>
                  <dd>
                    {activeAverageDelta === null
                      ? 'No 30-year average'
                      : formatDelta(activeAverageDelta)}
                  </dd>
                </div>
                <div>
                  <dt>Pre-1900 mean</dt>
                  <dd>
                    {activePre1900Delta === null
                      ? 'No comparison'
                      : formatDelta(activePre1900Delta)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p>No observed blossom years in this range.</p>
          )}
        </aside>
      </div>

      <div className="kyoto-blossom-caption">
        <p>
          Latest update: {source.lastUpdated ?? 'unknown'}. Data downloaded:{' '}
          {source.dateDownloaded ?? 'unknown'}. Source:{' '}
          <a href={source.originalChartUrl} target="_blank" rel="noreferrer">
            Our World in Data
          </a>{' '}
          using Yasuyuki Aono's Kyoto full-bloom record. Original archive:{' '}
          <a href={source.originalSourceUrl} target="_blank" rel="noreferrer">
            NOAA NCEI Paleoclimatology
          </a>
          .
        </p>
        {source.note ? <p>{source.note}</p> : null}
      </div>
    </div>
  )
}
