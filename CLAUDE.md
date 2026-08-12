# Puzzlr

A hub of small browser games. Nine games, five of which can also be played
online with friends over an invite link. No sign-up, no accounts, no database.
Light and dark themes, following the device until the visitor picks one.

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
    <game>Rules.js    pure rules for Snake and Minesweeper, split out so node
                      can test them without a browser
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

## Wordle is called "Wordl Unlimited" on screen

The registry `id` is still `wordle`, and deliberately so. That id is three
things at once: the route, the key the browser sends the room server
(`GAMES[gameId]` in `server/src/index.js`), and the localStorage key holding
every player's daily streak. Renaming it would need a matching Worker deploy,
would break invite links already shared, and would reset every streak.

So the mismatch between `id: "wordle"` and `name: "Wordl Unlimited"` is
intentional — do not "tidy" it. The component, its file and the internal
comments keep the old name too; only what a player can see was renamed.

## The site editor

`npm run dev`, then <http://localhost:5173/admin>. It edits the site's text,
both colour palettes, the two font faces and the overall text size, and
**saving rewrites the real source files** — `src/content.js` and
`src/shared/theme.js`. An edit is therefore a normal diff to review and commit,
and it goes live on the next deploy like anything else.

It is deliberately dev-only, and that is what keeps it free:

- The route is behind `import.meta.env.DEV`, which folds to a literal `false`
  in a production build, so Rollup drops the editor entirely. If you touch
  this, re-check with `grep -l "Site editor" dist/assets/*.js` after a build.
- The write endpoint is a Vite plugin declaring `apply: 'serve'`, so it exists
  only while the dev server runs. The live site has nothing to authenticate
  and nothing to attack — no login, no database, no runtime fetch.

Two things follow from this that are easy to undo by accident:

- **`src/content.js` must stay plain data.** The writer regenerates the whole
  file from an object, so an import, a computed value or a template literal
  added by hand will not survive the next save.
- **Font sizes are in `rem`, not `px`.** That is the only reason the text-size
  dial works — a px size would ignore it. A new `fontSize: 14` is a bug; write
  `fontSize: "0.875rem"`.

Layout is not editable, and deliberately so. Placement lives in ~400 inline
style objects as flexbox and grid decisions bound to component structure;
exposing that properly means a visual page-builder, which this is not.

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

- **No runtime dependencies.** React, plus Vercel's two measurement packages,
  and nothing else. Keep it that way unless there is a strong reason.
  Build-time devDependencies are fine — the word-bank generator uses several,
  and only its committed output reaches the browser.
  - `@vercel/analytics` and `@vercel/speed-insights` are both mounted once in
    `src/App.jsx`, and both imported from their `/react` entry point. Vercel's
    dashboard defaults its snippets to Next.js; the `/next` imports do not
    build here. Neither package is referenced anywhere else, so both look
    unused to a quick grep — do not strip them. They are deliberate, they are
    cookieless, and they send nothing in development.
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
npm test                            # daily puzzles, Snake and Minesweeper rules
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

`npm test` runs the browser-side suites — daily bookkeeping, Snake's movement
rules and Minesweeper's mechanics. They are the exception to the rule below,
and the reason each is an exception is the same: the interesting cases cannot
be reached by clicking. Daily's span days, Snake's depend on where an apple
randomly spawned, and Minesweeper's need many random boards to show that first
click safety and mine counts hold in general rather than once.

That is also why Snake and Minesweeper keep their rules in a plain `.js`
module beside the component. Node cannot import JSX, so rules buried in a
`.jsx` file cannot be tested at all.

For the browser, drive the real UI rather than trusting a build to pass. Note
that two tabs on the same origin share `localStorage`, so they are the same
player — testing two players needs a scripted websocket client as the opponent,
and it also means both tabs share one daily record.

## Deliberately not built

Ads, About and Privacy Policy pages, and any kind of account system. Hangman,
Imposter, Snake and Minesweeper are local-only for now. Ask before adding any
of these.

Persistent stats used to be on this list. They are still off for ordinary
play — every game's score resets on refresh — but daily puzzles keep a streak
and a guess distribution in `localStorage`, because a daily challenge without a
streak is not really one. That is the whole of the exception: no server, no
account, no history beyond the current device.

Note that ads would make the site commercial, which Vercel's free Hobby plan
does not allow — that would mean $20/month, which is why it has been left
alone.
