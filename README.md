# Token Launch Radar radar-3: fitted size curve tested blind, netted farm plans, every protocol accounted for

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/a8643520/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/a8643520/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 196 pre-token DeFi protocols by implied value — the whole 40-protocol watchlist plus every other pre-token protocol the exclusion rules allow — each with a seven-step farm plan netted to the dollar, in a static dashboard that runs with no network. All 758 protocols in the snapshot are accounted for: 196 ranked, 128 trading, 288 on record, 146 set aside with a stated reason.

The value model is a fitted size curve, not a flat multiple: ln(market cap) = 16.24 + 0.48 × (ln TVL − 17.71) + category offset, Huber-weighted over the 128 traded tokens. Leave-one-out median error 0.838 (miss ×3.97) against ×4.90 for the flat median multiple; walk-forward fit-before-2025 miss ×2.85 against ×4.91. Growth, listing age and chain count were each tested as added terms and dropped — none improves out-of-sample error. Top implied value $78.1M (Sentora Curator); total implied value $2.17B.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

The build is deterministic: two runs on the same snapshot write byte-identical board.json, data.js and dossier.json. Screenshots are JPEG (the 1.5 MiB dossier cap does not hold four 300 KB PNGs).

---

<sub>Entered on [make.fun](https://make.fun/?ref=k4mpgm14&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
