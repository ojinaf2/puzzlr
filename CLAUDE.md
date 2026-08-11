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
    daily.js          daily puzzle selection, streaks, sharing
    dailyUi.jsx       the Daily/Practice tabs and the end-of-puzzle stats panel
    utils.js          rand, shuffle
  data/               word lists, countries, spectra — shared with the server
  games/
    index.jsx         THE REGISTRY. Adding a game means one entry here.
    <Game>.jsx        one file per game
scripts/              build-time generators, never shipped to the browser
test/                 node test suites for src/, no framework
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

## Daily puzzles

Wordle and Hangman each have one puzzle a day, the same for everyone, with no
server involved: `src/shared/daily.js` shuffles the answer list with a fixed
seed and reads entry `day - 1`, so every browser works out the same answer for
itself. Nothing repeats until the list is exhausted — 6.8 years for Wordle.
The day rolls over at the player's local midnight, not UTC.

Streaks and guess distributions live in `localStorage` under
`puzzlr:daily:<gameId>`, which makes them per-device on purpose — there are no
accounts to attach a history to, and clearing site data resets a streak.
`finishDaily` is idempotent per day, so a second tab cannot inflate a streak.

`test/daily.test.mjs` covers the bookkeeping, because the interesting cases
span days and the UI cannot reach them without changing the clock.

## Word banks

`src/data/words.js` (Wordle) is hand-maintained and already a **superset of the
full ENABLE dictionary** — 14,855 accepted guesses against ENABLE's 12,578.
There is nothing to gain by importing a dictionary into it; if a real word is
being rejected, the bug is elsewhere.

`src/data/hangmanWords.js` is **generated — do not hand-edit it**:

```bash
npm run build:words        # rewrite it; add --dry to see the stats only
```

The generator takes WordNet's physically concrete noun categories, drops
plurals, gerunds, profanity and words better known as verbs, then sorts what
survives into difficulties by SCOWL commonness band. It keeps every word the
old hand-written banks had. A plain frequency cutoff is not good enough: the
commonest English words are "about" and "accept", which make miserable
hangman. Its dictionaries are devDependencies, so nothing new ships.

## Conventions

- **No runtime dependencies.** React, plus `@vercel/analytics`, and nothing
  else. Keep it that way unless there is a strong reason. Build-time
  devDependencies are fine — the word-bank generator uses several, and only its
  committed output reaches the browser.
  - Analytics is mounted once in `src/App.jsx` and imported from
    `@vercel/analytics/react`. Vercel's dashboard defaults its snippet to
    Next.js; the `/next` import does not build here. Do not remove it as
    "an unused dependency" — it is deliberate, and it is cookieless.
- **Inline styles**, using the `C` palette from `shared/theme.js`. There is no
  CSS framework and `src/index.css` is deliberately almost empty.
- **Depth comes from `shared/theme.js`, not from ad-hoc shadows.** Use
  `grad(colour)` for a lit face, `GLOSS` for the inset white top edge, and
  `SHADOW.sm/md/lg` for elevation. `SHADOW` is two shadows deliberately: a
  tight contact shadow plus a wide ambient one. One blurry shadow is what
  makes a "3D" control look cheap.
  - A raised control gets `className="btn3d"`; a surface that sets its own
    hover transform inline uses `tile3d` or `btn3d-lift` instead, which claim
    only the pressed state. The press lives in CSS `:active` in `Puzzlr.jsx`,
    never in `onMouseDown` handlers — those never fire for a finger and can
    leave a control stuck down if the pointer leaves mid-tap.
  - Icon gradients need ids unique across the whole of `games/index.jsx`. All
    seven render on the landing page at once, and a duplicate id silently
    makes one icon adopt another's colours.
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
npm test                            # daily-puzzle bookkeeping
npm run build:words                 # regenerate src/data/hangmanWords.js

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

`test/daily.test.mjs` (`npm test`) covers the daily bookkeeping in the same
style. It is the exception to the rule below, because its cases span days.

For the browser, drive the real UI rather than trusting a build to pass. Note
that two tabs on the same origin share `localStorage`, so they are the same
player — testing two players needs a scripted websocket client as the opponent,
and it also means both tabs share one daily record.

## Deliberately not built

Ads, About and Privacy Policy pages, and any kind of account system. Hangman
and Imposter are local-only for now. Ask before adding any of these.

Persistent stats used to be on this list. They are still off for ordinary
play — every game's score resets on refresh — but daily puzzles keep a streak
and a guess distribution in `localStorage`, because a daily challenge without a
streak is not really one. That is the whole of the exception: no server, no
account, no history beyond the current device.

Note that ads would make the site commercial, which Vercel's free Hobby plan
does not allow — that would mean $20/month, which is why it has been left
alone.
