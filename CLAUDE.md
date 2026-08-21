# Puzzlr

A hub of small browser games, several of which can also be played online with
friends over an invite link. No sign-up, no accounts, no database.
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
    online.jsx        name entry, host/join screen, invite link, lobby screens
    rooms.js          browsing open rooms, and testing a code before joining
    daily.js          daily puzzle selection, streaks, sharing
    dailyUi.jsx       the Daily/Practice tabs and the end-of-puzzle stats panel
    identity.js       the two ids and the site-wide display name
    leaderboard.js    fetching and posting scores; the name prompt hook
    leaderboardUi.jsx the ranked table, the name dialog, the header control
    utils.js          rand, shuffle
  content.js          ALL user-facing text; rewritten by the editor at /admin
  admin/AdminPanel.jsx  the dev-only site editor
  data/               word lists, countries, spectra, leaderboard definitions
                      — all shared with the server
  games/
    index.jsx         THE REGISTRY. Adding a game means one entry here.
    <Game>.jsx        one file per game
    <game>Rules.js    pure rules for Snake, Minesweeper and 2048, split out so
                      node can test them without a browser
scripts/              build-time generators, never shipped to the browser
test/                 node test suites for src/, no framework
server/
  src/index.js        Worker, the Room Durable Object, and the Directory
                      object that lists rooms open to join
  src/games.js        the rules of every online game, one entry per game
  src/leaderboard.js  the Leaderboard object: one per game, all its variants
  test/               node test suites, no framework
```

## Adding a game

Local only: write `src/games/YourGame.jsx` with a default-exported component,
import it in `src/games/index.jsx`, and append one entry to `ENTRIES` there
(id, accent, icon, component) **and** one to `CONTENT.games` in
`src/content.js` under the same id (name, tag, blurb, players). The registry
holds structure, `content.js` holds every word — that split is what gives the
editor a single file to rewrite.

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

## Leaderboards

Six games rank their players against everyone else: Wordle and Hangman by
longest daily streak, Tetris and 2048 by highest score, Minesweeper by fastest
clear, Flag Quiz by longest streak. Snake has none, deliberately.

`src/data/leaderboards.js` is the single table of what can be ranked — which
way is better, what bounds are plausible, how a value is formatted — and it is
**imported by the browser and the Worker both**, the same way the word and
country lists are. That matters more here than for a word list: the direction
of a board is what stops a client claiming a "best" Minesweeper time of nine
hours. One copy means the referee and the table it draws cannot disagree.

A game with several variants gets several boards, with a row of chips to
switch between them — a 9x9 time is not a 16x30 time, and a 4x4 2048 score is
not a 6x6 one. A game with one variant shows no chips.

### What they can and cannot promise

**Scores are reported by the browser.** The server checks shape, bounds, and
that submissions are not arriving faster than a person could earn them. It
cannot tell a real 40,000-point Tetris game from a fabricated one, because the
game was simulated in the browser and only the result was sent. This is the
same trade the Tetris section above describes, leaned on harder. It is a wall
of names, not a record book. Do not build anything on top of it that needs to
be true, and do not add prizes.

### Identity, without accounts

There are two ids in `src/shared/identity.js`, and the split is deliberate.
The **room id** is broadcast to everyone in a room, so anybody you have played
against has seen it — fine for reclaiming a seat, wrong for owning a
leaderboard row. The **score id** is generated separately and never sent to a
room. The name is shared: one name for the site, changed from the header.

So a browser holds one row per board however many days it plays, and beating
yourself updates that row rather than adding another. Clearing site data loses
the id and the row with it. There is no account to fall back on — the same
deliberate cost daily streaks already pay.

### Submitting is idempotent, and that is the error handling

Games send their **stored best**, not the run that just finished, and the
server keeps whichever end of the board is winning. A submission lost to a
flaky connection is therefore not lost: the next finished game sends the same
number again, and opening the Leaderboard tab sends it too. That is why
nothing retries, queues or reports a failure — and why a resubmitted best is
not rate limited, since it writes nothing.

Adding it needed a wrangler migration (`v3`) for the `Leaderboard` object, and
a `LEADERBOARDS` binding. Both deploy targets, as always.

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
  - Icon gradients need ids unique across the whole of `games/index.jsx`. They
    all render on the landing page at once, and a duplicate id silently makes
    one icon adopt another's colours.
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

Tetris is the one deliberate exception, and it is worth understanding before
copying the pattern. It is real time, so refereeing it the way the others are
refereed would mean streaming every keypress to the object and running the
simulation there — a round trip per input, in the one game on this site that
lives or dies on feel. Instead the server owns the **seed**, which is what
makes a match fair (both players get the identical piece sequence from the
same deterministic 7-bag), plus the match lifecycle and the verdict. Score and
board are reported by the client.

So an edited Tetris client could inflate its score or decline to admit it
topped out. It cannot deal itself easier pieces. That is the right trade for a
game played with a friend over an invite link.

It is a weaker trade for the leaderboards, which were added anyway in August
2026 with that understood — see below.

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
npm run dev, then /admin            # the site editor (dev only)
npm run build:words                 # regenerate src/data/hangmanWords.js

cd server
npm install
npx wrangler dev --port 8787 --show-interactive-dev-session false
node test/rules.test.mjs            # also connect4, wordle, flagquiz, wavelength,
                                    # tetris, leaderboard, room
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
rules, Minesweeper's mechanics and 2048's sliding and merging. They are the
exception to the rule below, and the reason each is an exception is the same:
the interesting cases cannot be reached by clicking. Daily's span days, Snake's
depend on where an apple randomly spawned, Minesweeper's need many random
boards to show that first click safety and mine counts hold in general rather
than once, and 2048's turn on specific rows — `2 2 2 2` has to give `4 4` and
never `8`, and waiting for that row to turn up by playing is luck.

That is also why those three keep their rules in a plain `.js` module beside
the component. Node cannot import JSX, so rules buried in a `.jsx` file cannot
be tested at all.

For the browser, drive the real UI rather than trusting a build to pass. Note
that two tabs on the same origin share `localStorage`, so they are the same
player — testing two players needs a scripted websocket client as the opponent,
and it also means both tabs share one daily record.

## Wavelength settings

Two host controls, both enforced in `server/src/games.js`:

- **Rounds.** The floor is the number of people in the room, so nobody misses
  their turn at giving a clue — which is the good half of the game. `config`
  refuses anything below it or above twenty, and `start` clamps again, so a
  choice made when the room was larger cannot leave a latecomer without a turn.
- **Change prompt.** The clue-giver may draw a different spectrum, but only
  before their clue is in. The target is redrawn with it, so there is nothing
  to fish for by re-rolling.

## Things that look wrong but are not

Every one of these has already cost an afternoon:

- **`C.text` is the string `"var(--c-text)"`, not a colour.** Colour arithmetic
  goes through `grad`/`paleGrad`/`tint`. `shade()` needs a real hex and is only
  for literals, like the per-game accents in the registry.
- **Font sizes are `rem`.** A `fontSize: 14` is a bug: it ignores the editor's
  text-size dial. Write `fontSize: "0.875rem"`.
- **Percentage padding on an absolutely positioned element** resolves against
  the containing block, not the element. This once made the entire snake
  invisible, leaving only its eyes.
- **`100vw` counts the scrollbar**, and the space available to lay out in does
  not. Size grids as fractions of their container instead.
- **A percentage width inside a shrink-to-fit flex parent** resolves to zero.
  Give the parent an explicit `width: 100%`.
- **The Wordle registry id is `wordle` while its name is "Wordl Unlimited".**
  Deliberate — see the section above.
- **`@vercel/analytics` and `@vercel/speed-insights` look unused.** They are
  mounted once in `App.jsx` and referenced nowhere else. Do not strip them.
- **Snake segments are keyed by distance from the head.** Keying from the tail
  also glides, but makes a new segment appear out of nothing at the head the
  moment an apple is eaten.
- **No game count in any user-facing copy.** Games get added and a number baked
  into a title, description or shared link goes stale immediately.
- **`daily.js` keeps `lastWon` as well as `day`.** They are not the same thing
  and one cannot be derived from the other. `day` is the day the *stored
  board* belongs to, and `saveBoard` moves it to today the moment a guess is
  typed — so by the time a puzzle is finished, "did they win yesterday?" has
  already been overwritten by the act of playing today. Reading continuity off
  `day` meant every streak silently reset to 1 for anyone who typed a guess,
  which is everyone. Fixed August 2026; `test/daily.test.mjs` now plays through
  `saveBoard` rather than calling `finishDaily` twice in a row, which is what
  hid it.
- **Two ids in `identity.js` is not duplication.** The room id is public to
  everyone in your room; the score id is not. See the leaderboard section.

## Deliberately not built

Ads, About and Privacy Policy pages, and any kind of account system. Hangman,
Imposter, Snake and Minesweeper are local-only for now. Ask before adding any
of these.

Persistent stats used to be on this list. They are still off for ordinary
play — every game's score resets on refresh — but daily puzzles keep a streak
and a guess distribution in `localStorage`, because a daily challenge without a
streak is not really one.

Leaderboards used to be on it too, and were asked for in August 2026. They are
the one thing here that stores something about a player on a server: a name, a
number and a random id per board. Still no account, no login, no email, and
nothing tying the rows to a person — clearing site data walks away from them.
Anything more than that is still off the list; ask first.

Note that ads would make the site commercial, which Vercel's free Hobby plan
does not allow — that would mean $20/month, which is why it has been left
alone.

## Hosting and joining

Online games start at a Host / Join screen (`OnlineEntry` in `shared/online.jsx`),
not by inventing a code. The two are genuinely different acts on the server:

- **Host** sends `create: true` and a `visibility`. Only that creates a room.
- **Join** sends neither. A code with no room behind it comes back as
  `{ type: 'error', code: 'not-found' }` rather than quietly making one — which
  is what used to happen to anyone who mistyped a code.

`shared/rooms.js` performs the join over a throwaway socket *before* navigating,
which is what lets "No room found" appear on the form next to the box you typed
in. Re-joining is free: the seat is keyed by player id.

The intent is remembered in memory per code, because it matters on every
reconnect — a host whose socket drops before anyone arrives must still be
allowed to recreate the room, and a joiner must never create one.

### The Directory object

Durable Objects cannot see each other, so a second one (`Directory`, a single
instance) keeps the list of rooms open to join. Rooms announce themselves on
every change and withdraw when they start, empty or expire.

- It is **advisory only**. A room can fill between being listed and being
  tapped, so joining still goes through the room and can still be refused.
- Resolving the `DIRECTORY` binding is inside a try/catch on purpose. If it is
  missing — un-run migration, older deploy, a test harness that does not bind
  it — rooms must keep working over their codes regardless.
- Private rooms **are** listed, marked with a lock, but cannot be joined from
  the list. Worth knowing this leaks the host's name and that a room exists.
  If that is unwanted, filter them out in `Directory`'s `/list`.

Adding it needed a wrangler migration (`v2`). Both deploy targets, as always.
