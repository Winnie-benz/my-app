import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import authRouter        from './routes/auth'
import productsRouter    from './routes/products'
import customersRouter   from './routes/customers'
import purchasesRouter   from './routes/purchases'
import purchasesAllRouter from './routes/purchasesAll'
import paymentsRouter    from './routes/payments'
import reportsRouter     from './routes/reports'
import adminRouter       from './routes/admin'
import inventoryRouter   from './routes/inventory'
import lensProductsRouter from './routes/lensProducts'
import claimsRouter          from './routes/claims'
import claimPaymentsRouter   from './routes/claimPayments'
import analyticsRouter       from './routes/analytics'
import { scheduleAutoBackup } from './services/backup'
import { syncFromTurso, USE_REMOTE } from './db/database'

const app  = express()
const PORT = Number(process.env.PORT) || 3001

// ── Middleware ────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',                            authRouter)
app.use('/api/products',                        productsRouter)
app.use('/api/customers',                       customersRouter)
app.use('/api/customers/:customerId/purchases', purchasesRouter)
app.use('/api/purchases',                       purchasesAllRouter)
app.use('/api/purchases/:purchaseId/payments',  paymentsRouter)
app.use('/api/reports',                         reportsRouter)
app.use('/api/admin',                           adminRouter)
app.use('/api/inventory',                       inventoryRouter)
app.use('/api/lens-products',                   lensProductsRouter)
app.use('/api/claims',                          claimsRouter)
app.use('/api/claims/:claimId/payments',        claimPaymentsRouter)
app.use('/api/analytics',                       analyticsRouter)

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

// ── Static frontend in production ─────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  // 404 API-only in dev (Vite handles frontend)
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' })
  })
}

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Server  →  http://localhost:${PORT}`)
  console.log(`   Env     →  ${process.env.NODE_ENV ?? 'development'}`)
  scheduleAutoBackup()

  if (USE_REMOTE) {
    void syncFromTurso()
    setInterval(() => { void syncFromTurso() }, 30_000)
  }
})
