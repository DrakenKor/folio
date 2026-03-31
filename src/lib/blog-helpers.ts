export const BLOG_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

interface BlogDateParts {
  year: number
  month: number
  day: number
}

function assertRealDate({ year, month, day }: BlogDateParts, value: string) {
  const normalizedDate = new Date(Date.UTC(year, month - 1, day))

  if (
    normalizedDate.getUTCFullYear() !== year ||
    normalizedDate.getUTCMonth() !== month - 1 ||
    normalizedDate.getUTCDate() !== day
  ) {
    throw new Error(`Invalid blog date "${value}".`)
  }

  return normalizedDate
}

export function parseBlogDate(value: string): BlogDateParts {
  if (!BLOG_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid blog date "${value}".`)
  }

  const [year, month, day] = value.split('-').map(Number)

  assertRealDate({ year, month, day }, value)

  return {
    year,
    month,
    day
  }
}

export function formatBlogDate(value: string, locale = 'en-US'): string {
  const { year, month, day } = parseBlogDate(value)

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function getBlogYearValue(value: string): string {
  parseBlogDate(value)
  return value.slice(0, 4)
}

export function getBlogMonthValue(value: string): string {
  parseBlogDate(value)
  return value.slice(0, 7)
}

export function getBlogMonthNumber(value: string): string {
  parseBlogDate(value)
  return value.slice(5, 7)
}

export function matchesSelectedBlogTags(
  postTagSlugs: string[],
  selectedTags: string[]
): boolean {
  return (
    selectedTags.length === 0 ||
    selectedTags.every((selectedTag) => postTagSlugs.includes(selectedTag))
  )
}

export function formatBlogMonthValue(value: string, locale = 'en-US'): string {
  const [year, month] = value.split('-').map(Number)

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid blog month "${value}".`)
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, 1)))
}

export function formatBlogMonthName(value: string, locale = 'en-US'): string {
  const month = Number(value)

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid blog month number "${value}".`)
  }

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(2026, month - 1, 1)))
}

export function slugifyTag(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function slugifyHeading(value: string): string {
  return slugifyTag(value) || 'section'
}
