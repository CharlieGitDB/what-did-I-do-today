import fs from 'fs';
import path from 'path';
import os from 'os';
import inquirer from 'inquirer';

const CONFIG_DIR = path.join(os.homedir(), '.wdidt');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * @typedef {Object} ConfluenceConfig
 * @property {boolean} enabled - Whether Confluence sync is enabled
 * @property {string} baseUrl - Confluence instance URL (e.g., https://yourcompany.atlassian.net)
 * @property {string} email - User email for authentication
 * @property {string} apiToken - API token for authentication
 * @property {string} spaceKey - Confluence space key where notes will be synced
 * @property {string} parentPageId - Parent page ID under which notes will be created
 */

/**
 * @typedef {Object} Config
 * @property {string} notesDirectory - The directory where notes are stored
 * @property {ConfluenceConfig} [confluence] - Confluence sync configuration
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
    },
    {
      type: 'confirm',
      name: 'setupConfluence',
      message: 'Would you like to sync your notes to Confluence?',
      default: false
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

  if (answers.setupConfluence) {
    console.log('\nLet\'s set up Confluence sync...\n');
    const confluenceConfig = await promptConfluenceSetup();
    config.confluence = confluenceConfig;
    writeConfig(config);
  }

  return config;
}

/**
 * Prompts the user to configure Confluence sync
 * @returns {Promise<ConfluenceConfig>} The Confluence configuration
 */
export async function promptConfluenceSetup() {
  const hasApiKey = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasKey',
      message: 'Do you have a Confluence API token?',
      default: false
    }
  ]);

  if (!hasApiKey.hasKey) {
    console.log('\n📝 To create a Confluence API token:');
    console.log('1. Go to: https://id.atlassian.com/manage-profile/security/api-tokens');
    console.log('2. Click "Create API token"');
    console.log('3. Give it a label like "wdidt"');
    console.log('4. Copy the token');
    console.log('\nAfter creating your token, run: wdidt confluence\n');

    return {
      enabled: false,
      baseUrl: '',
      email: '',
      apiToken: '',
      spaceKey: '',
      parentPageId: ''
    };
  }

  const confluenceAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Confluence URL (e.g., https://yourcompany.atlassian.net):',
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter your Confluence URL';
        }
        if (!input.startsWith('http')) {
          return 'URL must start with http:// or https://';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'email',
      message: 'Your Confluence email:',
      validate: (input) => {
        if (!input.trim() || !input.includes('@')) {
          return 'Please enter a valid email';
        }
        return true;
      }
    },
    {
      type: 'password',
      name: 'apiToken',
      message: 'Your Confluence API token:',
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter your API token';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'spaceKey',
      message: 'Confluence space key (e.g., MYSPACE):',
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter a space key';
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'parentPageId',
      message: 'Parent page ID (optional - leave empty to create at space root):',
      default: ''
    }
  ]);

  return {
    enabled: true,
    baseUrl: confluenceAnswers.baseUrl.replace(/\/$/, ''), // Remove trailing slash
    email: confluenceAnswers.email,
    apiToken: confluenceAnswers.apiToken,
    spaceKey: confluenceAnswers.spaceKey,
    parentPageId: confluenceAnswers.parentPageId
  };
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
