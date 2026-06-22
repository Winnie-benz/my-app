import path from 'path'
import os from 'os'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

import { getBackupPath } from '../services/backup'

function getBackupStatus() {
  const USE_REMOTE = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN)
  return { mode: USE_REMOTE ? 'turso' : 'local' }
}

async function exportSnapshot() {
  const backupModule = await import('../services/backup')
  const filename = `export_${Date.now()}.db`
  const filePath = getBackupPath(filename) ?? `/tmp/${filename}`
  return { filePath, filename, cleanupDir: require('path').dirname(filePath) }
}

const execFileAsync = promisify(execFile)

function env(name: string, fallback = ''): string {
  return (process.env[name] ?? fallback).trim()
}

function requireValue(name: string, fallback = ''): string {
  const value = env(name, fallback)
  if (!value) throw new Error(`${name} is required`)
  return value
}

async function run(command: string, args: string[]) {
  const { stdout, stderr } = await execFileAsync(command, args, {
    maxBuffer: 10 * 1024 * 1024,
  })
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr.trim()) process.stderr.write(stderr)
}

async function main() {
  const exportOnly = process.argv.includes('--export-only')
  const backup = getBackupStatus()
  const rcloneBin = requireValue('RCLONE_BIN', 'rclone')
  const remoteName = requireValue('GDRIVE_RCLONE_REMOTE', 'gdrive')
  const folder = requireValue('GDRIVE_BACKUP_FOLDER', 'my-app-backups')
  const subdir = env('GDRIVE_BACKUP_SUBDIR', os.hostname()) || os.hostname()
  const retentionDays = Number(env('GDRIVE_BACKUP_RETENTION_DAYS', '90')) || 90
  const remoteRoot = `${remoteName}:${folder}/${subdir}/${backup.mode}`

  console.log(`▶ Export mode       : ${backup.mode}`)
  console.log(`▶ Google account    : ${env('GDRIVE_BACKUP_ACCOUNT', 'winnieoptic@gmail.com') || '-'}`)
  console.log(`▶ Google Drive path : ${remoteRoot}`)

  const snapshot = await exportSnapshot()
  console.log(`✅ Snapshot created  : ${snapshot.filePath}`)

  if (exportOnly) {
    console.log('ℹ Export-only mode: skipping Google Drive upload')
    return
  }

  try {
    await run(rcloneBin, ['copyto', snapshot.filePath, `${remoteRoot}/${snapshot.filename}`])
    console.log(`✅ Uploaded         : ${remoteRoot}/${snapshot.filename}`)

    if (retentionDays > 0) {
      await run(rcloneBin, ['delete', remoteRoot, '--min-age', `${retentionDays}d`])
      console.log(`✅ Retention pruned : files older than ${retentionDays} days`)
    }
  } finally {
    try {
      fs.rmSync(snapshot.cleanupDir, { recursive: true, force: true })
    } catch {}
  }
}

main().catch(error => {
  console.error('❌ Google Drive backup failed')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
