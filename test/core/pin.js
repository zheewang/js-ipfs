/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const fs = require('fs')

const IPFS = require('../../src/core')
const createTempRepo = require('../utils/create-repo-nodejs')
const expectTimeout = require('../utils/expect-timeout')

// fixture structure:
//  planets/)
//   solar-system
//   mercury/
//    wiki
const fixturePath = 'test/fixtures/planets'

const keys = {
  root: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys',
  mercuryDir: 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q',
  mercuryWiki: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi',
  solarSystem: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG'
}

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
  const files = [
    'test/fixtures/planets/mercury/wiki.md',
    'test/fixtures/planets/solar-system.md'
  ].map(path => ({
    path,
    content: fs.readFileSync(path)
  }))

  function expectPinned (hash, type, pinned = true) {
    if (typeof type === 'boolean') {
      pinned = type
      type = undefined
    }

    return pin.isPinnedWithType(hash, type || pin.types.all)
      .then(result => expect(result.pinned).to.eql(pinned))
  }

  before(function (done) {
    this.timeout(20 * 1000)
    repo = createTempRepo()
    ipfs = new IPFS({ repo })
    ipfs.on('ready', () => {
      pin = ipfs.pin
      ipfs.files.add(files, done)
    })
  })

  after(done => repo.teardown(done))

  /**
    getIndirectKeys,
    flush,
    load
   */

  describe('isPinned', function () {
    beforeEach(function () {
      pin.clear()
    })

    it('true when node is pinned', function () {
      return pin.add(keys.solarSystem)
        .then(() => pin.isPinned(keys.solarSystem))
        .then(pinned => expect(pinned.pinned).to.eql(true))
    })

    it('when node is not in datastore', function () {
      const falseHash = `${keys.root.slice(0, -2)}ss`
      return pin.isPinned(falseHash)
        .then(pinned => {
          expect(pinned.pinned).to.eql(false)
          expect(pinned.reason).to.eql(undefined)
        })
    })

    it('when node is in datastore but not pinned', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      return expectPinned(keys.root, false)
    })
  })

  describe('isPinnedWithType', function () {
    before(function () {
      pin.clear()
      return pin.add(keys.root)
    })

    it('when pinned recursively', function () {
      return pin.isPinnedWithType(keys.root, pin.types.recursive)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(pin.types.recursive)
        })
    })

    it('when pinned indirectly', function () {
      return pin.isPinnedWithType(keys.mercuryWiki, pin.types.indirect)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(keys.root)
        })
    })

    it('when pinned directly', function () {
      return pin.add(keys.mercuryDir, { recursive: false })
        .then(() => {
          return pin.isPinnedWithType(keys.mercuryDir, pin.types.direct)
            .then(result => {
              expect(result.pinned).to.eql(true)
              expect(result.reason).to.eql(pin.types.direct)
            })
        })
    })

    it('when not pinned', function () {
      pin.clear()
      return pin.isPinnedWithType(keys.mercuryDir, pin.types.direct)
        .then(pin => expect(pin.pinned).to.eql(false))
    })
  })

  describe('add', function () {
    beforeEach(function () {
      pin.clear()
    })

    it('recursive', function () {
      return pin.add(keys.root)
        .then(() => {
          const pinChecks = Object.values(keys)
            .map(hash => expectPinned(hash))

          return Promise.all(pinChecks)
        })
    })

    it('direct', function () {
      return pin.add(keys.root, { recursive: false })
        .then(() => Promise.all([
          expectPinned(keys.root),
          expectPinned(keys.solarSystem, false)
        ]))
    })

    it('recursive pin parent of direct pin', function () {
      return pin.add(keys.solarSystem, { recursive: false })
        .then(() => pin.add(keys.root))
        .then(() => Promise.all([
          // solarSystem is pinned both directly and indirectly o.O
          expectPinned(keys.solarSystem, pin.types.direct),
          expectPinned(keys.solarSystem, pin.types.indirect),
        ]))
    })

    it('directly pinning a recursive pin fails', function () {
      return pin.add(keys.root)
        .then(() => pin.add(keys.root, { recursive: false }))
        .catch(err => expect(err).to.match(/already pinned recursively/))
    })

    it('can\'t pin item not in datastore', function () {
      this.timeout(10 * 1000)
      const falseHash = `${keys.root.slice(0, -2)}ss`
      return expectTimeout(pin.add(falseHash), 4000)
    })

    // block rm breaks subsequent tests
    it.skip('needs all children in datastore to pin recursively', function () {
      this.timeout(10 * 1000)
      return ipfs.block.rm(keys.mercuryWiki)
        .then(() => expectTimeout(pin.add(keys.root), 4000))
    })
  })

  describe('ls', function () {
    before(function () {
      pin.clear()
      return Promise.all([
        pin.add(keys.root),
        pin.add(keys.mercuryDir, { recursive: false })
      ])
    })

    it('lists pins of a particular path', function () {
      return pin.ls(keys.mercuryDir)
        .then(out => expect(out[0].hash).to.eql(keys.mercuryDir))
    })

    // TODO exposes a bug
    it.skip('indirect pins supersedes direct pins', function () {
      return pin.add(keys.mercuryDir, { recursive: false })
        .then(() => pin.ls())
        .then(ls => {
          const pinType = ls.find(out => out.hash === keys.mercuryDir).type
          expect(pinType).to.eql(pin.types.indirect)
        })
    })

    describe('list pins of type', function () {
      it('all', function () {
        return pin.ls()
          .then(out =>
            expect(out).to.deep.eql([
              { type: 'direct',
                hash: 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q' },
              { type: 'recursive',
                hash: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys' },
              { type: 'indirect',
                hash: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG' },
              { type: 'indirect',
                hash: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi' },
            ])
          )
      })

      it('direct', function () {
        return pin.ls({ type: 'direct' })
          .then(out =>
            expect(out).to.deep.eql([
              { type: 'direct',
                hash: 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q' }
            ])
          )
      })

      it('recursive', function() {
        return pin.ls({ type: 'recursive' })
          .then(out =>
            expect(out).to.deep.eql([
              { type: 'recursive',
                hash: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys' }
            ])
          )
      })

      it('indirect', function () {
        return pin.ls({ type: 'indirect' })
          .then(out =>
            expect(out).to.deep.eql([
              { type: 'indirect',
                hash: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG' },
              { type: 'indirect',
                hash: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi' }
            ])
          )
      })
    })
  })

  describe('rm', function () {
    beforeEach(function () {
      pin.clear()
      return pin.add(keys.root)
    })

    it('a recursive pin', function () {
      return pin.rm(keys.root)
        .then(() => {
          return Promise.all([
            expectPinned(keys.root, false),
            expectPinned(keys.mercuryWiki, false)
          ])
        })
    })

    it('a direct pin', function () {
      pin.clear()
      return pin.add(keys.mercuryDir, { recursive: false })
        .then(() => pin.rm(keys.mercuryDir))
        .then(() => expectPinned(keys.mercuryDir, false))
    })

    it('fails to remove an indirect pin', function () {
      return pin.rm(keys.solarSystem)
        .catch(err => expect(err).to.match(/is pinned indirectly under/))
        .then(() => expectPinned(keys.solarSystem))
    })

    // TODO possibly exposes a bug.
    // If you pin.rm recursive=true, on an indirect pin that is also pinned
    // directly, shouldn't it fail? Seems just to be not properly handling
    // default options. anyway, go does this too.
    it('p', function () {
      return pin.add(keys.mercuryDir, { recursive: false })
        .then(() => pin.rm(keys.mercuryDir, { recursive: true }))
    })

    it('fails when an item is not pinned', function () {
      return pin.rm(keys.root)
        .then(() => pin.rm(keys.root))
        .catch(err => expect(err).to.match(/is not pinned/))
    })
  })
})
