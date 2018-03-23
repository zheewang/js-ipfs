'use strict'

const multihashes = require('multihashes')
const toB58String = multihashes.toB58String
const CID = require('cids')
const protobuf = require('protons')
const fnv1a = require('fnv1a')
const dagPB = require('ipld-dag-pb')
const DAGNode = dagPB.DAGNode
const DAGLink = dagPB.DAGLink
const varint = require('varint')
const once = require('once')

const pbSchema = require('./pin.proto')

const emptyKeyHash = 'QmdfTbBqBPQ7VNxZEYEj14VmRuZBkqFbiwReogJgS1zR1n'
const emptyKey = multihashes.fromB58String(emptyKeyHash)
const defaultFanout = 256
const maxItems = 8192
const pb = protobuf(pbSchema)

function readHeader (rootNode) {
  // rootNode.data should be a buffer of the format:
  // < varint(headerLength) | header | itemData... >
  const rootData = rootNode.data
  const hdrLength = varint.decode(rootData)
  const vBytes = varint.decode.bytes
  if (vBytes <= 0) {
    throw new Error('Invalid Set header length')
  }
  if (vBytes + hdrLength > rootData.length) {
    throw new Error('Impossibly large set header length')
  }
  const hdrSlice = rootData.slice(vBytes, hdrLength + vBytes)
  const header = pb.Set.decode(hdrSlice)
  if (header.version !== 1) {
    throw new Error(`Unsupported Set version: ${header.version}`)
  }
  if (header.fanout > rootNode.links.length) {
    throw new Error('Impossibly large fanout')
  }
  return {
    header: header,
    data: rootData.slice(hdrLength + vBytes)
  }
}

function hash (seed, key) {
  const buf = Buffer.alloc(4)
  buf.writeUInt32LE(seed, 0)
  const data = Buffer.concat([
    buf, Buffer.from(toB58String(key))
  ])
  return fnv1a(data.toString('binary'))
}

exports = module.exports = function (dag) {
  const pinSet = {
    // should this be part of `object` API?
    hasChild: (root, childhash, callback, _links, _checked, _seen) => {
      callback = once(callback)
      if (typeof childhash === 'object') {
        childhash = toB58String(childhash)
      }
      _links = _links || root.links.length
      _checked = _checked || 0
      _seen = _seen || {}

      if (!root.links.length && _links === _checked) {
        // all nodes have been checked
        return callback(null, false)
      }
      root.links.forEach((link) => {
        const bs58link = toB58String(link.multihash)
        if (bs58link === childhash) {
          return callback(null, true)
        }

        // don't check the same links twice
        if (bs58link in _seen) { return }
        _seen[bs58link] = true

        dag.get(new CID(link.multihash), (err, res) => {
          if (err) { return callback(err) }

          _checked++
          _links += res.value.links.length
          pinSet.hasChild(res.value, childhash, callback, _links, _checked, _seen)
        })
      })
    },

    storeSet: (keys, logInternalKey, callback) => {
      callback = once(callback)
      const items = keys.map((key) => {
        return {
          key: key,
          data: null
        }
      })
      pinSet.storeItems(items, logInternalKey, (err, rootNode) => {
        if (err) { return callback(err) }
        const opts = { cid: new CID(rootNode.multihash) }
        dag.put(rootNode, opts, (err, cid) => {
          if (err) { return callback(err) }
          logInternalKey(rootNode.multihash)
          callback(null, rootNode)
        })
      })
    },

    storeItems: (items, logInternalKey, callback, _depth, _subcalls, _done) => {
      callback = once(callback)
      const seed = _depth
      const pbHeader = pb.Set.encode({
        version: 1,
        fanout: defaultFanout,
        seed: seed
      })
      let rootData = Buffer.concat([
        Buffer.from(varint.encode(pbHeader.length)), pbHeader
      ])
      let rootLinks = []
      for (let i = 0; i < defaultFanout; i++) {
        rootLinks.push(new DAGLink('', 1, emptyKey))
      }
      logInternalKey(emptyKey)

      // console.log('storing items:', items)
      if (items.length <= maxItems) {
        // the items will fit in a single root node
        const itemLinks = []
        const itemData = []
        const indices = []

        for (let i = 0; i < items.length; i++) {
          itemLinks.push(new DAGLink('', 1, items[i].key))
          itemData.push(items[i].data || Buffer.alloc(0))
          indices.push(i)
        }
        indices.sort((a, b) => {
          const x = Buffer.compare(itemLinks[a].multihash, itemLinks[b].multihash)
          if (x) { return x }
          return (a < b ? -1 : 1)
        })

        const sortedLinks = indices.map(i => { return itemLinks[i] })
        const sortedData = indices.map(i => { return itemData[i] })
        rootLinks = rootLinks.concat(sortedLinks)
        rootData = Buffer.concat([rootData].concat(sortedData))

        // console.log('rootData:', rootData)
        // console.log('rootLinks:', rootData)
        DAGNode.create(rootData, rootLinks, (err, rootNode) => {
          if (err) { return callback(err) }
          return callback(null, rootNode)
        })
      } else {
        // need to split up the items into multiple root nodes
        // (using go-ipfs' "wasteful but simple" approach for consistency)
        _subcalls = _subcalls || 0
        _done = _done || 0
        const hashed = {}

        // items will be distributed among `defaultFanout` bins
        items.forEach(item => {
          const bin = hash(seed, item.key) % defaultFanout
          hashed[bin] = hashed[bin] || []
          hashed[bin].push(item)
        })

        const hashedKeys = Object.keys(hashed)
        _subcalls += hashedKeys.length
        hashedKeys.forEach(bin => {
          pinSet.storeItems(
            hashed[bin],
            logInternalKey,
            (err, child) => storeItemsCb(err, child, bin),
            _depth + 1,
            _subcalls,
            _done
          )
        })

        function storeItemsCb (err, child, bin) {
          if (err) { return callback(err) }
          const cid = new CID(child._multihash)
          dag.put(child, { cid }, (err) => {
            if (err) { return callback(err) }

            logInternalKey(child.multihash)
            rootLinks[bin] = new DAGLink('', child.size, child.multihash)
            _done++

            if (_done === _subcalls) {
              // all finished
              DAGNode.create(rootData, rootLinks, (err, rootNode) => {
                if (err) { return callback(err) }
                return callback(null, rootNode)
              })
            }
          })
        }
      }
    },

    loadSet: (rootNode, name, logInternalKey, callback) => {
      callback = once(callback)
      const link = rootNode.links.find(l => l.name === name)
      if (!link) {
        return callback(new Error('No link found with name ' + name))
      }
      logInternalKey(link.multihash)
      dag.get(new CID(link.multihash), (err, res) => {
        if (err) { return callback(err) }
        const keys = []
        const walkerFn = link => keys.push(link.multihash)

        pinSet.walkItems(res.value, walkerFn, logInternalKey, (err) => {
          if (err) { return callback(err) }
          return callback(null, keys)
        })
      })
    },

    walkItems: (node, walkerFn, logInternalKey, callback) => {
      callback = once(callback)
      let pb
      try {
        pb = readHeader(node)
      } catch (err) {
        return callback(err)
      }
      const fanout = pb.header.fanout
      let subwalkCount = 0
      let finishedCount = 0

      const walkCb = (err) => {
        if (err) { return callback(err) }
        finishedCount++
        if (subwalkCount === finishedCount) {
          return callback()
        }
      }

      for (let i = 0; i < node.links.length; i++) {
        const link = node.links[i]
        if (i >= fanout) {
          // item link
          walkerFn(link, i, pb.data)
        } else {
          // fanout link
          logInternalKey(link.multihash)
          if (!emptyKey.equals(link.multihash)) {
            subwalkCount++
            dag.get(new CID(link.multihash), (err, res) => {
              if (err) { return callback(err) }
              pinSet.walkItems(
                res.value, walkerFn, logInternalKey, walkCb
              )
            })
          }
        }
      }
      if (!subwalkCount) {
        return callback()
      }
    }
  }
  return pinSet
}
