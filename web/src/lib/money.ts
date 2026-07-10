// Money is stored as integer satang everywhere; THB formatting happens only
// at this display edge (see CLAUDE.md money rule + docs/TECH.md).
const SATANG_PER_BAHT = 100

export function formatTHB(satang: number): string {
  const sign = satang < 0 ? '-' : ''
  const absSatang = Math.abs(satang)
  const baht = absSatang / SATANG_PER_BAHT
  const hasCents = absSatang % SATANG_PER_BAHT !== 0
  const formatted = baht.toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `${sign}฿${formatted}`
}
