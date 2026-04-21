import fs from 'node:fs'
import path from 'node:path'
import {
  KyotoBlossomExplorerClient,
  type KyotoBlossomChartPoint,
  type KyotoBlossomChartSource,
  type KyotoBlossomChartSummary,
  type KyotoBlossomObservedPoint
} from './KyotoBlossomExplorerClient'

const DATA_DIRECTORY = path.join(
  process.cwd(),
  'public',
  'blog',
  'kyoto-blossoms'
)
const PUBLIC_DATA_DIRECTORY = '/blog/kyoto-blossoms'

const CSV_FILE_NAME = 'date-of-the-peak-cherry-tree-blossom-in-kyoto.csv'
const METADATA_FILE_NAME = 'date-of-the-peak-cherry-tree-blossom-in-kyoto.metadata.json'
const DATA_PACKAGE_FILE_NAME = 'kyoto-blossom-data-package.zip'

interface KyotoBlossomMetadata {
  chart?: {
    citation?: string
    note?: string
    originalChartUrl?: string
  }
  columns?: Record<
    string,
    {
      citationShort?: string
      fullMetadata?: string
      lastUpdated?: string
      nextUpdate?: string
      timespan?: string
    }
  >
  dateDownloaded?: string
}

function parseCsvLine(line: string): string[] {
  const columns: string[] = []
  let currentColumn = ''
  let isInsideQuotedValue = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"' && isInsideQuotedValue && nextCharacter === '"') {
      currentColumn += '"'
      index += 1
      continue
    }

    if (character === '"') {
      isInsideQuotedValue = !isInsideQuotedValue
      continue
    }

    if (character === ',' && !isInsideQuotedValue) {
      columns.push(currentColumn)
      currentColumn = ''
      continue
    }

    currentColumn += character
  }

  columns.push(currentColumn)
  return columns
}

function parseNumber(value: string): number | null {
  const trimmedValue = value.trim()

  if (!trimmedValue) {
    return null
  }

  const numberValue = Number(trimmedValue)
  return Number.isFinite(numberValue) ? numberValue : null
}

function readKyotoBlossomData(): KyotoBlossomChartPoint[] {
  const csvPath = path.join(DATA_DIRECTORY, CSV_FILE_NAME)
  const csv = fs.readFileSync(csvPath, 'utf8').trim()
  const [headerLine, ...lines] = csv.split(/\r?\n/)
  const headers = parseCsvLine(headerLine)
  const yearIndex = headers.indexOf('Year')
  const dayIndex = headers.indexOf('Day of the year with peak cherry blossom')
  const averageIndex = headers.indexOf('Thirty-year average')

  if (yearIndex === -1 || dayIndex === -1 || averageIndex === -1) {
    throw new Error('Kyoto blossom CSV is missing one or more required columns.')
  }

  return lines
    .map((line) => {
      const columns = parseCsvLine(line)
      const year = parseNumber(columns[yearIndex])

      if (year === null) {
        return null
      }

      return {
        year,
        day: parseNumber(columns[dayIndex]),
        average: parseNumber(columns[averageIndex])
      }
    })
    .filter((point): point is KyotoBlossomChartPoint => point !== null)
}

function readKyotoBlossomMetadata(): KyotoBlossomMetadata {
  const metadataPath = path.join(DATA_DIRECTORY, METADATA_FILE_NAME)
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as KyotoBlossomMetadata
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundTo(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function getObservedPoints(points: KyotoBlossomChartPoint[]): KyotoBlossomObservedPoint[] {
  return points.filter(
    (point): point is KyotoBlossomObservedPoint => point.day !== null
  )
}

function buildSummary(points: KyotoBlossomChartPoint[]): KyotoBlossomChartSummary {
  const observedPoints = getObservedPoints(points)
  const sortedObservedPoints = [...observedPoints].sort((left, right) => {
    if (left.day === right.day) {
      return right.year - left.year
    }

    return left.day - right.day
  })
  const latestObserved = [...observedPoints].sort((left, right) => right.year - left.year)[0]
  const pre1900Points = observedPoints.filter((point) => point.year < 1900)
  const modernPoints = observedPoints.filter((point) => point.year >= 1900)
  const latestThirtyYearPoints = observedPoints.filter(
    (point) => point.year >= latestObserved.year - 29 && point.year <= latestObserved.year
  )
  const earliestEight = sortedObservedPoints.slice(0, 8)
  const earliestEightSince2021 = earliestEight.filter((point) => point.year >= 2021).length
  const recordLatest = [...observedPoints].sort((left, right) => {
    if (left.day === right.day) {
      return right.year - left.year
    }

    return right.day - left.day
  })[0]
  const firstYear = Math.min(...points.map((point) => point.year))
  const lastYear = Math.max(...points.map((point) => point.year))
  const latestAverage = latestObserved.average ?? average(latestThirtyYearPoints.map((point) => point.day))
  const pre1900Average = average(pre1900Points.map((point) => point.day))

  return {
    firstYear,
    lastYear,
    observedCount: observedPoints.length,
    latestObserved,
    recordEarliest: sortedObservedPoints[0],
    recordLatest,
    earliestEight,
    earliestEightSince2021,
    latestAverage: roundTo(latestAverage),
    latestDeviationFromAverage: roundTo(latestObserved.day - latestAverage),
    latestDeviationFromPre1900Average: roundTo(latestObserved.day - pre1900Average),
    latestThirtyYearAverage: roundTo(average(latestThirtyYearPoints.map((point) => point.day))),
    modernAverage: roundTo(average(modernPoints.map((point) => point.day))),
    pre1900Average: roundTo(pre1900Average),
    recentObservedCount: latestThirtyYearPoints.length
  }
}

function buildSource(metadata: KyotoBlossomMetadata): KyotoBlossomChartSource {
  const dayColumn = metadata.columns?.['Day of the year with peak cherry blossom']

  return {
    citation:
      dayColumn?.citationShort ??
      metadata.chart?.citation ??
      'Yasuyuki Aono; with processing by Our World in Data',
    originalChartUrl:
      metadata.chart?.originalChartUrl ??
      'https://ourworldindata.org/grapher/date-of-the-peak-cherry-tree-blossom-in-kyoto',
    originalSourceUrl: 'https://www.ncei.noaa.gov/access/paleo-search/study/26430',
    downloadUrl: `${PUBLIC_DATA_DIRECTORY}/${DATA_PACKAGE_FILE_NAME}`,
    fullMetadataUrl: dayColumn?.fullMetadata,
    dateDownloaded: metadata.dateDownloaded,
    lastUpdated: dayColumn?.lastUpdated,
    nextUpdate: dayColumn?.nextUpdate,
    note: metadata.chart?.note
  }
}

export function KyotoBlossomExplorer() {
  const points = readKyotoBlossomData()
  const metadata = readKyotoBlossomMetadata()

  return (
    <KyotoBlossomExplorerClient
      points={points}
      source={buildSource(metadata)}
      summary={buildSummary(points)}
    />
  )
}
