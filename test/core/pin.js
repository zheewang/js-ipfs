/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const multihash = require('multihashes')

const IPFS = require('../../src/core')
const createTempRepo = require('../utils/create-repo-nodejs')
const expectTimeout = require('../utils/expect-timeout')

/**
 * A
 *  \
 *   B
 *   C
 *   D
 *    \
 *     E
 *     F
 */

// pin add A
// pin add --recursive=false C
// isPinnedWithType C indirect
// pin rm A
// isPinnedWithType C direct

describe('pin', function () {
  let ipfs
  let pin
  let repo

  before(function (done) {
    this.timeout(20 * 1000)
    repo = createTempRepo()
    ipfs = new IPFS({ repo })
    ipfs.on('ready', () => {
      pin = ipfs.pin
      done()
    })
  })

  after(done => repo.teardown(done))

  /**
    clear,
    set,
    add,
    rm,
    ls,
    getIndirectKeys,
    flush,
    load
   */

  describe('isPinned', function () {
    // assume correct behavior for now
    // it('true when item is pinned')

    it('when item is not in datastore', function () {
      this.slow(8 * 1000)
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6ssss'
      const mh = multihash.fromB58String(hash)
      return expectTimeout(pin.isPinned(mh), 4000)
    })

    it('when item exists but is not pinned', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      const mh = multihash.fromB58String(hash)
      return pin.rm(mh)
        .then(() => pin.isPinned(mh))
        .then(result => {
          expect(result.pinned).to.eql(false)
        })
    })
  })

  describe.only('isPinnedWithType', function () {
    it('when pinned recursively', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      const mh = multihash.fromB58String(hash)
      return pin.isPinnedWithType(mh, pin.types.recursive)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(pin.types.recursive)
        })
    })

    it('when pinned indirectly', function () {
      const rootHash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      const hash = 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'
      const mh = multihash.fromB58String(hash)
      return pin.isPinnedWithType(mh, pin.types.indirect)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(rootHash)
        })
    })

    it('when pinned directly', function () {
      const hash = 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'
      const mh = multihash.fromB58String(hash)
      return pin.add(mh, { recursive: false })
        .then(() => {
          return pin.isPinnedWithType(mh, pin.types.direct)
            .then(result => {
              expect(result.pinned).to.eql(true)
              expect(result.reason).to.eql(pin.types.direct)
            })
        })
        .then(() => pin.rm(mh, { recursive: false })) // want to remove
    })

    it('when not pinned', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      const mh = multihash.fromB58String(hash)
      return pin.isPinnedWithType(mh, pin.types.direct)
        .then(pin => {
          expect(pin.pinned).to.eql(false)
        })
    })
  })

  describe('add', function () {
    it('indirect supersedes direct', function () {
      console.log(Object.keys(pin))
      return pin.ls()
        .then(console.log.bind(console))
    })
  })

  describe('ls', function () {

  })

  describe('rm', function () {

  })
})
