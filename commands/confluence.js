import chalk from 'chalk';
import inquirer from 'inquirer';
import { promptConfluenceSetup, readConfig, writeConfig } from '../utils/config.js';

/**
 * Configures or reconfigures Confluence sync settings
 * @returns {Promise<void>}
 */
export async function configureConfluence() {
  console.log(chalk.blue('Confluence Configuration\n'));

  const config = readConfig();

  // If Confluence is already configured, offer to update or reconfigure
  if (config && config.confluence && config.confluence.enabled) {
    console.log(chalk.green('✓ Confluence is already configured:'));
    console.log(`  URL: ${chalk.cyan(config.confluence.baseUrl)}`);
    console.log(`  Email: ${chalk.cyan(config.confluence.email)}`);
    console.log(`  Space: ${chalk.cyan(config.confluence.spaceKey)}`);
    console.log(`  Parent Page ID: ${chalk.cyan(config.confluence.parentPageId || '(none)')}\n`);

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Update specific settings', value: 'update' },
          { name: 'Reconfigure everything', value: 'reconfigure' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);

    if (action === 'cancel') {
      console.log(chalk.gray('Configuration unchanged.\n'));
      return;
    }

    if (action === 'update') {
      await updateConfluenceSettings(config);
      return;
    }

    // If reconfigure, continue to full setup below
  }

  // Full configuration
  const confluenceConfig = await promptConfluenceSetup();

  if (config) {
    config.confluence = confluenceConfig;
    writeConfig(config);

    if (confluenceConfig.enabled) {
      console.log(chalk.green('\n✓ Confluence sync configured successfully!'));
      console.log(`Run ${chalk.cyan('wdidt sync')} to sync your notes to Confluence.\n`);
    } else {
      console.log(chalk.yellow('\n⚠ Confluence sync not enabled. Run this command again when you have your API token.\n'));
    }
  } else {
    console.log(chalk.red('\n✗ No configuration found. Please run wdidt with any command first to initialize.\n'));
  }
}

/**
 * Updates specific Confluence settings without losing everything
 * @param {Object} config - The current configuration
 * @returns {Promise<void>}
 */
async function updateConfluenceSettings(config) {
  const currentConf = config.confluence;

  const basicAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Confluence URL:',
      default: currentConf.baseUrl,
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
      default: currentConf.email,
      validate: (input) => {
        if (!input.trim() || !input.includes('@')) {
          return 'Please enter a valid email';
        }
        return true;
      }
    },
    {
      type: 'confirm',
      name: 'updateApiToken',
      message: 'Update API token?',
      default: false
    },
    {
      type: 'password',
      name: 'apiToken',
      message: 'Your Confluence API token:',
      when: (answers) => answers.updateApiToken,
      validate: (input) => {
        if (!input.trim()) {
          return 'Please enter your API token';
        }
        return true;
      }
    }
  ]);

  const apiToken = basicAnswers.updateApiToken ? basicAnswers.apiToken : currentConf.apiToken;

  // Fetch spaces with current or new credentials
  console.log('\nFetching spaces...');

  const { ConfluenceClient } = await import('../utils/confluenceClient.js');
  const client = new ConfluenceClient(
    basicAnswers.baseUrl.replace(/\/$/, ''),
    basicAnswers.email,
    apiToken
  );

  let spaceKey = currentConf.spaceKey;

  try {
    const spaces = await client.listSpaces();

    if (spaces.length === 0) {
      console.log('\n⚠ No spaces found.\n');
      const manualAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'spaceKey',
          message: 'Confluence space key:',
          default: currentConf.spaceKey,
          validate: (input) => {
            if (!input.trim()) {
              return 'Please enter a space key';
            }
            return true;
          }
        }
      ]);
      spaceKey = manualAnswer.spaceKey;
    } else {
      console.log(`\n✓ Found ${spaces.length} space(s)\n`);

      // Find current space in the list to set as default
      const currentSpaceIndex = spaces.findIndex(s => s.key === currentConf.spaceKey);

      const spaceAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedSpace',
          message: 'Select your Confluence space:',
          choices: spaces.map(space => ({
            name: `${space.name} (${space.key})`,
            value: space.key
          })),
          default: currentSpaceIndex >= 0 ? currentSpaceIndex : 0,
          pageSize: 10
        }
      ]);
      spaceKey = spaceAnswer.selectedSpace;
    }
  } catch (error) {
    console.log(`\n⚠ Could not fetch spaces: ${error.message}`);
    console.log('Using manual entry.\n');

    const manualAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'spaceKey',
        message: 'Confluence space key:',
        default: currentConf.spaceKey,
        validate: (input) => {
          if (!input.trim()) {
            return 'Please enter a space key';
          }
          return true;
        }
      }
    ]);
    spaceKey = manualAnswer.spaceKey;
  }

  const finalAnswers = await inquirer.prompt([
    {
      type: 'input',
      name: 'parentPageId',
      message: 'Parent page ID (optional):',
      default: currentConf.parentPageId || ''
    }
  ]);

  // Update config with new values, preserving API token if not updated
  config.confluence = {
    enabled: true,
    baseUrl: basicAnswers.baseUrl.replace(/\/$/, ''),
    email: basicAnswers.email,
    apiToken: apiToken,
    spaceKey: spaceKey,
    parentPageId: finalAnswers.parentPageId
  };

  writeConfig(config);

  console.log(chalk.green('\n✓ Confluence settings updated successfully!'));
  console.log(`Run ${chalk.cyan('wdidt sync')} to sync your notes to Confluence.\n`);
}
