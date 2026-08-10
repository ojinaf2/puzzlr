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
     accent  colour used for the card hover border and the header game name
     players badge text on the card
     Comp    the game component itself
     icon    <g> contents of a 52x52 SVG, drawn in the card's icon square
*/
export const GAMES = [
  { id: "wordle", name: "Wordle", tag: "Word guessing", accent: "#3aa76d", players: "1 player", Comp: Wordle,
    icon: (<g><rect x="6" y="14" width="12" height="12" rx="2" fill="#3aa76d"/><rect x="20" y="14" width="12" height="12" rx="2" fill="#b79b7e"/><rect x="34" y="14" width="12" height="12" rx="2" fill="#d4a13c"/></g>) },
  { id: "wavelength", name: "Wavelength", tag: "Read minds", accent: "#4ec3c7", players: "2 players", Comp: Wavelength,
    icon: (<g><path d="M8 30 A18 18 0 0 1 44 30" fill="none" stroke="#b79b7e" strokeWidth="5"/><line x1="26" y1="30" x2="14" y2="16" stroke="#4ec3c7" strokeWidth="4" strokeLinecap="round"/><circle cx="26" cy="30" r="4" fill="#4ec3c7"/></g>) },
  { id: "tictactoe", name: "Tic-Tac-Toe", tag: "Classic 3-in-a-row", accent: "#6c8cff", players: "2 players", Comp: TicTacToe,
    icon: (<g stroke="#9c7a54" strokeWidth="2.5"><line x1="22" y1="10" x2="22" y2="42"/><line x1="32" y1="10" x2="32" y2="42"/><line x1="12" y1="20" x2="42" y2="20"/><line x1="12" y1="32" x2="42" y2="32"/><text x="13" y="19" fill="#6c8cff" stroke="none" fontSize="11" fontWeight="800">X</text><text x="34" y="41" fill="#e5604d" stroke="none" fontSize="11" fontWeight="800">O</text></g>) },
  { id: "flags", name: "Flag Quiz", tag: "Guess the country", accent: "#d4a13c", players: "1 player", Comp: FlagQuiz,
    icon: (<g><line x1="16" y1="8" x2="16" y2="40" stroke="#9c7a54" strokeWidth="2.5"/><path d="M16 10 L40 10 L34 18 L40 26 L16 26 Z" fill="#d4a13c"/></g>) },
  { id: "connect4", name: "Connect 4", tag: "Four in a row", accent: "#1b64d4", players: "2 players", Comp: ConnectFour,
    icon: (<g><rect x="7" y="12" width="38" height="30" rx="5" fill="#1b64d4"/><circle cx="17" cy="22" r="5" fill="#fdf6e9"/><circle cx="26" cy="22" r="5" fill="#f6c31c"/><circle cx="35" cy="22" r="5" fill="#fdf6e9"/><circle cx="17" cy="34" r="5" fill="#d62828"/><circle cx="26" cy="34" r="5" fill="#d62828"/><circle cx="35" cy="34" r="5" fill="#f6c31c"/></g>) },
  { id: "hangman", name: "Hangman", tag: "Save the cowboy", accent: "#9c7a54", players: "1-6 players", Comp: Hangman,
    icon: (<g><g stroke="#9c7a54" strokeWidth="3" strokeLinecap="round" fill="none"><line x1="10" y1="44" x2="30" y2="44"/><line x1="15" y1="44" x2="15" y2="9"/><line x1="15" y1="9" x2="34" y2="9"/><line x1="34" y1="9" x2="34" y2="15"/></g><circle cx="34" cy="21" r="6" fill="none" stroke="#4a3524" strokeWidth="3"/><ellipse cx="34" cy="15" rx="11" ry="2.5" fill="#b5651d"/><path d="M28 15 q1-7 6-7 q5 0 6 7 z" fill="#a0522d"/><line x1="34" y1="27" x2="34" y2="40" stroke="#4a3524" strokeWidth="3" strokeLinecap="round"/></g>) },
  { id: "imposter", name: "Imposter", tag: "Spot the faker", accent: "#c0492f", players: "3-10 players", Comp: Imposter,
    icon: (<g><circle cx="18" cy="18" r="6.5" fill="#b79b7e"/><path d="M8 38c0-5.5 4.5-10 10-10s10 4.5 10 10z" fill="#b79b7e"/><circle cx="34" cy="24" r="6.5" fill="#c0492f"/><path d="M24 44c0-5.5 4.5-10 10-10s10 4.5 10 10z" fill="#c0492f"/></g>) },
];

export default GAMES;
