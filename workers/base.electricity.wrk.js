'use strict'

const WrkRack = require('miningos-tpl-wrk-electricity/workers/rack.electricity.wrk.js')
const gLibUtilBase = require('@bitfinex/lib-js-util-base')
const utilsStore = require('hp-svc-facs-store/utils')
const async = require('async')
const {
  DATE_RANGE,
  HOURLY_SCHEDULER
} = require('./lib/constants')
const {
  getAggregationGroupKey
} = require('./lib/utils')

const ElectricityApi = require('./lib/electricity.api')

class WrkElectricityBase extends WrkRack {
  init () {
    super.init()
    this.loadConf('electricity', 'electricity')

    this.setInitFacs([
      [
        'fac',
        'bfx-facs-http',
        '0',
        '0',
        {
          baseUrl: this.conf.electricity.api.baseUrl,
          timeout: 30 * 1000
        },
        0
      ]
    ])
  }

  _start (cb) {
    async.series(
      [
        (next) => {
          super._start(next)
        },
        async () => {
          const db = await this.store_s1.getBee(
            { name: 'main' },
            { keyEncoding: 'binary' }
          )
          await db.ready()
          this.hourlyStatsDb = db.sub('hourly-stats')

          this.api = new ElectricityApi(this.http_0)

          this.scheduler_f2.add(HOURLY_SCHEDULER.key,
            (fireTime) => { this.fetchData(fireTime) }, HOURLY_SCHEDULER.time)
        }
      ],
      cb
    )
  }

  async _saveToDb (db, ts, data) {
    await db.put(
      utilsStore.convIntToBin(ts),
      Buffer.from(JSON.stringify(data))
    )
  }

  async getDbData (db, { start, end, fields = {} }) {
    if (!start) throw new Error('ERR_START_INVALID')
    if (!end) throw new Error('ERR_END_INVALID')

    const query = {
      gte: utilsStore.convIntToBin(start),
      lte: utilsStore.convIntToBin(end)
    }

    const stream = db.createReadStream(query)
    const res = []
    for await (const entry of stream) {
      res.push(JSON.parse(entry.value.toString()))
    }

    if (!gLibUtilBase.isEmpty(fields)) return this._projection(res, fields)
    return res
  }

  async fetchData (time) {
    try {
      await this.saveHourlyStats(time)
    } catch (e) {
      this.logger.error('ERR_DATA_FETCH', e)
    }
  }

  async saveHourlyStats (time) {
    const data = await this.api.getEnergyStats()
    const ts = new Date(time).getTime()
    await this._saveToDb(this.hourlyStatsDb, ts, { ts, ...data })
  }

  async getStatsHistory (req) {
    const range = req.groupRange
    if (![DATE_RANGE.DAY, DATE_RANGE.MONTH].includes(range)) return

    const stats = await this.getDbData(this.hourlyStatsDb, {
      start: req.start,
      end: req.end,
      fields: req.fields
    })

    const groupList = {}
    stats.sort((a, b) => a.ts - b.ts)

    for (const data of stats) {
      const key = getAggregationGroupKey(data.ts, range)
      const group = groupList[key]

      if (!group) {
        // Initialize if not already present
        groupList[key] = {
          usedPower: data.usedPower,
          availablePower: data.availablePower,
          label: key,
          count: 1,
          ts: key
        }
      } else {
        // Aggregate sums
        group.usedPower += data.usedPower
        group.availablePower += data.availablePower
        group.count += 1
      }
    }

    return Object.values(groupList).map((group) => ({
      ts: group.ts,
      energy: { ...group }
    }))
  }
}

module.exports = WrkElectricityBase
