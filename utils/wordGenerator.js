/**
 * @fileoverview Generates memorable 3-word identifiers for references
 */

const adjectives = [
  'quick', 'lazy', 'happy', 'bright', 'calm', 'bold', 'wise', 'cool', 'warm', 'dark',
  'light', 'swift', 'slow', 'loud', 'quiet', 'sharp', 'soft', 'hard', 'smooth', 'rough',
  'sweet', 'sour', 'bitter', 'fresh', 'stale', 'clean', 'dirty', 'neat', 'messy', 'pure',
  'wild', 'tame', 'free', 'tight', 'loose', 'dense', 'thin', 'thick', 'narrow', 'wide',
  'tall', 'short', 'deep', 'shallow', 'heavy', 'light', 'strong', 'weak', 'brave', 'shy'
];

const nouns = [
  'fox', 'dog', 'cat', 'bird', 'fish', 'bear', 'lion', 'tiger', 'wolf', 'deer',
  'eagle', 'hawk', 'owl', 'crow', 'dove', 'swan', 'duck', 'frog', 'toad', 'snake',
  'tree', 'rock', 'river', 'lake', 'mountain', 'valley', 'forest', 'desert', 'ocean', 'beach',
  'star', 'moon', 'sun', 'cloud', 'wind', 'rain', 'snow', 'fire', 'ice', 'thunder',
  'sword', 'shield', 'hammer', 'arrow', 'spear', 'axe', 'bow', 'staff', 'crown', 'ring'
];

const verbs = [
  'runs', 'jumps', 'flies', 'swims', 'climbs', 'walks', 'crawls', 'dances', 'sings', 'whispers',
  'shouts', 'laughs', 'cries', 'smiles', 'frowns', 'thinks', 'dreams', 'hopes', 'fears', 'loves',
  'hates', 'likes', 'wants', 'needs', 'sees', 'hears', 'feels', 'tastes', 'smells', 'touches',
  'builds', 'breaks', 'makes', 'takes', 'gives', 'finds', 'loses', 'wins', 'fails', 'tries',
  'starts', 'stops', 'goes', 'stays', 'comes', 'leaves', 'enters', 'exits', 'opens', 'closes'
];

/**
 * Generates a random 3-word identifier
 * @returns {string} A 3-word identifier in format "adjective-verb-noun"
 */
export function generateThreeWordId() {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const verb = verbs[Math.floor(Math.random() * verbs.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];

  return `${adjective}-${verb}-${noun}`;
}

/**
 * Generates a unique 3-word identifier that doesn't exist in any content
 * @param {Function} checkExists - Async function that checks if an ID exists
 * @param {number} maxAttempts - Maximum number of generation attempts (default: 100)
 * @returns {Promise<string>} A unique 3-word identifier
 * @throws {Error} If unable to generate unique ID after maxAttempts
 */
export async function generateUniqueThreeWordId(checkExists, maxAttempts = 100) {
  for (let i = 0; i < maxAttempts; i++) {
    const id = generateThreeWordId();
    const exists = await checkExists(id);

    if (!exists) {
      return id;
    }
  }

  throw new Error(`Unable to generate unique ID after ${maxAttempts} attempts`);
}
