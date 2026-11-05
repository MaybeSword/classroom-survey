import type { SurveyStatus } from '../lib/types'

// Text label + symbol + color, so status never depends on color alone (UI.md §13).
const STYLES: Record<SurveyStatus, { label: string; symbol: string; cls: string }> = {
  draft: { label: 'Draft', symbol: '✎', cls: 'border-slate-500 bg-slate-100 text-slate-900' },
  active: { label: 'Active', symbol: '●', cls: 'border-green-800 bg-green-100 text-green-900' },
  closed: { label: 'Closed', symbol: '■', cls: 'border-amber-800 bg-amber-100 text-amber-900' },
  archived: { label: 'Archived', symbol: '▣', cls: 'border-slate-600 bg-white text-slate-800' },
}

export function StatusBadge({ status }: { status: SurveyStatus }) {
  const s = STYLES[status]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-semibold ${s.cls}`}
    >
      <span aria-hidden="true">{s.symbol}</span>
      <span>
        <span className="sr-only">Status: </span>
        {s.label}
      </span>
    </span>
  )
}
