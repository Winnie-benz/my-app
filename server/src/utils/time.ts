export function thaiNowDate(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Current timestamp in Thai local time (Asia/Bangkok, UTC+7, no DST) formatted
 * as 'YYYY-MM-DD HH:MM:SS' — matches SQLite's datetime() text format.
 *
 * Needed because the database now runs on Turso cloud (UTC servers), where
 * SQLite's datetime('now','localtime') resolves to UTC, not Thai time. Pass the
 * result explicitly to INSERTs instead of relying on the column default.
 */
export function nowTH(): string {
  const d = thaiNowDate()
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

export function thaiDateKey(): string {
  const d = thaiNowDate()
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

export function thaiClockParts() {
  const d = thaiNowDate()
  return {
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  }
}
