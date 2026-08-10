import { validSet } from './words.js';

/* ============================= HANGMAN WORD BANKS =============================
   Curated rather than scraped. A giant dictionary dump would be full of proper
   nouns, plurals and obscurities that make hangman miserable to play, so these
   are concrete everyday words chosen to be fair to guess.

     easy    common words, 4-6 letters
     medium  slightly less common, 4-7 letters
     hard    short 3-letter words and long 6-9 letter ones, both awkward to crack
*/

const EASY = [
  "baby", "back", "ball", "band", "bank", "bath", "bear", "bell", "belt", "bird",
  "blue", "boat", "body", "bone", "book", "boot", "bowl", "cake", "camp", "card",
  "cart", "cash", "city", "club", "coal", "coat", "cook", "corn", "crew", "crop",
  "dark", "dawn", "desk", "dish", "door", "drum", "dust", "farm", "fire", "fish",
  "flag", "food", "foot", "fork", "fuel", "game", "gate", "gift", "girl", "goal",
  "gold", "hair", "hall", "hand", "hawk", "head", "heat", "hero", "hill", "hole",
  "home", "horn", "hour", "iron", "king", "knee", "lake", "lamp", "land", "leaf",
  "lion", "lock", "mail", "meal", "meat", "milk", "moon", "nail", "neck", "nest",
  "nose", "note", "oven", "page", "pain", "pair", "park", "path", "pear", "poem",
  "pool", "port", "rain", "rice", "ring", "road", "rock", "roof", "room", "root",
  "rope", "rose", "sail", "salt", "sand", "seat", "seed", "ship", "shoe", "shop",
  "silk", "sink", "skin", "snow", "soap", "sock", "song", "soup", "star", "step",
  "tail", "tank", "tape", "team", "tent", "tide", "tile", "time", "tool", "town",
  "tree", "trip", "tube", "tune", "wall", "wave", "week", "wind", "wine", "wing",
  "wire", "wolf", "wood", "wool", "word", "work", "worm", "yard", "year", "zone",
  "apple", "beach", "bench", "bread", "brick", "brush", "chair", "chalk", "chess",
  "chest", "child", "cloud", "clown", "coast", "couch", "cream", "crown", "dance",
  "diary", "dream", "dress", "drink", "eagle", "earth", "fence", "field", "flame",
  "floor", "flour", "fruit", "ghost", "glass", "glove", "grape", "grass", "green",
  "heart", "honey", "horse", "house", "juice", "knife", "light", "money", "mouse",
  "music", "night", "ocean", "onion", "paint", "paper", "party", "peach", "pearl",
  "phone", "piano", "pizza", "plant", "plate", "queen", "radio", "river", "robot",
  "salad", "sheep", "shirt", "shore", "skirt", "smile", "snake", "spoon", "stage",
  "stone", "storm", "sugar", "table", "tiger", "toast", "tooth", "towel", "tower",
  "train", "truck", "watch", "water", "wheel", "whale", "witch", "world", "youth",
  "animal", "arrow", "artist", "autumn", "basket", "bottle", "branch", "bridge",
  "bucket", "butter", "camera", "candle", "carpet", "castle", "cheese", "cherry",
  "circle", "coffee", "cookie", "cotton", "doctor", "dragon", "engine", "farmer",
  "finger", "flower", "forest", "garden", "guitar", "hammer", "island", "jacket",
  "jungle", "ladder", "laptop", "lemon", "letter", "market", "meadow", "mirror",
  "monkey", "mother", "needle", "orange", "palace", "pencil", "picnic", "pocket",
  "potato", "rabbit", "ribbon", "rocket", "school", "silver", "singer", "sister",
  "spider", "spring", "square", "statue", "street", "summer", "sunset", "teapot",
  "ticket", "tomato", "turtle", "valley", "violin", "wallet", "window", "winter",
  "yellow",
];

const MEDIUM = [
  "amber", "anchor", "antler", "apron", "attic", "badge", "barrel", "beetle",
  "birch", "bishop", "blade", "blaze", "bloom", "boulder", "bracket", "breeze",
  "cabin", "cactus", "canvas", "canyon", "cargo", "cattle", "cavern", "cellar",
  "chapel", "charm", "cider", "cinder", "circus", "clamp", "cliff", "cloak",
  "clover", "cobweb", "collar", "column", "comet", "compass", "copper", "coral",
  "cradle", "crane", "crater", "cricket", "crumb", "crust", "cymbal", "dagger",
  "dairy", "dusk", "decoy", "dolphin", "donkey", "drawer", "drift", "dwarf",
  "ember", "fabric", "falcon", "fang", "feather", "ferry", "fiddle", "flask",
  "fleet", "flint", "flute", "forge", "fossil", "fringe", "frost", "gadget",
  "gallop", "gasp", "gauge", "gazelle", "glacier", "glider", "granite", "gravel",
  "grill", "grove", "gutter", "hamlet", "harbor", "harvest", "hazel", "hedge",
  "helmet", "hermit", "hollow", "hornet", "hurdle", "icicle", "ivory", "jigsaw",
  "kennel", "kettle", "keyhole", "lantern", "lattice", "lever", "lichen", "lily",
  "limber", "linen", "lobster", "locker", "lodge", "lumber", "magnet", "mammoth",
  "manor", "maple", "marble", "marsh", "mason", "meteor", "midway", "mineral",
  "mitten", "moss", "muffin", "mustard", "nectar", "nickel", "nomad", "nozzle",
  "nugget", "oyster", "paddle", "pantry", "parcel", "parrot", "pasture", "pebble",
  "pelican", "penguin", "pepper", "pewter", "pigeon", "pillar", "pirate", "piston",
  "plank", "plaza", "plume", "pollen", "poncho", "porch", "prairie", "pretzel",
  "prism", "pulley", "pumpkin", "quarry", "quartz", "quiver", "raccoon", "radish",
  "rafter", "ranch", "raven", "reef", "relic", "rhubarb", "ripple", "roost",
  "rubble", "rudder", "saddle", "salmon", "sapling", "sardine", "satchel", "sawmill",
  "scarf", "scroll", "seagull", "shovel", "shrimp", "sickle", "siren", "sleigh",
  "sliver", "smoke", "snail", "sparrow", "sphinx", "spiral", "sponge", "sprout",
  "squash", "stable", "stirrup", "stencil", "stork", "stubble", "swamp", "tackle",
  "talon", "tavern", "temple", "tendril", "thicket", "thimble", "thorn", "thunder",
  "timber", "toffee", "torch", "trawler", "trellis", "tripod", "trolley", "trumpet",
  "tulip", "tundra", "turnip", "tusk", "vessel", "vinegar", "walnut", "warbler",
  "weasel", "whisker", "willow", "wombat", "wreath", "wrench", "zebra", "zenith",
];

const HARD = [
  // short and brutal: few letters, little to work with
  "axe", "bat", "bay", "bee", "bud", "bug", "bus", "cab", "cap", "cat",
  "cog", "cow", "cub", "cup", "dam", "den", "dew", "dog", "dot", "ear",
  "eel", "egg", "elf", "elk", "elm", "eye", "fan", "fig", "fin", "fog",
  "fox", "fur", "gem", "gum", "gun", "hat", "hen", "hip", "hog", "hut",
  "ice", "ink", "ivy", "jam", "jar", "jaw", "jet", "job", "jug", "key",
  "kit", "lab", "lap", "law", "leg", "lid", "lip", "log", "map", "mat",
  "mud", "mug", "nap", "net", "nut", "oak", "oar", "oil", "owl", "pan",
  "paw", "pea", "pen", "pet", "pie", "pig", "pin", "pit", "pod", "pot",
  "pup", "rag", "ram", "rat", "ray", "rib", "rim", "rod", "rug", "rye",
  "sap", "saw", "sea", "sky", "spy", "sun", "tag", "tar", "tax", "tea",
  "tie", "tin", "tip", "toe", "ton", "top", "toy", "tub", "van", "vat",
  "vet", "war", "wax", "web", "wig", "wok", "yak", "yam", "zip",
  // long and unwieldy
  "acrobat", "airfield", "alchemy", "ambush", "anchovy", "antelope", "aquarium",
  "armchair", "asteroid", "avalanche", "backpack", "balcony", "bandage", "banquet",
  "barbecue", "barnacle", "beacon", "bicycle", "biscuit", "blanket", "blizzard",
  "brochure", "buffalo", "bulldozer", "butterfly", "cabinet", "calendar", "campfire",
  "caravan", "cardigan", "carnival", "cathedral", "cauldron", "cavalry", "ceiling",
  "ceramic", "chariot", "chestnut", "chimney", "cinnamon", "clarinet", "cobbler",
  "cocoon", "concrete", "corridor", "cottage", "crescent", "crocodile", "crossbow",
  "cucumber", "cupboard", "curtain", "cyclone", "daffodil", "dandelion", "daughter",
  "dinosaur", "doorbell", "dragonfly", "driftwood", "dumpling", "dungeon", "earlobe",
  "eggplant", "elephant", "envelope", "escalator", "eyebrow", "festival", "firefly",
  "fireplace", "flamingo", "flapjack", "flounder", "footpath", "fountain", "furnace",
  "gargoyle", "gazebo", "giraffe", "gondola", "goldfish", "gosling", "graffiti",
  "grapevine", "gatehouse", "gumdrop", "hacienda", "hairpin", "hallway", "hamburger",
  "hamster", "handbook", "hedgehog", "hibiscus", "hillside", "honeybee", "hourglass",
  "hurricane", "iceberg", "jackpot", "jamboree", "jellyfish", "kangaroo", "keyboard",
  "lavender", "lemonade", "leopard", "lifeboat", "limestone", "lollipop", "macaroni",
  "magnolia", "mahogany", "mandolin", "marigold", "mattress", "meatball", "mermaid",
  "midnight", "milkshake", "mistletoe", "moonlight", "mosquito", "mushroom", "mustache",
  "narwhal", "notebook", "obstacle", "octagon", "octopus", "orangutan", "orchard",
  "ostrich", "outfield", "overcoat", "pancake", "paradise", "parakeet", "parasol",
  "parsnip", "passport", "pavement", "peacock", "pendulum", "porcelain", "pheasant",
  "pinecone", "pineapple", "pistachio", "platypus", "porridge", "porcupine", "postcard",
  "primrose", "pyramid", "quicksand", "railroad", "rainbow", "raspberry", "reindeer",
  "racetrack", "riverbank", "rosemary", "sailboat", "sandstone", "sapphire", "sawdust",
  "scaffold", "scarecrow", "scorpion", "seahorse", "seashell", "shipwreck", "shoelace",
  "sidewalk", "signpost", "skeleton", "skylight", "songbird", "snowflake", "somewhere",
  "spaghetti", "squirrel", "starfish", "stopwatch", "steamboat", "sunflower", "sycamore",
  "tadpole", "tangerine", "telescope", "thumbnail", "tortoise", "treasure", "trombone",
  "turquoise", "umbrella", "vineyard", "volcano", "waterfall", "wristband", "whirlpool",
  "windmill", "wishbone", "woodland", "workshop", "yardstick", "zeppelin", "zucchini",
];

export const DIFFICULTIES = [
  { key: "easy", name: "Easy", blurb: "Common words, 4-6 letters", words: EASY },
  { key: "medium", name: "Medium", blurb: "Less common, 4-7 letters", words: MEDIUM },
  { key: "hard", name: "Hard", blurb: "Very short or very long words", words: HARD },
];

export const pickWord = (key) => {
  const d = DIFFICULTIES.find((x) => x.key === key) || DIFFICULTIES[0];
  return d.words[Math.floor(Math.random() * d.words.length)];
};

/* --------------------------- spelling suggestions ---------------------------
   Used only to offer a gentle "did you mean" when a player sets a word by hand.
   It never blocks a submission: a deliberate misspelling, an inside joke or a
   name is all fair game, and the group can argue about it themselves. */
const BANK_WORDS = [...EASY, ...MEDIUM, ...HARD];

/* Spelled-correctly check casts a wide net — the Wordle list adds ~14,800 more
   real words, so a valid word is not wrongly flagged. */
const KNOWN = new Set([...BANK_WORDS, ...validSet]);
export const isKnownWord = (w) => KNOWN.has(w.toLowerCase());

/* Levenshtein distance, abandoned as soon as it cannot come in under `max`. */
const distanceWithin = (a, b, max) => {
  if (Math.abs(a.length - b.length) > max) return Infinity;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (row[j] < rowBest) rowBest = row[j];
    }
    if (rowBest > max) return Infinity;
    prev = row;
  }
  return prev[b.length] <= max ? prev[b.length] : Infinity;
};

/* Nearest everyday word, or null when nothing is close.
   Suggestions come only from the curated banks, never from the Wordle list:
   that list is full of obscurities like "agita" and "anana" which win on edit
   distance and make the hint worse than useless. */
export const suggestSpelling = (raw) => {
  const w = raw.toLowerCase();
  if (!w || isKnownWord(w)) return null;
  const max = w.length <= 4 ? 1 : 2;
  let best = null, bestDistance = Infinity;
  for (const cand of BANK_WORDS) {
    const d = distanceWithin(w, cand, max);
    if (d < bestDistance) {
      bestDistance = d; best = cand;
      if (d === 1) break;              // a single edit is as close as it gets here
    }
  }
  return bestDistance <= max ? best : null;
};
