'use strict'

const createServer = require('ipfsd-ctl').createServer

// TODO(victor) fix this mess
// This is a horrible mess to be able to get a free port when running ports.
// Karma seems involved in the communication somehow, and then we have a HAPI
// server in the middle that I couldn't figure out how to get the resolved port
// from.
//
// So we have this for now. It works, but it's not proper.
const getPortSync = require('get-port-sync')
const freePort = getPortSync()
process.env.AEGIR_TEST_PORT = freePort
const server = createServer({port: freePort})

module.exports = {
  karma: {
    files: [{
      pattern: 'node_modules/interface-ipfs-core/js/test/fixtures/**/*',
      watched: false,
      served: true,
      included: false
    }],
    browserNoActivityTimeout: 100 * 1000,
    singleRun: true
  },
  hooks: {
    browser: {
      pre: server.start.bind(server),
      post: server.stop.bind(server)
    }
  }
}
