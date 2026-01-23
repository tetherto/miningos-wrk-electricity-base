'use strict'

module.exports = function (fastify) {
  fastify.get('/stats', (req, res) => {
    res.send({
      usedPower: Math.random() * 100,
      availablePower: Math.random() * 100
    })
  })
}
