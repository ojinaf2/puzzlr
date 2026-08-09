/* Tiny helpers shared by the games. */
export const rand = (n) => Math.floor(Math.random() * n);
export const shuffle = (a) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = rand(i + 1); [x[i], x[j]] = [x[j], x[i]]; } return x; };
