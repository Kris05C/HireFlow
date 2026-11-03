import { assertServerConfig, config } from './config.js'
import { pool } from './db/pool.js'
import { createApp } from './app.js'
import { logger } from './observability.js'

assertServerConfig()
const app = createApp(pool)
const server = app.listen(config.port, () => {
  logger.info('HireFlow API listening', { port: config.port })
})

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)