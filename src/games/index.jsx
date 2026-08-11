import Wordle from './Wordle.jsx';
import Wavelength from './Wavelength.jsx';
import TicTacToe from './TicTacToe.jsx';
import FlagQuiz from './FlagQuiz.jsx';
import ConnectFour from './ConnectFour.jsx';
import Imposter from './Imposter.jsx';
import Hangman from './Hangman.jsx';

/* ============================= GAME REGISTRY =============================

   The single source of truth for what games exist. Both the landing page and
   the router read from this array — nothing else knows the list.

   TO ADD A GAME:
     1. Create src/games/YourGame.jsx with a default-exported component.
     2. Import it above.
     3. Append one object to GAMES below.
   That's it. No other file needs to change.

   Fields:
     id      unique slug, used as the route value
     name    display name, shown on the card and in the header
     tag     one-line tagline on the card
     accent  colour used for the card hover glow, icon tint and header name
     players badge text on the card
     daily   optional; puts a "Daily" badge on the card
     Comp    the game component itself
     icon    <g> contents of a 52x52 SVG, drawn in the card's icon square

   ABOUT THE ICONS
   Every icon is drawn here rather than loaded as an image: they stay crisp at
   any size, cost no requests, and cannot 404 the way the flags once did. Depth
   comes from three cheap tricks rather than SVG filters — a vertical gradient,
   a translucent white shape along the top edge, and a darker copy of the
   silhouette offset a couple of units downward for a contact shadow.

   Gradient ids must stay unique across the whole file. All seven icons render
   on the landing page at once, and duplicate ids would silently make one
   icon adopt another's colours.
*/
export const GAMES = [
  {
    id: "wordle", name: "Wordle", tag: "Word guessing", accent: "#3aa76d",
    players: "1 player", daily: true, Comp: Wordle,
    icon: (
      <g>
        <defs>
          <linearGradient id="wdG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6fd196" /><stop offset="1" stopColor="#2e8b57" /></linearGradient>
          <linearGradient id="wdY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0c46a" /><stop offset="1" stopColor="#c08a26" /></linearGradient>
          <linearGradient id="wdT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#dcc4a8" /><stop offset="1" stopColor="#a88b6d" /></linearGradient>
        </defs>
        <g fill="rgba(74,53,36,.18)">
          <rect x="4.5" y="20" width="13.6" height="14.6" rx="4.2" />
          <rect x="19.2" y="20" width="13.6" height="14.6" rx="4.2" />
          <rect x="33.9" y="20" width="13.6" height="14.6" rx="4.2" />
        </g>
        <rect x="4.5" y="18" width="13.6" height="14.6" rx="4.2" fill="url(#wdG)" />
        <rect x="19.2" y="18" width="13.6" height="14.6" rx="4.2" fill="url(#wdY)" />
        <rect x="33.9" y="18" width="13.6" height="14.6" rx="4.2" fill="url(#wdT)" />
        <g fill="#fff" opacity=".3">
          <rect x="5.9" y="19.3" width="10.8" height="4.2" rx="2.1" />
          <rect x="20.6" y="19.3" width="10.8" height="4.2" rx="2.1" />
          <rect x="35.3" y="19.3" width="10.8" height="4.2" rx="2.1" />
        </g>
      </g>
    ),
  },
  {
    id: "wavelength", name: "Wavelength", tag: "Read minds", accent: "#4ec3c7",
    players: "2 players", Comp: Wavelength,
    icon: (
      <g>
        <defs>
          <linearGradient id="wvArc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8fe9ec" /><stop offset=".5" stopColor="#4ec3c7" /><stop offset="1" stopColor="#25868a" /></linearGradient>
          <linearGradient id="wvNdl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2604a" /><stop offset="1" stopColor="#8d3220" /></linearGradient>
        </defs>
        <path d="M8 35 A18 18 0 0 1 44 35" fill="none" stroke="rgba(74,53,36,.16)" strokeWidth="7.4" strokeLinecap="round" />
        <path d="M8 33.6 A18 18 0 0 1 44 33.6" fill="none" stroke="url(#wvArc)" strokeWidth="7.4" strokeLinecap="round" />
        <path d="M9.7 32.2 A16.3 16.3 0 0 1 42.3 32.2" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" opacity=".42" />
        <line x1="26" y1="33.6" x2="16.4" y2="21" stroke="url(#wvNdl)" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="26" cy="33.6" r="5.2" fill="#faf1e2" />
        <circle cx="26" cy="33.6" r="5.2" fill="none" stroke="rgba(74,53,36,.2)" strokeWidth="1" />
        <ellipse cx="24.4" cy="31.9" rx="1.9" ry="1.4" fill="#fff" opacity=".9" />
      </g>
    ),
  },
  {
    id: "tictactoe", name: "Tic-Tac-Toe", tag: "Classic 3-in-a-row", accent: "#6c8cff",
    players: "2 players", Comp: TicTacToe,
    icon: (
      <g>
        <defs>
          <linearGradient id="ttX" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9db0ff" /><stop offset="1" stopColor="#4560d8" /></linearGradient>
          <linearGradient id="ttO" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f2907e" /><stop offset="1" stopColor="#c33f28" /></linearGradient>
        </defs>
        <g stroke="#c3a684" strokeWidth="2.8" strokeLinecap="round" opacity=".9">
          <line x1="21" y1="9" x2="21" y2="43" />
          <line x1="32" y1="9" x2="32" y2="43" />
          <line x1="9" y1="20" x2="43" y2="20" />
          <line x1="9" y1="32" x2="43" y2="32" />
        </g>
        <g stroke="url(#ttX)" strokeWidth="4.2" strokeLinecap="round">
          <line x1="11.6" y1="11" x2="18.4" y2="17.8" />
          <line x1="18.4" y1="11" x2="11.6" y2="17.8" />
        </g>
        <circle cx="37.5" cy="37.5" r="4.6" fill="none" stroke="url(#ttO)" strokeWidth="4.2" />
      </g>
    ),
  },
  {
    id: "flags", name: "Flag Quiz", tag: "Guess the country", accent: "#d4a13c",
    players: "1 player", Comp: FlagQuiz,
    icon: (
      <g>
        <defs>
          <linearGradient id="fqF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f4cd7c" /><stop offset="1" stopColor="#bd8620" /></linearGradient>
          <linearGradient id="fqP" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9c7a54" /><stop offset=".4" stopColor="#d9c09a" /><stop offset="1" stopColor="#7d6244" /></linearGradient>
        </defs>
        <ellipse cx="17" cy="44.4" rx="8.6" ry="2.2" fill="rgba(74,53,36,.17)" />
        <rect x="15.2" y="7" width="3.4" height="37.4" rx="1.7" fill="url(#fqP)" />
        <path d="M18.6 9.6 L40.4 9.6 L34.8 17.6 L40.4 25.6 L18.6 25.6 Z" fill="rgba(74,53,36,.16)" transform="translate(0,1.6)" />
        <path d="M18.6 9.6 L40.4 9.6 L34.8 17.6 L40.4 25.6 L18.6 25.6 Z" fill="url(#fqF)" />
        <path d="M18.6 9.6 L25 9.6 L25 25.6 L18.6 25.6 Z" fill="#fff" opacity=".2" />
        <path d="M31 9.6 L35.4 9.6 L35.4 25.6 L31 25.6 Z" fill="rgba(74,53,36,.1)" />
        <circle cx="16.9" cy="6.2" r="2.4" fill="#e0b158" />
        <circle cx="16.2" cy="5.5" r=".9" fill="#fff" opacity=".7" />
      </g>
    ),
  },
  {
    id: "connect4", name: "Connect 4", tag: "Four in a row", accent: "#1b64d4",
    players: "2 players", Comp: ConnectFour,
    icon: (
      <g>
        <defs>
          <linearGradient id="c4B" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4a8cf0" /><stop offset="1" stopColor="#12459b" /></linearGradient>
          <linearGradient id="c4R" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f47963" /><stop offset="1" stopColor="#bd2618" /></linearGradient>
          <linearGradient id="c4Y" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffdf72" /><stop offset="1" stopColor="#dd9f04" /></linearGradient>
          <linearGradient id="c4W" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#e4d3ba" /></linearGradient>
        </defs>
        <rect x="6" y="13.4" width="40" height="31" rx="7.5" fill="rgba(74,53,36,.2)" />
        <rect x="6" y="11.4" width="40" height="31" rx="7.5" fill="url(#c4B)" />
        <rect x="7.8" y="12.9" width="36.4" height="6.4" rx="3.2" fill="#fff" opacity=".22" />
        <g>
          <circle cx="16.4" cy="22.4" r="5.3" fill="url(#c4W)" />
          <circle cx="26" cy="22.4" r="5.3" fill="url(#c4Y)" />
          <circle cx="35.6" cy="22.4" r="5.3" fill="url(#c4W)" />
          <circle cx="16.4" cy="34" r="5.3" fill="url(#c4R)" />
          <circle cx="26" cy="34" r="5.3" fill="url(#c4R)" />
          <circle cx="35.6" cy="34" r="5.3" fill="url(#c4Y)" />
        </g>
        <g fill="#fff" opacity=".5">
          <ellipse cx="24.8" cy="20.5" rx="2.3" ry="1.4" />
          <ellipse cx="15.2" cy="32.1" rx="2.3" ry="1.4" />
          <ellipse cx="24.8" cy="32.1" rx="2.3" ry="1.4" />
          <ellipse cx="34.4" cy="32.1" rx="2.3" ry="1.4" />
        </g>
      </g>
    ),
  },
  {
    id: "hangman", name: "Hangman", tag: "Save the cowboy", accent: "#9c7a54",
    players: "1-6 players", daily: true, Comp: Hangman,
    icon: (
      <g>
        <defs>
          <linearGradient id="hmW" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a8875f" /><stop offset=".4" stopColor="#cdac82" /><stop offset="1" stopColor="#7a5f41" /></linearGradient>
          <linearGradient id="hmH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d2762f" /><stop offset="1" stopColor="#8a4415" /></linearGradient>
          <linearGradient id="hmF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7e2c6" /><stop offset="1" stopColor="#dcbb93" /></linearGradient>
        </defs>
        <rect x="7" y="41.4" width="23" height="4.4" rx="2.2" fill="url(#hmW)" />
        <rect x="12.6" y="7.6" width="4.4" height="34.6" rx="2.2" fill="url(#hmW)" />
        <rect x="12.6" y="7.6" width="23.4" height="4.4" rx="2.2" fill="url(#hmW)" />
        <line x1="33.8" y1="12" x2="33.8" y2="17.4" stroke="#8d6f4c" strokeWidth="2" strokeLinecap="round" />
        <circle cx="33.8" cy="23.6" r="6.1" fill="url(#hmF)" />
        <circle cx="33.8" cy="23.6" r="6.1" fill="none" stroke="rgba(74,53,36,.22)" strokeWidth="1" />
        <path d="M28.2 18 q1.1-7.6 5.6-7.6 q4.5 0 5.6 7.6 z" fill="url(#hmH)" />
        <ellipse cx="33.8" cy="18" rx="10.2" ry="2.7" fill="url(#hmH)" />
        <ellipse cx="33.8" cy="17.3" rx="8.4" ry="1.5" fill="#fff" opacity=".16" />
        <line x1="33.8" y1="29.7" x2="33.8" y2="40" stroke="#6b4a2f" strokeWidth="3.3" strokeLinecap="round" />
      </g>
    ),
  },
  {
    id: "imposter", name: "Imposter", tag: "Spot the faker", accent: "#c0492f",
    players: "3-10 players", Comp: Imposter,
    icon: (
      <g>
        <defs>
          <linearGradient id="imN" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d8c1a4" /><stop offset="1" stopColor="#96795a" /></linearGradient>
          <linearGradient id="imR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e8775f" /><stop offset="1" stopColor="#a3331c" /></linearGradient>
        </defs>
        <circle cx="18" cy="17.4" r="7" fill="url(#imN)" />
        <path d="M7 38.6 c0-6.1 4.9-11 11-11 s11 4.9 11 11 z" fill="url(#imN)" />
        <ellipse cx="15.6" cy="15" rx="2.2" ry="1.6" fill="#fff" opacity=".33" />
        <g>
          <circle cx="34" cy="23.4" r="7.4" fill="rgba(74,53,36,.16)" transform="translate(0,1.4)" />
          <path d="M23 45 c0-6.1 4.9-11 11-11 s11 4.9 11 11 z" fill="rgba(74,53,36,.14)" transform="translate(0,1.4)" />
        </g>
        <circle cx="34" cy="23.4" r="7.4" fill="url(#imR)" />
        <path d="M23 45 c0-6.1 4.9-11 11-11 s11 4.9 11 11 z" fill="url(#imR)" />
        <ellipse cx="31.4" cy="20.8" rx="2.3" ry="1.7" fill="#fff" opacity=".38" />
      </g>
    ),
  },
];

export default GAMES;
