import fs from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';

const CONFIG_DIR = path.join(os.homedir(), '.wdidt');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * @typedef {Object} Config
 * @property {string} notesDirectory - The directory where notes are stored
 */

/**
 * Ensures the config directory exists
 * @returns {void}
 */
export function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Reads the config file
 * @returns {Config|null} The configuration object or null if it doesn't exist
 */
export function readConfig() {
  ensureConfigDir();

  if (!fs.existsSync(CONFIG_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Writes the config file
 * @param {Config} config - The configuration object to write
 * @returns {void}
 */
export function writeConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Prompts the user to configure the notes directory on first run
 * @returns {Promise<Config>} The created configuration
 */
export async function promptFirstTimeSetup() {
  console.log('Welcome to wdidt! Let\'s set up your notes directory.\n');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'notesDirectory',
      message: 'Where would you like to save your notes?',
      default: path.join(os.homedir(), 'Documents', 'daily-notes'),
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter a valid path';
        }
        return true;
      }
    }
  ]);

  const notesDir = path.resolve(answers.notesDirectory);

  // Create the directory if it doesn't exist
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir, { recursive: true });
  }

  const config = {
    notesDirectory: notesDir
  };

  writeConfig(config);
  console.log(`\n✓ Configuration saved! Your notes will be stored in: ${notesDir}\n`);

  return config;
}

/**
 * Gets the config, prompting for setup if it doesn't exist
 * @returns {Promise<Config>} The configuration object
 */
export async function getConfig() {
  let config = readConfig();

  if (!config) {
    config = await promptFirstTimeSetup();
  }

  return config;
}
