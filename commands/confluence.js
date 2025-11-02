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

  const answers = await inquirer.prompt([
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
    },
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
    },
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
    baseUrl: answers.baseUrl.replace(/\/$/, ''),
    email: answers.email,
    apiToken: answers.updateApiToken ? answers.apiToken : currentConf.apiToken,
    spaceKey: answers.spaceKey,
    parentPageId: answers.parentPageId
  };

  writeConfig(config);

  console.log(chalk.green('\n✓ Confluence settings updated successfully!'));
  console.log(`Run ${chalk.cyan('wdidt sync')} to sync your notes to Confluence.\n`);
}
