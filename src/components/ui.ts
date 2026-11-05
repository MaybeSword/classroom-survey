/** Shared Tailwind class strings. All color pairs meet WCAG AA contrast (4.5:1+). */
const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:opacity-100'
export const btn = {
  primary: `${base} bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-200`,
  secondary: `${base} border border-slate-400 bg-white text-slate-900 hover:bg-slate-100`,
  danger: `${base} bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-200`,
  small:
    'inline-flex min-h-11 items-center rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:opacity-100',
  smallDanger:
    'inline-flex min-h-11 items-center rounded-md border border-red-700 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:opacity-100',
}
export const input =
  'mt-1 block w-full rounded-lg border border-slate-500 bg-white px-3 py-2 text-base text-slate-900 aria-[invalid=true]:border-red-700'
export const label = 'block font-medium text-slate-900'
export const fieldError = 'mt-1 text-sm font-medium text-red-800'
