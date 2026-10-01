export interface TimelineRole {
  id: string
  company: string
  position: string
  location: string
  // The city alone, for the place rings
  place: string
  start: Date
  end: Date
  // True while the role has no end date in the data
  current: boolean
  description: string
  achievements: string[]
  technologies: string[]
}

// The data's description, capped at four sentences
export const capSentences = (text: string, max = 4) =>
  (text.match(/[^.!?]+[.!?]*\s*/g) ?? [text]).slice(0, max).join('').trim()

const datesOf = (role: TimelineRole) => {
  const from = role.start.getUTCFullYear()
  const to = role.current ? 'now' : role.end.getUTCFullYear()
  return from === to ? String(from) : `${from} to ${to}`
}

interface RoleArticleProps {
  role: TimelineRole
  active: boolean
  // Set while a technology is chosen: whether this role used it
  match: boolean | null
  tech: string | null
  onTech: (tech: string | null) => void
}

export function RoleArticle({ role, active, match, tech, onTech }: RoleArticleProps) {
  const headingId = `${role.id}-title`
  return (
    <article
      id={role.id}
      className="timeline-role"
      aria-labelledby={headingId}
      data-active={active ? 'true' : 'false'}
      data-match={match === null ? undefined : String(match)}>
      <p className="timeline-dates">{datesOf(role)}</p>
      <h2 id={headingId}>{role.company}</h2>
      <p>
        {role.position}, {role.location}
      </p>
      <p>{role.description}</p>
      <ul className="timeline-achievements">
        {role.achievements.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <ul className="timeline-tech" aria-label="Technologies">
        {role.technologies.map(name => (
          <li key={name}>
            <button type="button" aria-pressed={tech === name} onClick={() => onTech(tech === name ? null : name)}>
              {name}
            </button>
          </li>
        ))}
      </ul>
    </article>
  )
}
