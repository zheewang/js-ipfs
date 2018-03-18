'use strict'

const multihashes = require('multihashes')
const map = require('async/map')
const CID = require('cids')
const isIPFS = require('is-ipfs')

exports.OFFLINE_ERROR = 'This command must be run in online mode. Try running \'ipfs daemon\' first.'

/**
 * Break an ipfs-path down into it's root hash and an array of links.
 *
 * examples:
 *  b58Hash -> { root: 'b58Hash', links: [] }
 *  b58Hash/mercury/venus -> { root: 'b58Hash', links: ['mercury', 'venus']}
 *  /ipfs/b58Hash/links/by/name -> { root: 'b58Hash', links: ['links', 'by', 'name'] }
 *
 * @param  {String} ipfsPath An ipfs-path
 * @return {Object}            { root: base58 string, links: [string], ?err: Error }
 * @throws on an invalid @param ipfsPath
 */
exports.parseIpfsPath = function parseIpfsPath (ipfsPath) {
  const matched = ipfsPath.match(/^(?:\/ipfs\/)?([^/]+(?:\/[^/]+)*)\/?$/)
  const invalidPathErr = new Error('invalid ipfs ref path')
  if (!matched) {
    throw invalidPathErr
  }

  const [root, ...links] = matched[1].split('/')

  if (isIPFS.multihash(root)) {
    return {
      root: root,
      links: links
    }
  } else {
    throw invalidPathErr
  }
}

/**
 * Resolve various styles of an ipfs-path to the hash of the target node.
 * Follows links in the path.
 *
 * Accepts formats:
 *  - <base58 string>
 *  - <base58 string>/link/to/another/planet
 *  - /ipfs/<base58 string>
 *  - Buffers of the above
 *  - multihash Buffer
 *  - Arrays of the above
 *
 * @param  {IPFS}   ipfs       the IPFS node
 * @param  {Described above}   ipfsPaths A single or collection of ipfs-paths
 * @param  {Function} callback Node-style callback. res is Array<Buffer(hash)>
 * @return {void}
 */
exports.resolveIpfsPaths = function resolveIpfsPaths (ipfs, ipfsPaths, callback) {
  if (!Array.isArray(ipfsPaths)) {
    ipfsPaths = [ipfsPaths]
  }

  map(ipfsPaths, (path, cb) => {
    if (typeof path !== 'string') {
      return validate(path)
    }

    let parsedPath
    try {
      parsedPath = exports.parseIpfsPath(path)
    } catch(err) {
      return cb(err)
    }

    const rootHash = multihashes.fromB58String(parsedPath.root)
    if (!parsedPath.links.length) {
      return validate(rootHash)
    }

    ipfs.object.get(rootHash, pathFn)

    // recursively follow named links to the target node
    function pathFn (err, obj) {
      if (err) {
        return cb(err)
      }
      if (!parsedPath.links.length) {
        // done tracing, we have the target node
        return validate(obj.multihash)
      }

      const linkName = parsedPath.links.shift()
      const nextLink = obj.links.find(link => link.name === linkName)
      if (!nextLink) {
        // construct the relative path we've followed so far
        const linksFollowed = rootLinks
          .slice(0, rootLinks.length - links.length)
          .join('/')
        return cb(new Error(
          `no link named '${linkName}' under ${parsedPath.root}/${linksFollowed}`
        ))
      }

      ipfs.object.get(nextLink.multihash, pathFn)
    }

    function validate (mh) {
      let error, result
      try {
        multihashes.validate(mh)
        result = mh
      } catch (err) {
        error = err
      }
      cb(error, result)
    }
  }, callback)
}
