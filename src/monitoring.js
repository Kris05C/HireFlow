export function captureFrontendError(error, context = {}) {
  const monitoring = globalThis.__HIREFLOW_MONITORING__
  const safeContext = Object.fromEntries(
    Object.entries(context).filter(([key]) => !/token|secret|password|authorization|cookie|email/i.test(key)),
  )
  if (typeof monitoring?.captureException === 'function') {
    monitoring.captureException(error, safeContext)
  }
}

export function installFrontendMonitoring() {
  if (typeof window === 'undefined') return () => {}
  const onError = (event) => captureFrontendError(event.error || new Error(event.message), { source: 'window' })
  const onUnhandledRejection = (event) => captureFrontendError(event.reason, { source: 'unhandledrejection' })
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }
}
