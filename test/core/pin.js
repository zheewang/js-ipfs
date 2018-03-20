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

  function expectPinned (hash, pinned = true) {
    return pin.isPinned(hash)
      .then(result => expect(result.pinned).to.eql(pinned))
  }

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
    set,
    add,
    getIndirectKeys,
    flush,
    load
   */

  describe('isPinned', function () {
    // assume correct behavior for now
    // it('true when node is pinned')

    it('when node is not in datastore', function () {
      this.slow(8 * 1000)
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6ssss'
      return expectTimeout(pin.isPinned(hash), 4000)
    })

    it('when node is in datastore but not pinned', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      return pin.rm(hash)
        .then(() => expectPinned(hash, false))
        .then(() => pin.add(hash)) // want to remove
    })
  })

  describe('isPinnedWithType', function () {
    it('when pinned recursively', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      return pin.isPinnedWithType(hash, pin.types.recursive)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(pin.types.recursive)
        })
    })

    it('when pinned indirectly', function () {
      const rootHash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      const hash = 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'
      return pin.isPinnedWithType(hash, pin.types.indirect)
        .then(result => {
          expect(result.pinned).to.eql(true)
          expect(result.reason).to.eql(rootHash)
        })
    })

    it('when pinned directly', function () {
      const hash = 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB'
      return pin.add(hash, { recursive: false })
        .then(() => {
          return pin.isPinnedWithType(hash, pin.types.direct)
            .then(result => {
              expect(result.pinned).to.eql(true)
              expect(result.reason).to.eql(pin.types.direct)
            })
        })
        .then(() => pin.rm(hash, { recursive: false })) // want to remove
    })

    it('when not pinned', function () {
      const hash = 'QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr'
      return pin.isPinnedWithType(hash, pin.types.direct)
        .then(pin => {
          expect(pin.pinned).to.eql(false)
        })
    })
  })

  describe('add', function () {
    before(function () {
      this.timeout(15 * 1000)
      pin.clear()
      const files = [
        'test/fixtures/planets/mercury/wiki.md',
        'test/fixtures/planets/solar-system.md'
      ].map(path => ({
        path,
        content: fs.readFileSync(path)
      }))

      return ipfs.files.add(files)
        .then((out) => {
          return Promise.all([
            pin.add(keys.root),
            pin.add(keys.mercuryDir, { recursive: false })
          ])
        })
    })

    it('recursive', function () {

    })

    it('direct', function () {

    })

    it('recursive pin parent of direct pin', function () {

    })

    it('directly pinning a recursive pin fails', function () {

    })

    it('can\'t pin item not in datastore', function () {

    })

    it('needs all children in datastore to pin recursively', function () {
      // but direct succeeds
    })
  })

  describe('ls', function () {
    before(function () {
      this.timeout(15 * 1000)
      pin.clear()
      const files = [
        'test/fixtures/planets/mercury/wiki.md',
        'test/fixtures/planets/solar-system.md'
      ].map(path => ({
        path,
        content: fs.readFileSync(path)
      }))

      return ipfs.files.add(files)
        .then((out) => {
          return Promise.all([
            pin.add(keys.root),
            pin.add(keys.mercuryDir, { recursive: false })
          ])
        })
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
                hash: 'QmPXAkC89A8FXZYdiWZ3RHXDLtNqAY3o2PGQX9Jdr2NYbP' },
              { type: 'recursive',
                hash: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys' },
              { type: 'indirect',
                hash: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG' },
              { type: 'indirect',
                hash: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi' },
              { type: 'indirect',
                hash: 'QmU6yx89D8vMJTLdUc8a6dKdphkrrfXkDxmto87rjQCnix' }
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
                hash: 'QmPXAkC89A8FXZYdiWZ3RHXDLtNqAY3o2PGQX9Jdr2NYbP' },
              { type: 'recursive',
                hash: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys' },
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
                hash: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi' },
              { type: 'indirect',
                hash: 'QmU6yx89D8vMJTLdUc8a6dKdphkrrfXkDxmto87rjQCnix' }
            ])
          )
      })
    })
  })

  describe('rm', function () {
    before(function () {
      this.timeout(15 * 1000)
      pin.clear()
      const files = [
        'test/fixtures/planets/mercury/wiki.md',
        'test/fixtures/planets/solar-system.md'
      ].map(path => ({
        path,
        content: fs.readFileSync(path)
      }))

      return ipfs.files.add(files)
        .then((out) => {
          return Promise.all([
            pin.add(keys.root),
            pin.add(keys.mercuryDir, { recursive: false })
          ])
        })
    })

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

    it('fails when an item is not pinned', function () {
      return pin.rm(keys.root)
        .then(() => pin.rm(keys.root))
        .catch(err => expect(err).to.match(/is not pinned/))
    })
  })
})
