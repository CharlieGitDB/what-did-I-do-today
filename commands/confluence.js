import chalk from 'chalk';
import { promptConfluenceSetup, readConfig, writeConfig } from '../utils/config.js';

/**
 * Configures or reconfigures Confluence sync settings
 * @returns {Promise<void>}
 */
export async function configureConfluence() {
  console.log(chalk.blue('Confluence Configuration\n'));

  const config = readConfig();

  if (config && config.confluence && config.confluence.enabled) {
    console.log(chalk.yellow('⚠ You already have Confluence configured.'));
    console.log(`Current settings:`);
    console.log(`  URL: ${config.confluence.baseUrl}`);
    console.log(`  Email: ${config.confluence.email}`);
    console.log(`  Space: ${config.confluence.spaceKey}\n`);
  }

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
