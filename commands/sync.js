import fs from 'fs';
import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { getAllMonthlyNotesFiles } from '../utils/fileHandler.js';
import { ConfluenceClient } from '../utils/confluenceClient.js';
import path from 'path';

/**
 * Syncs all monthly notes files to Confluence
 * @returns {Promise<void>}
 */
export async function syncToConfluence() {
  console.log(chalk.blue('🔄 Syncing notes to Confluence...\n'));

  const config = await getConfig();

  // Check if Confluence is configured
  if (!config || !config.confluence || !config.confluence.enabled) {
    console.log(chalk.yellow('⚠ Confluence sync is not configured.'));
    console.log(`Run ${chalk.cyan('wdidt confluence')} to set it up.\n`);
    return;
  }

  const { baseUrl, email, apiToken, spaceKey, parentPageId } = config.confluence;

  // Create Confluence client
  const client = new ConfluenceClient(baseUrl, email, apiToken);

  try {
    // Test connection first
    console.log(chalk.gray('Testing connection to Confluence...\n'));
    const connected = await client.testConnection();

    if (!connected) {
      console.log(chalk.red('✗ Could not connect to Confluence. Check your credentials.\n'));
      return;
    }

    console.log(chalk.green('✓ Connected to Confluence successfully\n'));

    // Find or create the "Daily Notes" parent page
    console.log(chalk.gray('Setting up Daily Notes folder...\n'));
    const dailyNotesParentId = await client.findOrCreateParentPage(
      spaceKey,
      'Daily Notes',
      parentPageId || undefined
    );

    // Get all monthly notes files
    const files = await getAllMonthlyNotesFiles();

    if (files.length === 0) {
      console.log(chalk.yellow('No notes files found to sync.\n'));
      return;
    }

    console.log(chalk.gray(`Found ${files.length} notes file(s) to sync...\n`));

    let created = 0;
    let updated = 0;
    let errors = 0;

    // Sync each file
    for (const filePath of files) {
      const fileName = path.basename(filePath, '.html');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Extract the month/year from content (first line should be <h1>Month Year</h1>)
      const firstLine = content.split('\n')[0];
      const titleMatch = firstLine.match(/^<h1>(.+)<\/h1>$/);
      const pageTitle = titleMatch ? titleMatch[1] : fileName;

      try {
        // Files are already in Confluence XHTML format, use content directly
        const confluenceContent = content;

        // Create or update page under "Daily Notes" parent
        const result = await client.createOrUpdatePage(
          spaceKey,
          pageTitle,
          confluenceContent,
          dailyNotesParentId
        );

        if (result.action === 'created') {
          console.log(chalk.green(`✓ Created: ${pageTitle}`));
          created++;
        } else {
          console.log(chalk.blue(`✓ Updated: ${pageTitle}`));
          updated++;
        }
      } catch (error) {
        console.log(chalk.red(`✗ Failed: ${pageTitle} - ${error.message}`));
        errors++;
      }
    }

    // Summary
    console.log(chalk.gray('\n───────────────────'));
    console.log(chalk.green(`✓ Created: ${created}`));
    console.log(chalk.blue(`✓ Updated: ${updated}`));
    if (errors > 0) {
      console.log(chalk.red(`✗ Errors: ${errors}`));
    }
    console.log(chalk.gray('───────────────────\n'));

    if (errors === 0) {
      console.log(chalk.green('🎉 All notes synced successfully!\n'));
    } else {
      console.log(chalk.yellow('⚠ Some notes failed to sync. Check the errors above.\n'));
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ Sync failed: ${error.message}\n`));
    if (error.message.includes('401') || error.message.includes('403')) {
      console.log(chalk.yellow('Check your Confluence credentials with: wdidt confluence\n'));
    }
  }
}
