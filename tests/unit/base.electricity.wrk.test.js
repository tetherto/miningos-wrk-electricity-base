'use strict'

const test = require('brittle')
const WrkElectricityBase = require('../../workers/base.electricity.wrk')
const { DATE_RANGE } = require('../../workers/lib/constants')

function createMockWorker () {
  const worker = Object.create(WrkElectricityBase.prototype)
  worker.conf = {}
  worker.logger = { error: () => {}, info: () => {}, debug: () => {} }
  return worker
}

test('WrkElectricityBase - _saveToDb', async (t) => {
  const worker = createMockWorker()
  const mockDb = {
    put: async (key, value) => {
      t.ok(Buffer.isBuffer(key))
      t.ok(Buffer.isBuffer(value))
      const data = JSON.parse(value.toString())
      t.is(data.ts, 1234567890)
      t.is(data.test, 'value')
    }
  }

  await worker._saveToDb(mockDb, 1234567890, { ts: 1234567890, test: 'value' })
})

test('WrkElectricityBase - getDbData - success', async (t) => {
  const worker = createMockWorker()

  const mockData = [
    { ts: 1000, value: 'a' },
    { ts: 2000, value: 'b' },
    { ts: 3000, value: 'c' }
  ]

  const mockDb = {
    createReadStream: (query) => {
      t.ok(query.gte)
      t.ok(query.lte)
      return (async function * () {
        for (const data of mockData) {
          yield {
            value: Buffer.from(JSON.stringify(data))
          }
        }
      })()
    }
  }

  const result = await worker.getDbData(mockDb, {
    start: 1000,
    end: 3000
  })

  t.is(result.length, 3)
  t.alike(result, mockData)
})

test('WrkElectricityBase - getDbData - with fields projection', async (t) => {
  const worker = createMockWorker()

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

  const mockData = [
    { ts: 1000, value: 'a', extra: 'x' },
    { ts: 2000, value: 'b', extra: 'y' }
  ]

  const mockDb = {
    createReadStream: () => {
      return (async function * () {
        for (const data of mockData) {
          yield {
            value: Buffer.from(JSON.stringify(data))
          }
        }
      })()
    }
  }

  const result = await worker.getDbData(mockDb, {
    start: 1000,
    end: 2000,
    fields: { ts: true, value: true }
  })

  t.is(result.length, 2)
  t.is(result[0].ts, 1000)
  t.is(result[0].value, 'a')
  t.ok(result[0].extra === undefined)
})

test('WrkElectricityBase - getDbData - missing start', async (t) => {
  const worker = createMockWorker()

  await t.exception(async () => {
    await worker.getDbData({}, {
      end: 3000
    })
  }, 'ERR_START_INVALID')
})

test('WrkElectricityBase - getDbData - missing end', async (t) => {
  const worker = createMockWorker()

  await t.exception(async () => {
    await worker.getDbData({}, {
      start: 1000
    })
  }, 'ERR_END_INVALID')
})

test('WrkElectricityBase - getStatsHistory - DAY range', async (t) => {
  const worker = createMockWorker()

  // Use local dates to match getAggregationGroupKey behavior
  const date1 = new Date(2024, 0, 15, 10, 0, 0) // Jan 15, 2024 10:00 local
  const date2 = new Date(2024, 0, 15, 11, 0, 0) // Jan 15, 2024 11:00 local
  const date3 = new Date(2024, 0, 16, 10, 0, 0) // Jan 16, 2024 10:00 local

  const mockStats = [
    { ts: date1.getTime(), usedPower: 10, availablePower: 90 },
    { ts: date2.getTime(), usedPower: 20, availablePower: 80 },
    { ts: date3.getTime(), usedPower: 15, availablePower: 85 }
  ]

  worker.getDbData = async () => mockStats

  const result = await worker.getStatsHistory({
    start: new Date(2024, 0, 15, 0, 0, 0).getTime(),
    end: new Date(2024, 0, 16, 23, 59, 59).getTime(),
    groupRange: DATE_RANGE.DAY,
    fields: {}
  })

  t.is(result.length, 2)

  const { getAggregationGroupKey } = require('../../workers/lib/utils')
  const day1Key = getAggregationGroupKey(date1.getTime(), DATE_RANGE.DAY)
  const day2Key = getAggregationGroupKey(date3.getTime(), DATE_RANGE.DAY)

  const day1 = result.find(r => r.ts === day1Key)
  t.ok(day1)
  t.is(day1.energy.usedPower, 30)
  t.is(day1.energy.availablePower, 170)
  t.is(day1.energy.count, 2)

  // Check second day aggregation
  const day2 = result.find(r => r.ts === day2Key)
  t.ok(day2)
  t.is(day2.energy.usedPower, 15)
  t.is(day2.energy.availablePower, 85)
  t.is(day2.energy.count, 1)
})

test('WrkElectricityBase - getStatsHistory - MONTH range', async (t) => {
  const worker = createMockWorker()

  // Use local dates to match getAggregationGroupKey behavior
  const date1 = new Date(2024, 0, 5, 10, 0, 0) // Jan 5, 2024
  const date2 = new Date(2024, 0, 15, 10, 0, 0) // Jan 15, 2024
  const date3 = new Date(2024, 0, 25, 10, 0, 0) // Jan 25, 2024
  const date4 = new Date(2024, 1, 5, 10, 0, 0) // Feb 5, 2024

  const mockStats = [
    { ts: date1.getTime(), usedPower: 10, availablePower: 90 },
    { ts: date2.getTime(), usedPower: 20, availablePower: 80 },
    { ts: date3.getTime(), usedPower: 15, availablePower: 85 },
    { ts: date4.getTime(), usedPower: 30, availablePower: 70 }
  ]

  worker.getDbData = async () => mockStats

  const result = await worker.getStatsHistory({
    start: new Date(2024, 0, 1, 0, 0, 0).getTime(),
    end: new Date(2024, 1, 28, 23, 59, 59).getTime(),
    groupRange: DATE_RANGE.MONTH,
    fields: {}
  })

  t.is(result.length, 2)

  const { getAggregationGroupKey } = require('../../workers/lib/utils')
  const janKey = getAggregationGroupKey(date1.getTime(), DATE_RANGE.MONTH)
  const febKey = getAggregationGroupKey(date4.getTime(), DATE_RANGE.MONTH)

  const jan = result.find(r => r.ts === janKey)
  t.ok(jan)
  t.is(jan.energy.usedPower, 45)
  t.is(jan.energy.availablePower, 255)
  t.is(jan.energy.count, 3)

  const feb = result.find(r => r.ts === febKey)
  t.ok(feb)
  t.is(feb.energy.usedPower, 30)
  t.is(feb.energy.availablePower, 70)
  t.is(feb.energy.count, 1)
})

test('WrkElectricityBase - getStatsHistory - invalid range', async (t) => {
  const worker = createMockWorker()

  const result = await worker.getStatsHistory({
    start: 1000,
    end: 2000,
    groupRange: 'invalid'
  })

  t.is(result, undefined)
})

test('WrkElectricityBase - getStatsHistory - empty stats', async (t) => {
  const worker = createMockWorker()

  worker.getDbData = async () => []

  const result = await worker.getStatsHistory({
    start: 1000,
    end: 2000,
    groupRange: DATE_RANGE.DAY,
    fields: {}
  })

  t.is(result.length, 0)
})

test('WrkElectricityBase - saveHourlyStats', async (t) => {
  const worker = createMockWorker()

  const mockApiData = {
    usedPower: 50.5,
    availablePower: 100.0
  }

  const mockTime = new Date('2024-01-15T10:30:45Z')
  const expectedTs = mockTime.getTime()

  worker.api = {
    getEnergyStats: async () => mockApiData
  }

  worker._saveToDb = async (db, ts, data) => {
    t.is(db, worker.hourlyStatsDb)
    t.is(ts, expectedTs)
    t.is(data.ts, expectedTs)
    t.is(data.usedPower, mockApiData.usedPower)
    t.is(data.availablePower, mockApiData.availablePower)
  }

  worker.hourlyStatsDb = {}

  await worker.saveHourlyStats(mockTime)
})

test('WrkElectricityBase - fetchData success', async (t) => {
  const worker = createMockWorker()

  let saveHourlyStatsCalled = false
  worker.saveHourlyStats = async (time) => {
    saveHourlyStatsCalled = true
    t.is(time, mockTime)
  }

  worker.logger = {
    error: () => {}
  }

  const mockTime = new Date()
  await worker.fetchData(mockTime)

  t.ok(saveHourlyStatsCalled)
})

test('WrkElectricityBase - fetchData error handling', async (t) => {
  const worker = createMockWorker()

  const mockError = new Error('Test error')
  worker.saveHourlyStats = async () => {
    throw mockError
  }

  let errorLogged = false
  worker.logger = {
    error: (msg, err) => {
      errorLogged = true
      t.is(msg, 'ERR_DATA_FETCH')
      t.is(err, mockError)
    }
  }

  await worker.fetchData(new Date())

  t.ok(errorLogged)
})
