/* eslint-env mocha */
'use strict'

const expect = require('chai').expect
const fs = require('fs')
const FormData = require('form-data')
const streamToPromise = require('stream-to-promise')
const each = require('async/each')

// use a tree of ipfs objects for recursive tests:
//  root
//   |`leaf
//    `branch
//      `subLeaf

// const hashes = {
//   root: 'QmWQwS2Xh1SFGMPzUVYQ52b7RC7fTfiaPHm3ZyTRZuHmer',
//   leaf: 'QmaZoTQ6wFe7EtvaePBUeXavfeRqCAq3RUMomFxBpZLrLA',
//   branch: 'QmNxjjP7dtx6pzxWGBRCrgmjX3JqKL7uF2Kjx7ExiZDbSB',
//   subLeaf: 'QmUzzznkyQL7FjjBztG3D1tTjBuxeArLceDZnuSowUggXL'
// }

const hashes = {
  root1: 'QmVtU7ths96fMgZ8YSZAbKghyieq7AjxNdcqyVzxTt3qVe',
    c1: 'QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V',
    c2: 'QmYCvbfNbCwFR45HiNP45rwJgvatpiW38D961L5qAhUM5Y',
    c3: 'QmY5heUM5qgRubMDD1og9fhCPA6QdkMp3QCwd4s7gJsyE7',
    c4: 'QmUzLxaXnM8RYCPEqLDX5foToi5aNZHqfYr285w2BKhkft',
    c5: 'QmPZ9gcCEpqKTo6aq61g2nXGUhM4iCL3ewB6LDXZCtioEB',
    c6: 'QmTumTjvcYCAvRRwQ8sDRxh8ezmrcr88YFU7iYNroGGTBZ',
  root2: 'QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn',
}

// const hashes = {
//   planets: 'QmTAMavb995EHErSrKo7mB8dYkpaSJxu6ys1a6XJyB2sys',
//   'test-data/mercury.json': 'QmTMbkDfvHwq3Aup6Nxqn3KKw9YnoKzcZvuArAfQ9GF3QG',
//   'planets/mercury': 'QmbJCNKXJqVK8CzbjpNFz2YekHwh3CSHpBA86uqYg3sJ8q',
//   'planets/mercury/wiki.md': 'QmVgSHAdMxFAuMP2JiMAYkB8pCWP1tcB9djqvq8GKAFiHi'
// }

module.exports = (http) => {
  describe('pin', () => {
    let api

    before(done => {
      // add test tree to repo
      api = http.api.server.select('API')
      // const putFile = (filename, cb) => {
      //   const form = new FormData()
      //   const filePath = `test/fixtures/${filename}`
      //   form.append('file', fs.createReadStream(filePath))
      //   const headers = form.getHeaders()
      //
      //   streamToPromise(form).then(payload => {
      //     // console.log('buffer:', Buffer.isBuffer(payload), payload)
      //     api.inject({
      //       method: 'POST',
      //       url: '/api/v0/object/put',
      //       headers: headers,
      //       payload: payload
      //     }, (res) => {
      //       console.log('result:', res.result)
      //       expect(res.statusCode).to.equal(200)
      //       cb()
      //     })
      //   })
      // }
      //
      // each(Object.keys(hashes), putFile, (err) => {
      //   expect(err).to.not.exist()
      //   done()
      // })
      done()
    })


    describe('rm', () => {
      it('fails on invalid args', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/rm?arg=invalid`
        }, res => {
          expect(res.statusCode).to.equal(500)
          expect(res.result.Message).to.match(/invalid ipfs ref path/)
          done()
        })
      })

      it('unpins recursive pins', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/rm?arg=${hashes.root1}`
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result.Pins).to.deep.eql([hashes.root1])
          done()
        })
      })

      it('unpins direct pins', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/add?arg=${hashes.root1}&recursive=false`
        }, res => {
          expect(res.statusCode).to.equal(200)
          api.inject({
            method: 'POST',
            url: `/api/v0/pin/rm?arg=${hashes.root1}&recursive=false`
          }, (res) => {
            expect(res.statusCode).to.equal(200)
            expect(res.result.Pins).to.deep.eql([hashes.root1])
            done()
          })
        })
      })
    })

    describe.only('add', () => {
      it('fails on invalid args', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/add?arg=invalid`
        }, res => {
          expect(res.statusCode).to.equal(500)
          expect(res.result.Message).to.match(/invalid ipfs ref path/)
          done()
        })
      })

      it('recursively', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/add?arg=${hashes.planets}`
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result).to.deep.equal({Pins: [hashes.planets]})
          done()
        })
      })

      it('directly', done => {
        api.inject({
          method: 'POST',
          url: `/api/v0/pin/add?arg=${hashes.leaf}&recursive=false`
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result).to.deep.equal({Pins: [hashes.leaf]})
          done()
        })
      })
    })

    describe('ls', () => {
      it('fails on invalid args', done => {
        api.inject({
          method: 'GET',
          url: `/api/v0/pin/ls?arg=invalid`
        }, res => {
          expect(res.statusCode).to.equal(500)
          expect(res.result.Message).to.match(/invalid ipfs ref path/)
          done()
        })
      })

      it('finds all pinned objects', done => {
        api.inject({
          method: 'GET',
          url: '/api/v0/pin/ls'
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result.Keys).to.have.all.keys(Object.values(hashes))
          done()
        })
      })

      it('finds specific pinned objects', done => {
        api.inject({
          method: 'GET',
          url: `/api/v0/pin/ls?arg=${hashes.c1}`
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result.Keys[hashes.c1].Type)
            .to.equal(`indirect through ${hashes.root1}`)
          done()
        })
      })

      it('finds pins of type', done => {
        api.inject({
          method: 'GET',
          url: `/api/v0/pin/ls?type=recursive`
        }, (res) => {
          expect(res.statusCode).to.equal(200)
          expect(res.result.Keys).to.deep.eql({
            QmUNLLsPACCz1vLxQVkXqqLX5R1X345qqfHbsf67hvA3Nn: {
              Type: 'recursive'
            },
            QmVtU7ths96fMgZ8YSZAbKghyieq7AjxNdcqyVzxTt3qVe: {
              Type: 'recursive'
            }
          })
          done()
        })
      })
    })
  })
}
