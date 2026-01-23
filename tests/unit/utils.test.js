'use strict'

const test = require('brittle')
const { getAggregationGroupKey } = require('../../workers/lib/utils')
const { DATE_RANGE } = require('../../workers/lib/constants')

test('getAggregationGroupKey - DAY range', (t) => {
  const ts = new Date('2024-01-15T10:30:45Z').getTime()
  const result = getAggregationGroupKey(ts, DATE_RANGE.DAY)

  const resultDate = new Date(result)
  const inputDate = new Date(ts)
  t.is(resultDate.getFullYear(), inputDate.getFullYear())
  t.is(resultDate.getMonth(), inputDate.getMonth())
  t.is(resultDate.getDate(), inputDate.getDate())
  t.is(resultDate.getHours(), 0)
  t.is(resultDate.getMinutes(), 0)
  t.is(resultDate.getSeconds(), 0)
})

test('getAggregationGroupKey - MONTH range', (t) => {
  const ts = new Date('2024-01-15T10:30:45Z').getTime()
  const result = getAggregationGroupKey(ts, DATE_RANGE.MONTH)

  const resultDate = new Date(result)
  const inputDate = new Date(ts)
  t.is(resultDate.getFullYear(), inputDate.getFullYear())
  t.is(resultDate.getMonth(), inputDate.getMonth())
  t.is(resultDate.getDate(), 1)
  t.is(resultDate.getHours(), 0)
  t.is(resultDate.getMinutes(), 0)
  t.is(resultDate.getSeconds(), 0)
})

test('getAggregationGroupKey - MONTH range with different days', (t) => {
  const ts1 = new Date('2024-01-05T10:30:45Z').getTime()
  const ts2 = new Date('2024-01-15T10:30:45Z').getTime()
  const ts3 = new Date('2024-01-31T10:30:45Z').getTime()

  const result1 = getAggregationGroupKey(ts1, DATE_RANGE.MONTH)
  const result2 = getAggregationGroupKey(ts2, DATE_RANGE.MONTH)
  const result3 = getAggregationGroupKey(ts3, DATE_RANGE.MONTH)

  t.is(result1, result2)
  t.is(result2, result3)

  // Verify it's the 1st of the month
  const resultDate = new Date(result1)
  t.is(resultDate.getDate(), 1)
  t.is(resultDate.getMonth(), 0) // January is month 0
  t.is(resultDate.getFullYear(), 2024)
})

test('getAggregationGroupKey - DAY range with different times', (t) => {
  const localDate = new Date(2024, 0, 15) // January 15, 2024 in local time
  const ts1 = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 0, 0, 0).getTime()
  const ts2 = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 12, 30, 45).getTime()
  const ts3 = new Date(localDate.getFullYear(), localDate.getMonth(), localDate.getDate(), 23, 59, 59).getTime()

  const result1 = getAggregationGroupKey(ts1, DATE_RANGE.DAY)
  const result2 = getAggregationGroupKey(ts2, DATE_RANGE.DAY)
  const result3 = getAggregationGroupKey(ts3, DATE_RANGE.DAY)

  t.is(result1, result2)
  t.is(result2, result3)

  const resultDate = new Date(result1)
  t.is(resultDate.getHours(), 0)
  t.is(resultDate.getMinutes(), 0)
  t.is(resultDate.getSeconds(), 0)
})

test('getAggregationGroupKey - different months', (t) => {
  const ts1 = new Date('2024-01-15T10:30:45Z').getTime()
  const ts2 = new Date('2024-02-15T10:30:45Z').getTime()
  const ts3 = new Date('2024-03-15T10:30:45Z').getTime()

  const result1 = getAggregationGroupKey(ts1, DATE_RANGE.MONTH)
  const result2 = getAggregationGroupKey(ts2, DATE_RANGE.MONTH)
  const result3 = getAggregationGroupKey(ts3, DATE_RANGE.MONTH)

  t.ok(result1 !== result2)
  t.ok(result2 !== result3)

  const date1 = new Date(result1)
  const date2 = new Date(result2)
  const date3 = new Date(result3)

  t.is(date1.getDate(), 1)
  t.is(date1.getMonth(), 0) // January

  t.is(date2.getDate(), 1)
  t.is(date2.getMonth(), 1) // February

  t.is(date3.getDate(), 1)
  t.is(date3.getMonth(), 2) // March
})

test('getAggregationGroupKey - different days', (t) => {
  const ts1 = new Date('2024-01-15T10:30:45Z').getTime()
  const ts2 = new Date('2024-01-16T10:30:45Z').getTime()
  const ts3 = new Date('2024-01-17T10:30:45Z').getTime()

  const result1 = getAggregationGroupKey(ts1, DATE_RANGE.DAY)
  const result2 = getAggregationGroupKey(ts2, DATE_RANGE.DAY)
  const result3 = getAggregationGroupKey(ts3, DATE_RANGE.DAY)

  t.ok(result1 !== result2)
  t.ok(result2 !== result3)

  const date1 = new Date(result1)
  const date2 = new Date(result2)
  const date3 = new Date(result3)

  t.is(date1.getDate(), 15)
  t.is(date1.getHours(), 0)

  t.is(date2.getDate(), 16)
  t.is(date2.getHours(), 0)

  t.is(date3.getDate(), 17)
  t.is(date3.getHours(), 0)
})
