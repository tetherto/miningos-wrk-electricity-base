'use strict'

const DATE_RANGE = {
  DAY: '1D',
  MONTH: '1M'
}
const HOURLY_SCHEDULER = { time: '0 0 */1 * * *', key: '1h' }

module.exports = {
  DATE_RANGE,
  HOURLY_SCHEDULER
}
