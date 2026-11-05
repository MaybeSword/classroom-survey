/** Public student URL for a survey slug (D1, D20). */
export function publicSurveyUrl(slug: string, base?: string): string {
  const origin = (base || import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin).replace(
    /\/+$/,
    '',
  )
  return `${origin}/s/${encodeURIComponent(slug)}`
}
