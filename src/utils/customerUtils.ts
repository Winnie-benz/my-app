export function calcAge(birthday: string): number {
  if (!birthday) return 0
  const today = new Date()
  const birth = new Date(birthday)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

export function padCustomerId(n: number): string {
  return String(n).padStart(6, '0')
}

export function formatDate(iso: string): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(date: string, time: string): string {
  if (!date) return '-'
  const d = formatDate(date)
  return time ? `${d} ${time}` : d
}
