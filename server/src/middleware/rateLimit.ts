import type { NextFunction, Request, Response } from 'express'

type RateLimitOptions = {
  windowMs: number
  max: number
  message: string
}

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

function clientKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now()
    const key = `${clientKey(req)}:${req.method}:${req.path}`
    const bucket = buckets.get(key)

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }

    bucket.count += 1
    if (bucket.count <= options.max) {
      next()
      return
    }

    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    res.setHeader('Retry-After', String(retryAfter))
    res.status(429).json({
      success: false,
      error: options.message,
    })
  }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}, 60_000).unref()
