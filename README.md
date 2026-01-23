# miningos-wrk-electricity-base

## Setup

```
DEBUG="*" node worker.js --wtype wrk-electricity-base --env development --rack rack-1
```

## Example Usage via RPC

All calls are made through the `hp-rpc-cli` command-line tool using the `-m 'getWrkExtData'` method


### Get stats history grouped by day

```bash
hp-rpc-cli -s RPC_KEY \
  -m 'getWrkExtData' \
  -d '{"query": {"key": "stats-history", "start": "1697500800000", "end": "1700179200000", "groupRange": "1D", "dataInterval": "1h"}}' \
```
