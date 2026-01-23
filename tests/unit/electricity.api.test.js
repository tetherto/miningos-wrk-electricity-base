'use strict'

const test = require('brittle')
const ElectricityApi = require('../../workers/lib/electricity.api')

test('ElectricityApi - constructor', (t) => {
  const mockHttp = {}
  const api = new ElectricityApi(mockHttp)

  t.is(api.http, mockHttp)
})

test('ElectricityApi - getEnergyStats', async (t) => {
  const mockResponse = {
    usedPower: 50.5,
    availablePower: 100.0
  }

  const mockHttp = {
    get: async (api, options) => {
      t.is(api, '/stats')
      t.is(options.encoding, 'json')
      t.is(options.timeout, 30 * 1000)
      return { body: mockResponse }
    }
  }

  const api = new ElectricityApi(mockHttp)
  const result = await api.getEnergyStats()

  t.alike(result, mockResponse)
})

test('ElectricityApi - _request with custom API path', async (t) => {
  const mockResponse = { data: 'test' }

  const mockHttp = {
    get: async (api, options) => {
      t.is(api, '/custom/path')
      return { body: mockResponse }
    }
  }

  const api = new ElectricityApi(mockHttp)
  const result = await api._request('/custom/path')

  t.alike(result, mockResponse)
})

test('ElectricityApi - _request handles errors', async (t) => {
  const mockHttp = {
    get: async () => {
      throw new Error('Network error')
    }
  }

  const api = new ElectricityApi(mockHttp)

  await t.exception(async () => {
    await api.getEnergyStats()
  })
})
