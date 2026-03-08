# Deploying Cooperative Poker (AppDeploy)

## App info

- **Live app:** https://cooperative-poker-ybazv.v2.appdeploy.ai/
- **App ID:** `9fa3fb53f2ea4bc3b5`

## Deploy

Run from the repo root (or anywhere):

```bash
node cooperative-poker/deploy/deploy-all.js
```

That's it. The script:

1. Reads auth from `~/.claude/.credentials.json` (auto-refreshes if expired)
2. Reads all source files directly from `cooperative-poker/`
3. Deploys them to AppDeploy in 7 sequential batches
4. Polls each batch until `ready` before moving to the next

No Claude tokens are used — all calls go directly to `api-v2.appdeploy.ai`.

## Batches

| # | Contents |
|---|----------|
| FE 1 | `_app`, `index`, `home`, `profile`, `admin`, `hand`, `globals.css`, `lib/api.ts`, configs |
| FE 2 | `create-combo`, `join-combo`, `combo` |
| FE 3 | `score`, `leaderboard`, `combo-scoring` |
| FE 4 | `interactions`, `instructions`, `icebreak`, `contact/[id]`, `about` |
| BE 1 | `backend/types`, `http-utils`, `auth`, `players`, `decks`, `events` |
| BE 2 | `backend/db`, `icebreaker`, `interactions`, `combos` |
| BE 3 | `backend/poker`, `index` |

Batching exists solely to stay within AppDeploy's per-call payload size limit.

## Check status

```bash
# After deploy, verify the app is live:
curl https://cooperative-poker-ybazv.v2.appdeploy.ai/
```
