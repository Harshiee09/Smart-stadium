 
export function loadClass(pct) {
  if (pct >= 90) return 'danger'
  if (pct >= 75) return 'warn'
  return 'ok'
}
export function loadColor(pct) {
  if (pct >= 90) return '#ff4444'
  if (pct >= 75) return '#ffb800'
  return '#00ff9d'
}
export function formatNum(n) {
  return typeof n === 'number' ? n.toLocaleString() : n
}
export function pct(occ, cap) {
  return Math.round((occ / cap) * 100)
}