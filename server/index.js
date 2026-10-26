import { assertServerConfig, config } from './config.js'
import { pool } from './db/pool.js'
import { createApp } from './app.js'

assertServerConfig()
const app = createApp(pool)
const server = app.listen(config.port, () => {
  console.info(`HireFlow API listening on port ${config.port}.`)
})

async function shutdown() {
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)