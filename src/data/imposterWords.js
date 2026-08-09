/* ============================= IMPOSTER WORD LISTS =============================
   Five categories, fifty common words each. Everyone except the imposter sees
   the same word; the imposter sees only that they are the imposter, plus the
   category if that option is left on. Words are deliberately everyday things —
   an obscure word makes the imposter impossible to catch. */
export const CATEGORIES = [
  {
    key: "animals",
    name: "Animals",
    words: [
      "Dog", "Cat", "Elephant", "Lion", "Tiger", "Bear", "Horse", "Cow", "Sheep", "Goat",
      "Pig", "Chicken", "Duck", "Goose", "Turkey", "Eagle", "Owl", "Penguin", "Dolphin", "Whale",
      "Shark", "Octopus", "Crab", "Lobster", "Frog", "Snake", "Lizard", "Crocodile", "Turtle", "Rabbit",
      "Mouse", "Rat", "Squirrel", "Fox", "Wolf", "Deer", "Moose", "Camel", "Giraffe", "Zebra",
      "Monkey", "Gorilla", "Kangaroo", "Koala", "Panda", "Hippo", "Rhino", "Bat", "Bee", "Butterfly",
    ],
  },
  {
    key: "food",
    name: "Food",
    words: [
      "Pizza", "Burger", "Pasta", "Sushi", "Taco", "Burrito", "Sandwich", "Salad", "Soup", "Steak",
      "Chicken wings", "Bacon", "Eggs", "Pancakes", "Waffles", "Cereal", "Toast", "Rice", "Noodles", "Dumplings",
      "Curry", "Fried chicken", "Hot dog", "French fries", "Mashed potatoes", "Popcorn", "Chips", "Chocolate", "Ice cream", "Cake",
      "Cookies", "Donut", "Brownie", "Pie", "Cheesecake", "Bread", "Cheese", "Butter", "Yogurt", "Honey",
      "Apple", "Banana", "Orange", "Strawberry", "Watermelon", "Grapes", "Mango", "Pineapple", "Avocado", "Tomato",
    ],
  },
  {
    key: "movies",
    name: "Movies",
    words: [
      "Titanic", "Avatar", "Jaws", "Rocky", "Frozen", "Shrek", "Up", "Coco", "Cars", "Alien",
      "Gladiator", "Inception", "Interstellar", "The Godfather", "The Matrix", "Jurassic Park", "Star Wars", "Harry Potter", "The Lion King", "Toy Story",
      "Finding Nemo", "Spider-Man", "Batman", "Superman", "Iron Man", "The Avengers", "Black Panther", "Moana", "Aladdin", "Mulan",
      "Tangled", "Zootopia", "Ratatouille", "Monsters Inc", "The Incredibles", "Home Alone", "Jumanji", "Men in Black", "Ghostbusters", "Back to the Future",
      "Forrest Gump", "The Shining", "Psycho", "King Kong", "Godzilla", "Pirates of the Caribbean", "The Hunger Games", "Twilight", "The Wizard of Oz", "Top Gun",
    ],
  },
  {
    key: "locations",
    name: "Locations",
    words: [
      "Beach", "Airport", "Hospital", "School", "Library", "Museum", "Zoo", "Park", "Restaurant", "Hotel",
      "Casino", "Bank", "Church", "Stadium", "Gym", "Cinema", "Theater", "Supermarket", "Mall", "Pharmacy",
      "Post office", "Police station", "Fire station", "Farm", "Forest", "Desert", "Mountain", "Island", "Cave", "Waterfall",
      "Volcano", "Jungle", "Lake", "River", "Bridge", "Castle", "Prison", "Submarine", "Space station", "Lighthouse",
      "Train station", "Subway", "Bus stop", "Parking lot", "Playground", "Swimming pool", "Camp site", "Barber shop", "Bakery", "Cemetery",
    ],
  },
  {
    key: "objects",
    name: "Objects",
    words: [
      "Chair", "Table", "Bed", "Lamp", "Mirror", "Clock", "Phone", "Laptop", "Television", "Camera",
      "Radio", "Headphones", "Keyboard", "Umbrella", "Backpack", "Wallet", "Keys", "Glasses", "Watch", "Ring",
      "Hat", "Shoes", "Jacket", "Scarf", "Gloves", "Toothbrush", "Soap", "Towel", "Comb", "Scissors",
      "Hammer", "Screwdriver", "Ladder", "Rope", "Bucket", "Broom", "Candle", "Flashlight", "Battery", "Pencil",
      "Pen", "Notebook", "Book", "Newspaper", "Map", "Guitar", "Piano", "Bicycle", "Skateboard", "Ball",
    ],
  },
];

/* How many imposters a group of this size may have. */
export const maxImposters = (n) => (n <= 4 ? 1 : n === 5 ? 2 : n <= 8 ? 3 : 4);
export const MIN_PLAYERS = 3, MAX_PLAYERS = 10;
