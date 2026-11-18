import { DAMAGE_TYPES, type ActionPreview } from '../sim/core/types'
import { num, pct, words } from './field'

export function Damage({ preview, health, target }: { preview: ActionPreview; health: number; target: string }) {
  const { damage: d } = preview
  const total = DAMAGE_TYPES.reduce((sum, type) => sum + d.postDefence[type], 0)
  return <section className="damage-card"><div className="section-title"><div><small>Target health</small><h3>{health} HP</h3></div>
    <div className="hit-value" aria-label={'Applied hit against ' + target}><strong>{d.applied}</strong><small>Applied hit</small></div></div>
    <table><thead><tr><th>Damage stage</th>{DAMAGE_TYPES.map(t => <th key={t}>{words(t)}</th>)}</tr></thead>
    <tbody>{([
      ['Base + flats', d.baseAndFlat, num], ['After conversion', d.converted, num], ['Additive boost', d.boosts, pct],
      ['Multiplier product', d.multipliers, (n: number) => '×' + n.toFixed(2)], ['Target reduction', d.reductions, pct], ['After defence', d.postDefence, num]
    ] as const).map(([label, values, format]) => <tr key={label}><th>{label}</th>{DAMAGE_TYPES.map(t => <td key={t} title={String(values[t])}>{format(values[t])}</td>)}</tr>)}</tbody></table>
    <p>{d.conversions.length ? d.conversions.map(c => pct(c.effective) + ' ' + c.from + ' → ' + c.to + ' (' + pct(c.requested) + ' requested)').join(' · ') : 'No conversion'}.</p>
    <p>Boosts add by final type. Independent multipliers multiply.</p>
    <div className="totals"><div><small>Round once</small><b title={String(total)}>{num(total)} → {d.calculated}</b></div>
      <div><small>Clamp to health</small><b>min({d.calculated}, {health}) = {d.applied}</b></div></div>
  </section>
}
