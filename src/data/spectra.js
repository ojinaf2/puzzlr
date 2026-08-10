/* ============================= WAVELENGTH SPECTRA =============================
   Each pair is the two ends of a dial. Shared by the pass-and-play game and the
   room server, so an online round and a local one draw from the same list. */
export const SPECTRA = [
  ["Cold", "Hot"], ["Cheap", "Expensive"], ["Quiet", "Loud"], ["Weird", "Normal"],
  ["Underrated", "Overrated"], ["Villain", "Hero"], ["Old-fashioned", "Modern"], ["Useless", "Useful"],
  ["Scary", "Comforting"], ["Casual", "Formal"], ["Common", "Rare"], ["Round", "Pointy"],
  ["Boring", "Exciting"], ["Dry", "Wet"], ["Simple", "Complicated"], ["Fantasy", "Sci-fi"],
  ["Unhealthy", "Healthy"], ["Temporary", "Permanent"], ["Guilty pleasure", "Respectable"], ["Slow", "Fast"],
];

/* How close counts for how much. Used on both sides so the numbers agree. */
export const scoreForGuess = (guess, target) => {
  const d = Math.abs(guess - target);
  if (d <= 3) return 4;
  if (d <= 8) return 3;
  if (d <= 15) return 2;
  return 0;
};
