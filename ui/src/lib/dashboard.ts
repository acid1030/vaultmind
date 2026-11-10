export function itemTags(value: string): string[] {
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return [...new Set(parsed.filter((tag): tag is string => typeof tag === 'string').map(tag => tag.trim()).filter(Boolean))] } catch { /* comma-separated legacy tags */ }
  return [...new Set(String(value || '').split(/[,，\s]+/).map(tag => tag.trim()).filter(Boolean))]
}
export function dailyCounts(values: string[], now = new Date()): number[] {
  const keys = Array.from({ length: 7 }, (_, i) => { const day = new Date(now); day.setDate(day.getDate() - 6 + i); return day.toDateString() })
  const result = keys.map(() => 0)
  for (const value of values) { const date = new Date(value); if (!value || !Number.isFinite(date.getTime()) || date.getTime() > now.getTime()) continue; const index = keys.indexOf(date.toDateString()); if (index >= 0) result[index]++ }
  return result
}
export function tagDistribution(items: { tags: string }[]) {
  const counts = new Map<string, number>()
  for (const item of items) for (const tag of itemTags(item.tags)) counts.set(tag, (counts.get(tag) || 0) + 1)
  return [...counts].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
