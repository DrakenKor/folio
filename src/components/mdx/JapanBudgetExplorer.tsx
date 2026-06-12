import fs from 'node:fs'
import path from 'node:path'
import {
  JapanBudgetExplorerClient,
  type JapanBudgetSummary,
  type JapanBudgetYear,
  type JapanWorkersYear
} from './JapanBudgetExplorerClient'

const DATA_PATH = path.join(
  process.cwd(),
  'public',
  'blog',
  'jp-household-budget',
  'jp-household-budget.json'
)
const DOWNLOAD_URL = '/blog/jp-household-budget/jp-household-budget.json'
const SOURCE_URL =
  'https://www.e-stat.go.jp/en/stat-search/files?page=1&layout=datalist&toukei=00200561&tstat=000000330001&cycle=7&tclass1=000000330001&tclass2=000000330019&tclass3=000000330021&tclass4val=0'

interface JapanBudgetData {
  totalHouseholds: JapanBudgetYear[]
  workersHouseholds: JapanWorkersYear[]
}

function roundTo(value: number, digits = 1): number {
  const scale = 10 ** digits
  return Math.round(value * scale) / scale
}

function buildSummary(data: JapanBudgetData): JapanBudgetSummary {
  const firstBudget = data.totalHouseholds[0]
  const lastBudget = data.totalHouseholds[data.totalHouseholds.length - 1]
  const firstWorkers = data.workersHouseholds[0]
  const lastWorkers = data.workersHouseholds[data.workersHouseholds.length - 1]

  return {
    firstYear: firstBudget.year,
    lastYear: lastBudget.year,
    engelFirst: firstBudget.engel,
    engelLast: lastBudget.engel,
    totalFirst: firstBudget.total,
    totalLast: lastBudget.total,
    personsFirst: firstBudget.persons,
    personsLast: lastBudget.persons,
    apcFirst: roundTo((firstWorkers.consumption / firstWorkers.disposableIncome) * 100),
    apcLast: roundTo((lastWorkers.consumption / lastWorkers.disposableIncome) * 100)
  }
}

export function JapanBudgetExplorer() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')) as JapanBudgetData

  return (
    <JapanBudgetExplorerClient
      budgetYears={data.totalHouseholds}
      workersYears={data.workersHouseholds}
      summary={buildSummary(data)}
      source={{ downloadUrl: DOWNLOAD_URL, sourceUrl: SOURCE_URL }}
    />
  )
}
