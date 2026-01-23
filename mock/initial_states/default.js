'use strict'

const { cloneDeep } = require('@bitfinex/lib-js-util-base')

module.exports = function (ctx) {
  const state = {
    availablePower: 0,
    usedPower: 0
  }

  const initialState = cloneDeep(state)

  function cleanup () {
    Object.assign(state, initialState)
    return state
  }

  return { state, cleanup }
}
