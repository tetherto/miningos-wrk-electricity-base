'use strict'

const test = require('brittle')
const { createServer } = require('../../mock/server')
const WrkElectricityBase = require('../../workers/base.electricity.wrk')
const { DATE_RANGE } = require('../../workers/lib/constants')

let mockServer
let worker

test('setup', async (t) => {
  // Start mock server
  mockServer = createServer({
    host: '127.0.0.1',
    port: 8000,
    delay: 0,
    error: false
  })

  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 100))

  worker = Object.create(WrkElectricityBase.prototype)
  worker.conf = {
    electricity: {
      api: {
        baseUrl: 'http://127.0.0.1:8000'
      }
    }
  }

  worker.logger = {
    error: () => {},
    info: () => {},
    debug: () => {}
  }

  // Mock store
  const mockBee = {
    ready: async () => {},
    sub: (name) => {
      const db = new Map()
      return {
        put: async (key, value) => {
          db.set(key.toString('hex'), value)
        },
        createReadStream: (query) => {
          return (async function * () {
            for (const [key, value] of db.entries()) {
              const keyBuffer = Buffer.from(key, 'hex')
              if (query.gte && Buffer.compare(keyBuffer, query.gte) < 0) continue
              if (query.lte && Buffer.compare(keyBuffer, query.lte) > 0) continue
              yield { value }
            }
          })()
        }
      }
    }
  }

  worker.store_s1 = {
    getBee: async () => mockBee
  }

  // Mock HTTP client
  const http = require('http')
  worker.http_0 = {
    get: async (path, options) => {
      return new Promise((resolve, reject) => {
        const url = new URL(path, worker.conf.electricity.api.baseUrl)
        const req = http.get(url, { timeout: options.timeout }, (res) => {
          let data = ''
          res.on('data', chunk => { data += chunk })
          res.on('end', () => {
            try {
              const body = JSON.parse(data)
              resolve({ body })
            } catch (e) {
              reject(e)
            }
          })
        })
        req.on('error', reject)
        req.on('timeout', () => {
          req.destroy()
          reject(new Error('Request timeout'))
        })
      })
    }
  }

  // Mock scheduler
  worker.scheduler_f2 = {
    add: () => {}
  }

  // Mock parent class methods
  worker.setInitFacs = () => {}
  worker.loadConf = () => {}

  worker.api = new (require('../../workers/lib/electricity.api'))(worker.http_0)
  // Initialize database
  const db = await worker.store_s1.getBee({ name: 'main' }, { keyEncoding: 'binary' })
  await db.ready()
  worker.hourlyStatsDb = db.sub('hourly-stats')
})

test('integration - fetch and save hourly stats', async (t) => {
  const testTime = new Date('2024-01-15T10:30:00Z')

  await worker.saveHourlyStats(testTime)

  // Verify data was saved to DB
  const ts = testTime.getTime()
  const utilsStore = require('hp-svc-facs-store/utils')
  const key = utilsStore.convIntToBin(ts)

  const stream = worker.hourlyStatsDb.createReadStream({
    gte: key,
    lte: key
  })

  let found = false
  for await (const entry of stream) {
    const data = JSON.parse(entry.value.toString())
    t.is(data.ts, ts)
    t.ok(typeof data.usedPower === 'number')
    t.ok(typeof data.availablePower === 'number')
    found = true
  }

  t.ok(found, 'Data should be saved to database')
})

test('integration - get stats history with DAY range', async (t) => {
  // Save multiple hourly stats
  const times = [
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-15T11:00:00Z'),
    new Date('2024-01-16T10:00:00Z')
  ]

  for (const time of times) {
    await worker.saveHourlyStats(time)
  }

  // Get stats history grouped by day
  const result = await worker.getStatsHistory({
    start: new Date('2024-01-15T00:00:00Z').getTime(),
    end: new Date('2024-01-16T23:59:59Z').getTime(),
    groupRange: DATE_RANGE.DAY,
    fields: {}
  })

  t.ok(Array.isArray(result))
  t.ok(result.length >= 1, 'Should have at least one day of data')

  // Verify structure
  for (const item of result) {
    t.ok(item.ts, 'Should have timestamp')
    t.ok(item.energy, 'Should have energy object')
    t.ok(typeof item.energy.usedPower === 'number', 'Should have usedPower')
    t.ok(typeof item.energy.availablePower === 'number', 'Should have availablePower')
    t.ok(typeof item.energy.count === 'number', 'Should have count')
  }
})

test('integration - get stats history with MONTH range', async (t) => {
  // Save stats for different days in the same month
  const times = [
    new Date('2024-01-05T10:00:00Z'),
    new Date('2024-01-15T10:00:00Z'),
    new Date('2024-01-25T10:00:00Z')
  ]

  for (const time of times) {
    await worker.saveHourlyStats(time)
  }

  // Get stats history grouped by month
  const result = await worker.getStatsHistory({
    start: new Date('2024-01-01T00:00:00Z').getTime(),
    end: new Date('2024-01-31T23:59:59Z').getTime(),
    groupRange: DATE_RANGE.MONTH,
    fields: {}
  })

  t.ok(Array.isArray(result))
  t.ok(result.length >= 1, 'Should have at least one month of data')

  const janEntry = result.find(r => r.ts === new Date('2024-01-01T00:00:00Z').getTime())
  if (janEntry) {
    t.ok(janEntry.energy.count >= 3, 'Should aggregate multiple days')
  }
})

test('integration - getDbData with fields projection', async (t) => {
  if (!worker._projection) {
    worker._projection = (data, fields) => {
      return data.map(item => {
        const projected = {}
        for (const field of Object.keys(fields)) {
          if (item[field] !== undefined) {
            projected[field] = item[field]
          }
        }
        return projected
      })
    }
  }

  await worker.saveHourlyStats(new Date('2024-01-15T10:00:00Z'))

  const result = await worker.getDbData(worker.hourlyStatsDb, {
    start: new Date('2024-01-15T00:00:00Z').getTime(),
    end: new Date('2024-01-15T23:59:59Z').getTime(),
    fields: { ts: true, usedPower: true }
  })

  t.ok(Array.isArray(result))
  if (result.length > 0) {
    t.ok('ts' in result[0], 'Should have ts field')
    t.ok('usedPower' in result[0], 'Should have usedPower field')
  }
})

test('teardown', async (t) => {
  if (mockServer) {
    await mockServer.stop()
  }
})
