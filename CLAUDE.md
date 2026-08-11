# Puzzlr

A hub of small browser games. Seven games, five of which can also be played
online with friends over an invite link. No sign-up, no accounts, no database.

- Live: <https://playpuzzlr.com> (also `www.`, and the older `puzzlr-one.vercel.app`)
- Repo: `ojinaf2/puzzlr`
- Room server: <https://puzzlr-rooms.playpuzzlr.workers.dev>

## The thing most likely to trip you up

**There are two deploy targets, and pushing to GitHub only updates one of them.**

| What | Where it runs | How it deploys |
| --- | --- | --- |
| The site (`src/`, `public/`) | Vercel | automatically on push to `main` |
| The room server (`server/`) | Cloudflare Workers | only when you run `wrangler deploy` |

If you change anything in `server/`, the live games keep running the old rules
until you deploy the Worker as well. Both, every time.

## Layout

```
src/
  Puzzlr.jsx          hub shell: header, landing, routing, footer. No game logic.
  shared/
    router.js         History API routing and room codes
    theme.js          the C palette every game imports
    ui.jsx            Btn, TileBtn, Centered, hStyle, pStyle
    useRoom.js        websocket connection to a room, with reconnection
    online.jsx        name entry, invite link, connection banner, lobby screens
    utils.js          rand, shuffle
  data/               word lists, countries, spectra — shared with the server
  games/
    index.jsx         THE REGISTRY. Adding a game means one entry here.
    <Game>.jsx        one file per game
server/
  src/index.js        Worker + the Room Durable Object (transport, no rules)
  src/games.js        the rules of every online game, one entry per game
  test/               node test suites, no framework
```

## Adding a game

Local only: write `src/games/YourGame.jsx` with a default-exported component,
import it in `src/games/index.jsx`, append one object to `GAMES`. Nothing else
changes — the landing page counts the games itself.

Online as well: add an entry to `server/src/games.js` (`create`, `start`,
`move`, plus optional `config`, `deadline`, `timeUp`, `forfeit`, `view`), then
have the component branch on the `roomCode` prop it is handed.

## Conventions

- **No runtime dependencies.** React and nothing else. Keep it that way unless
  there is a strong reason.
- **Inline styles**, using the `C` palette from `shared/theme.js`. There is no
  CSS framework and `src/index.css` is deliberately almost empty.
- Times New Roman for headings and the logo, Libre Franklin for everything else.
- Animations live in a `<style>` block inside the game that uses them, and are
  always disabled under `prefers-reduced-motion`.

## Rules live on the server

For online games the Durable Object is the referee. It owns the board, decides
whose turn it is, and rejects anything illegal, so an edited client cannot take
two turns or invent a score. Games may also implement `view(room, playerId)` to
control what each player is sent — Wordle strips the opponent's letters out
rather than trusting the browser not to draw them, and Wavelength sends the
target only to the clue-giver.

**Do not move rules into the browser** to save a round trip.

## Flags

`public/flags/*.svg` are served from our own domain on purpose. They were on a
CDN once and broke in sandboxed previews. Do not point them at a CDN, and do
not move or rename the folder. `FlagQuiz` falls back to showing the two-letter
code if an image fails, so two-letter codes on screen mean the path is wrong.

## Commands

```bash
npm install && npm run dev          # the site, on :5173
npm run build                       # production build

cd server
npm install
npx wrangler dev --port 8787 --show-interactive-dev-session false
node test/rules.test.mjs            # also connect4, wordle, flagquiz, wavelength, room
npx wrangler deploy                 # publish the room server
```

In development the browser talks to `ws://127.0.0.1:8787`. In production the
address comes from `VITE_ROOM_SERVER` in `.env.production`, which is committed
on purpose — it is a public URL, not a secret. If no address is configured the
online buttons hide themselves rather than leading nowhere.

## Testing

The server suites are plain node scripts with no framework: about 256 checks
across rules, each game, and an integration suite that boots the Worker in
Miniflare and plays real games over websockets. Run them after touching
`server/`. Several real bugs were caught this way, including settings being
discarded on start and untimed quizzes rejecting every answer.

For the browser, drive the real UI rather than trusting a build to pass. Note
that two tabs on the same origin share `localStorage`, so they are the same
player — testing two players needs a scripted websocket client as the opponent.

## Deliberately not built

Persistent stats (scores reset on refresh), ads, About and Privacy Policy
pages, and any kind of account system. Hangman and Imposter are local-only for
now. Ask before adding any of these.

Note that ads would make the site commercial, which Vercel's free Hobby plan
does not allow — that would mean $20/month, which is why it has been left
alone.
