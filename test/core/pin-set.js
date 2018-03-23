/* eslint max-nested-callbacks: ["error", 8] */
/* eslint-env mocha */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const fs = require('fs')
const multihashes = require('multihashes')
const parallelLimit = require('async/parallelLimit')

const IPFS = require('../../src/core')
const createTempRepo = require('../utils/create-repo-nodejs')
const expectTimeout = require('../utils/expect-timeout')

const emptyKeyHash = 'QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n'
const emptyKey = multihashes.fromB58String(emptyKeyHash)
const defaultFanout = 256
const maxItems = 8192


// fixture structure:
//  planets/
//   solar-system.md
//   mercury/
//    wiki.md
// const pins = {
//   root: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys',
//   solarWiki: 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG',
//   mercuryDir: 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q',
//   mercuryWiki: 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi'
// }
// const fixtures = [
//   'test/fixtures/planets/mercury/wiki.md',
//   'test/fixtures/planets/solar-system.md'
// ].map(path => ({
//   path,
//   content: fs.readFileSync(path)
// }))
// ipfs.files.add(fixtures, done)


describe('pinset', function () {

  let ipfs
  let pinset
  let repo

  before(function (done) {
    this.timeout(20 * 1000)
    repo = createTempRepo()
    ipfs = new IPFS({ repo })
    ipfs.on('ready', () => {
      pinset = ipfs.pin.set
      done()
    })
  })

  after(done => repo.teardown(done))

  describe('storeItems', function () {
    it('creates', function (done) {
      createNode('data')
        .then(node => {
          const item = {
            key: node._multihash,
            data: null
          }

          const expectedNode = {
            data: Buffer.from('data'),
            links: [new DAGLink('', 1, item.key)].concat(
              new Array(255).fill(new DAGLink('', 1, emptyKey))
            ),
            multihash: 'QmaQsuaQ26C77wjibYD6urdhhhZUPrGycPSZnYmUWQ3t47',
            size: 8
          }

          pinset.storeItems([item], noop, (err, rootNode) => {
            const node = rootNode.toJSON()
            expect(String(node.data)).to.eql('data')
            expect(node.multihash).to.eql('QmaQsuaQ26C77wjibYD6urdhhhZUPrGycPSZnYmUWQ3t47')
            done()
          })
        })
    })
  })

  describe('handles large structures', function () {
    it('handles storing items > maxItems', function () {
      this.timeout(15 * 1000)
      const count = maxItems + 1

      return createNodes(count)
        .then(nodes => {
          return new Promise((resolve, reject) =>
            pinset.storeSet(nodes, noop, (err, res) => {
              if (err) return reject(err)
              resolve(res)
            }))
        })
        .then(node => {
          node = node.toJSON()
          expect(node.size).to.eql(3183411)
          expect(node.links).to.have.length(defaultFanout)
          expect(node.multihash).to.eql('QmWKEc6JAq1bKQ6jyFLtoVB5PBApBk1FYjgYekj9sMQgT6')

          return new Promise((resolve, reject) =>
            pinset.loadSet(node, '', noop, (err, res) => {
              if (err) return reject(err)
              resolve(res)
            }))
        })
        .then(loaded => expect(loaded).to.have.length(30))
    })

    it('stress test: stores items > (maxItems * defaultFanout)', function (done) {
      this.timeout(180 * 1000)
      // this value triggers the creation of a recursive shard.
    	// If the recursive sharding is done improperly, this will result in
    	// an infinite recursion and crash (OOM)
    	const limit = (defaultFanout * maxItems) + 1
      let inputs

      createNodes(limit)
        .then(nodes => {
          inputs = nodes
          parallelLimit([
            cb => pinset.storeSet(inputs.slice(0, 1e4), noop, (err, res) => {
              expect(err).to.not.exist()
              cb(null, res)
            })
          ], 1, (err, res) => {
            expect(err).to.not.exist()
            console.log('storeSet result:', res)
            console.log('res[0].keys:', Object.keys(res[0]))
            done()
          })
        })
    })
  })

  describe('hasChild', function () {

  })

  describe('storeSet', function () {

  })


  describe('loadSet', function () {

  })

  describe('walkItems', function () {
    it.only('fails if node doesn\'t have a pin-set protobuf header', function () {
      createNode('datum')
        .then(node => {
          // pinset.storeItems wraps nodes in a pb header so by creating our own
          // we can verify that we catch malformations
          return new Promise((resolve, reject) => {
            pinset.walkItems(node, noop, noop, (err, res) => {
              if (err) return reject(err)
              resolve(res)
            })
          })
        })
        .then(res => {
          expect(res).to.not.exist()
          throw null
        })
        .catch(err => expect(err).to.exist())
    })
  })

  const promisify = require('promisify-es6')
  const dagPB = require('ipld-dag-pb')
  const DAGNode = dagPB.DAGNode
  const DAGLink = dagPB.DAGLink
  const fromB58String = require('multihashes').fromB58String
  function createNode (data, links = []) {
    return new Promise((resolve, reject) => {
      DAGNode.create(data, links, (err, node) => {
        if (err) reject(err)
        resolve(node)
      })
    })
  }

  function createNodes (num) {
    let items = []
    for (let i = 0; i < num; i++) {
      items.push(cb =>
        createNode(String(i)).then(node => cb(null, node._multihash))
      )
    }

    return new Promise((resolve, reject) => {
      parallelLimit(items, 500, (err, allNodes) => {
        if (err) return reject(err)
        resolve(allNodes)
      })
    })
  }

  function noop () {}
})
