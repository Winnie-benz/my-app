function isWeakSecret(value: string): boolean {
  const lowered = value.toLowerCase()
  return (
    value.length < 32 ||
    lowered.includes('change-this') ||
    lowered.includes('default') ||
    lowered.includes('secret') ||
    lowered.includes('password')
  )
}

export function validateProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return

  const errors: string[] = []
  const jwtSecret = process.env.JWT_SECRET ?? ''
  const corsOrigin = process.env.CORS_ORIGIN ?? ''
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? ''
  const tursoToken = process.env.TURSO_AUTH_TOKEN ?? ''

  if (isWeakSecret(jwtSecret)) {
    errors.push('JWT_SECRET must be a strong random value with at least 32 characters')
  }

  if (corsOrigin) {
    if (corsOrigin === '*') {
      errors.push('CORS_ORIGIN must not be "*" in production')
    }
    if (!corsOrigin.startsWith('https://')) {
      errors.push('CORS_ORIGIN should be an https:// origin in production')
    }
    if (corsOrigin.includes('localhost') || corsOrigin.includes('127.0.0.1')) {
      errors.push('CORS_ORIGIN must not point to localhost in production')
    }
  }

  if ((tursoUrl && !tursoToken) || (!tursoUrl && tursoToken)) {
    errors.push('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set together')
  }

  if (errors.length > 0) {
    console.warn(
      `⚠️  Production environment warnings (server will still start):\n- ${errors.join('\n- ')}`
    )
  }
}
