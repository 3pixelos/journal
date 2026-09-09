import { Field } from './ui'

const FIELDS = [
  { key: 'setup', label: 'Setup / strategy', ph: 'What was the setup? Which plan did this belong to?' },
  { key: 'reasoning', label: 'Reasoning', ph: 'Why did you take it? What was the trigger and the invalidation?' },
  { key: 'emotions', label: 'Emotions / mental state', ph: 'Calm? Rushed? Revenge-trading? Bored?' },
  { key: 'mistakes', label: 'Mistakes', ph: 'What broke the plan?' },
  { key: 'improvements', label: "What I'd do differently", ph: 'One concrete change for next time.' },
]

export default function JournalFields({ value, onChange, rows = 3 }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <>
      {FIELDS.map((f) => (
        <Field key={f.key} label={f.label}>
          <textarea
            rows={rows}
            value={value[f.key] || ''}
            onChange={set(f.key)}
            placeholder={f.ph}
          />
        </Field>
      ))}
    </>
  )
}

export { FIELDS as JOURNAL_FIELDS }
