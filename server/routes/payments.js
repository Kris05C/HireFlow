import { Router } from 'express'

export function createPaymentsRouter() {
  const router = Router()
  router.post('/orders', (_req, res) => res.status(503).json({
    error: 'PhonePe checkout is not configured. No payment has been initiated.',
    code: 'PAYMENTS_NOT_CONFIGURED',
  }))
  router.get('/orders/:orderId', (_req, res) => res.status(503).json({
    error: 'Payment status cannot be checked until PhonePe is configured.',
    code: 'PAYMENTS_NOT_CONFIGURED',
  }))
  return router
}