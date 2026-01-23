'use strict'

const { DATE_RANGE } = require('./constants')

const getAggregationGroupKey = (ts, timeline) => {
  const date = new Date(ts)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = timeline === DATE_RANGE.DAY ? date.getDate() : '01'
  return new Date([year, month, day].join('-')).valueOf()
}

module.exports = {
  getAggregationGroupKey
}
