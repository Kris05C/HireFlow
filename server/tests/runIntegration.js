process.env.RUN_DB_INTEGRATION_TESTS = 'true'
process.env.NODE_ENV = 'test'
await import('./integration.test.js')
