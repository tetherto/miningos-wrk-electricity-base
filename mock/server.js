'use strict'

const fs = require('fs')
const path = require('path')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const debug = require('debug')('mock')
const fastify = require('fastify')
const MockControlAgent = require('./mock-control-agent')

const createMockControlAgent = (things, mockControlPort) => {
  return new MockControlAgent({
    thgs: things,
    port: mockControlPort
  })
}

if (require.main === module) {
  const argv = yargs(hideBin(process.argv))
    .option('port', {
      alias: 'p',
      type: 'number',
      description: 'port to run on',
      default: 8000
    })
    .option('host', {
      alias: 'h',
      type: 'string',
      description: 'host to run on',
      default: '127.0.0.1'
    })
    .option('mockControlPort', {
      description: 'Mock control port',
      type: 'number'
    })
    .option('delay', {
      description: 'delay in ms',
      type: 'number',
      default: 0
    })
    .option('bulk', {
      description: 'bulk file',
      type: 'string'
    })
    .option('error', {
      description: 'send errored response',
      type: 'boolean',
      default: false
    })
    .parse()

  const agent = createMockControlAgent([argv], argv.mockControlPort)
  agent.init(runServer)
} else {
  module.exports = {
    createServer: runServer
  }
}

function addDelay (req, res, data, next) {
  if (req.ctx.delay) {
    setTimeout(next, req.ctx.delay)
  } else {
    next()
  }
}

function runServer (argv) {
  const CTX = {
    startTime: Date.now(),
    host: argv.host,
    port: argv.port,
    serial: argv.serial,
    delay: argv.delay,
    error: argv.error
  }

  const STATE = {}

  const cmdPaths = ['./initial_states/default']
  let cpath = null

  cmdPaths.forEach(p => {
    if (fs.existsSync(path.resolve(__dirname, p) + '.js')) {
      cpath = p
      return false
    }
  })

  try {
    debug(new Date(), `Loading initial state from ${cpath}`)
    Object.assign(STATE, require(cpath)(CTX))
  } catch (e) {
    throw Error('ERR_INVALID_STATE', e)
  }

  const addElectricityContext = (req, res, next) => {
    req.ctx = CTX
    req.state = STATE.state
    next()
  }

  const app = fastify()

  try {
    const router = require('./routers/base.js')
    app.addHook('onRequest', addElectricityContext)
    app.addHook('onSend', addDelay)
    router(app)
  } catch (e) {
    throw new Error('ERR_ROUTER_NOTFOUND')
  }

  app.addHook('onClose', STATE.cleanup)
  app.listen({ port: argv.port, host: argv.host }, function (err, addr) {
    if (err) {
      throw err
    }
    debug(`Server listening for HTTP requests on socket ${addr}`)
  })

  return {
    app,
    state: STATE.state,
    start: () => {
      if (!app.server) {
        app.listen(CTX.port, CTX.host)
      }
    },
    stop: () => {
      if (app.server) {
        app.close()
      }
    },
    reset: () => {
      return STATE.cleanup()
    },
    exit: () => {
      app.close()
      process.exit(0)
    }
  }
}
