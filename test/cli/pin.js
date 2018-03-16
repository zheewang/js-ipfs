/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const runOnAndOff = require('../utils/on-and-off')

// file structure for recursive tests:
//  root (planets/)
//   |`solar-system
//    `mercury
//      `wiki

const keys = {
  root: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys',
  mercuryDir: 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q',
  mercuryWiki: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi',
  solarSystem: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG'
}

describe('pin', () => runOnAndOff.off((thing) => {
  // const filesDir = 'test/fixtures/test-data/recursive-get-dir/init-mercuryDir'
  const filesDir = 'test/fixtures/planets'

  let ipfs

  before(function () {
    this.timeout(15 * 1000)
    ipfs = thing.ipfs

    return ipfs(`files add -r ${filesDir}`)
      // .then(() => ipfs('pin ls'))
      // .then(out => console.log('ls output:', out))

    // return ipfs('pin ls')
    //   .then(ls => {
    //     console.log('ls output:', ls)
    //     const rootPins = ls.split('\n')
    //       .filter(line => line.includes('recursive'))
    //       .map(pin => pin.split(' ')[0])
    //
    //     console.log('rootPins:', rootPins)
    //     return ipfs('pin rm QmfGBRT6BbWJd7yUc2uYdaUZJBbnEFvTqehPFoSMQ6wgdr')
    //     // return Promise.all(
    //     //   rootPins.map(hash => ipfs(`pin rm ${hash}`))
    //     // )
    //   })
    //   .then(() => ipfs(`files add -r ${filesDir}`))
  })

  describe('rm', function () {
    it('recursively (default)', function () {
      this.timeout(10 * 1000)
      return ipfs(`pin rm ${keys.root}`)
        .then(out => expect(out).to.equal(`unpinned ${keys.root}\n`))
        .then(() => ipfs('pin ls'))
        .then(out => {
          Object.values(keys).forEach(hash => expect(out).to.not.include(hash))
        })
    })

    // it('direct', () => {
    //   return ipfs(`pin rm --recursive false ${keys.solarSystem}`)
    //     .then(out => expect(out).to.equal(`unpinned ${keys.solarSystem}\n`))
    //     .then(() => ipfs('pin ls'))
    //     .then(out => expect(out).to.not.include(`${keys.solarSystem} direct\n`))
    // })
  })

  describe('add', function () {
    it('recursively (default)', () => {
      return ipfs(`pin add ${keys.root}`).then(out => {
        expect(out).to.eql(`pinned ${keys.root} recursively\n`)
      })
    })

    it('direct', () => {
      return ipfs(`pin add ${keys.solarSystem} --recursive false`).then(out => {
        expect(out).to.eql(`pinned ${keys.solarSystem} directly\n`)
      })
    })
  })

  describe('ls', function () {
    it('lists recursive pins', () => {
      return ipfs(`pin ls ${keys.root}`).then(out => {
        expect(out).to.eql(`${keys.root} recursive\n`)
      })
    })

    it('lists direct pins', () => {
      return ipfs(`pin ls ${keys.solarSystem}`).then(out => {
        expect(out).to.eql(`${keys.solarSystem} direct\n`)
      })
    })

    it('lists indirect pins', () => {
      return ipfs(`pin ls ${keys.mercuryWiki}`).then(out => {
        expect(out).to.eql(`${keys.mercuryWiki} indirect through ${keys.root}\n`)
      })
    })

    it('handles multiple hashes', () => {
      return ipfs(`pin ls ${keys.root} ${keys.solarSystem}`).then(out => {
        expect(out).to.eql(`${keys.root} recursive\n${keys.solarSystem} direct\n`)
      })
    })

    it('lists all pins when no hash passed', () => {
      return ipfs('pin ls').then(out => {
        console.log('ls output:', out)
        expect(out).to.include(`${keys.root} recursive\n`)
        expect(out).to.include(`${keys.solarSystem} direct\n`)
        expect(out).to.include(`${keys.mercuryDir} indirect\n`)
        expect(out).to.include(`${keys.mercuryWiki} indirect\n`)
      })
    })
  })
}))
