## Log of slow tests

Get relative timestamps for tests:

```
yarn test:node | ts -i
```

- Test cases should NOT have `time` cases with `setTimeout` in them
- No load tests
- `stop as promised`
- `bitswap.transfer a block between.*`
- `swarm.callback API.peers`
- `pubsub tests`
- `daemon tests`
  - https://github.com/ipfs/js-ipfs/blob/bc66e9fb3a0c9ae45134061fd6108e4227b4029c/test/utils/ipfs-exec.js#L28
  - ^ `timeout` is not actually a timeout, but more `return after X seconds`. Setting this to 60 seconds
    will make it so it takes 60 seconds for the command to return, when it's daemon
