import { useId } from 'react';

/* ============================= ICONS =============================

   The small glyphs that stand in for words on the mode tabs and the game
   cards. Drawn here rather than loaded, like the game icons and the footer's
   social marks: crisp at any size, no requests, and nothing that can 404.

   TWO FAMILIES, ON PURPOSE.
   The people are solid silhouettes; everything else is a 2px stroke, matching
   the header's theme and sound switches. That is the same split iOS uses —
   figures read better filled at 16px, outlines read better for objects — and
   it keeps these consistent with the icons the site already had.

   All of them take their colour from `currentColor`, so a tab that is on
   (white on accent) and one that is off (dim) both work with no extra props.

   THE OVERLAP NEEDS A MASK.
   Two and three people overlap, and the gap between them has to be the
   background showing through rather than a white line — these sit on an
   accent fill when selected and on nothing when not. So the figure in front
   is knocked out of the ones behind with a mask. Mask ids must be unique per
   instance, hence `useId`: several of these render on one page, and a
   duplicate id would silently make one icon adopt another's mask. */

const stroke = {
  fill: "none", stroke: "currentColor", strokeWidth: 2,
  strokeLinecap: "round", strokeLinejoin: "round",
};

const Svg = ({ size, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
    style={{ flexShrink: 0, display: "block" }} {...rest}>
    {children}
  </svg>
);

/* Head and shoulders. The body is a half-ellipse rather than a rectangle with
   a rounded top, which is what gives the reference silhouette its shape. */
const dome = (cx, w, h, bottom) => `M${cx - w} ${bottom} a ${w} ${h} 0 0 1 ${2 * w} 0 Z`;

const Figure = ({ cx, cy, r, w, h, bottom, ...rest }) => (
  <g {...rest}>
    <circle cx={cx} cy={cy} r={r} />
    <path d={dome(cx, w, h, bottom)} />
  </g>
);

/* The knockout: the same figure, drawn fatter, in black on a white mask. */
const Cutout = ({ cx, cy, r, w, h, bottom, grow = 1.5 }) => (
  <Figure fill="#000" cx={cx} cy={cy} r={r + grow}
    w={w + grow} h={h + grow} bottom={bottom + grow * 0.4} />
);

/* ------------------------------------------------------------ 1 · solo */
export const PersonIcon = ({ size = 17 }) => (
  <Svg size={size} fill="currentColor">
    <Figure cx={12} cy={8.1} r={4.1} w={7.2} h={6.6} bottom={20.6} />
  </Svg>
);

/* ------------------------------------------- 2 · two players, same device */
const TWO_FRONT = { cx: 9.4, cy: 9.4, r: 3.9, w: 6.6, h: 6.1, bottom: 21 };

export const TwoPeopleIcon = ({ size = 17 }) => {
  const id = useId();
  return (
    <Svg size={size} fill="currentColor">
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <Cutout {...TWO_FRONT} />
      </mask>
      <Figure mask={`url(#${id})`} cx={16} cy={7.3} r={3.4} w={5.8} h={5.4} bottom={19.4} />
      <Figure {...TWO_FRONT} />
    </Svg>
  );
};

/* --------------------------------------------------- 3 · three and more */
const THREE_FRONT = { cx: 12, cy: 9.6, r: 3.7, w: 6.2, h: 5.8, bottom: 21 };

export const ThreePeopleIcon = ({ size = 17 }) => {
  const id = useId();
  return (
    <Svg size={size} fill="currentColor">
      <mask id={id}>
        <rect width="24" height="24" fill="#fff" />
        <Cutout {...THREE_FRONT} />
      </mask>
      <g mask={`url(#${id})`}>
        <Figure cx={5.9} cy={7.4} r={3.1} w={5.2} h={4.9} bottom={19.2} />
        <Figure cx={18.1} cy={7.4} r={3.1} w={5.2} h={4.9} bottom={19.2} />
      </g>
      <Figure {...THREE_FRONT} />
    </Svg>
  );
};

/* Picks the right silhouette for a number of players. Ranges resolve on their
   maximum — a game for up to six is a group, whatever the minimum is. */
export const PeopleIcon = ({ count = 1, size = 17 }) => {
  const Icon = count >= 3 ? ThreePeopleIcon : count === 2 ? TwoPeopleIcon : PersonIcon;
  return <Icon size={size} />;
};

/* Reads a count out of the editable copy — "1 player", "3-10 players". The
   string stays the source of truth so the editor at /admin still governs it,
   and it becomes the icon's label rather than being thrown away. */
export const peopleCount = (players) => {
  const numbers = String(players ?? "").match(/\d+/g);
  return numbers ? Math.max(...numbers.map(Number)) : 1;
};

/* ------------------------------------------------------------ 4 · daily */
export const CalendarIcon = ({ size = 17 }) => (
  <Svg size={size} {...stroke}>
    <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3" />
    <path d="M3.4 9.9h17.2M8.2 3.2v3.6M15.8 3.2v3.6" />
    <rect x="7" y="12.8" width="3.4" height="3.2" rx=".9" fill="currentColor" stroke="none" />
  </Svg>
);

/* -------------------------------------------------------- 5 · unlimited */
export const InfinityIcon = ({ size = 17 }) => (
  <Svg size={size} {...stroke}>
    <path d="M7.1 8.3c2.1 0 3.1 1.5 4.9 3.7s2.8 3.7 4.9 3.7a3.7 3.7 0 0 0 0-7.4c-2.1 0-3.1 1.5-4.9 3.7s-2.8 3.7-4.9 3.7a3.7 3.7 0 0 1 0-7.4Z" />
  </Svg>
);

/* ------------------------------------------------------ 7 · leaderboard */
export const TrophyIcon = ({ size = 17 }) => (
  <Svg size={size} {...stroke}>
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M7 5.6H4.5v1.2A3.4 3.4 0 0 0 8 10.2M17 5.6h2.5v1.2a3.4 3.4 0 0 1-3.5 3.4" />
    <path d="M12 14v3.2M8.5 20.2h7l-.8-3H9.3l-.8 3Z" />
  </Svg>
);

/* -------------------------------------------------- 8 · online, public */
export const GlobeIcon = ({ size = 17 }) => (
  <Svg size={size} {...stroke}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
  </Svg>
);

export const LockIcon = ({ size = 17 }) => (
  <Svg size={size} {...stroke}>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </Svg>
);
