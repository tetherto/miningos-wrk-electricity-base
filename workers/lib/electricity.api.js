'use strict'

class ElectricityApi {
  constructor (http) {
    this.http = http
  }

  async _request (api) {
    const { body: resp } = await this.http.get(api, {
      encoding: 'json',
      timeout: 30 * 1000
    })
    return resp
  }

  async getEnergyStats () {
    return this._request('/stats')
  }
}

module.exports = ElectricityApi
