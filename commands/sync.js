import fs from 'fs';
import chalk from 'chalk';
import { getConfig } from '../utils/config.js';
import { getAllMonthlyNotesFiles, getNotesFilePath } from '../utils/fileHandler.js';
import { ConfluenceClient } from '../utils/confluenceClient.js';
import path from 'path';

/**
 * Converts filename format (YYYY-MM-notes) to page title format (Month YYYY)
 * @param {string} fileName - The filename without extension (e.g., "2025-11-notes")
 * @returns {string} The formatted title (e.g., "November 2025")
 */
function generatePageTitle(fileName) {
  // Try to extract YYYY-MM from filename
  const match = fileName.match(/^(\d{4})-(\d{2})-notes$/);
  if (!match) {
    return fileName; // Fallback to filename if format doesn't match
  }

  const year = match[1];
  const monthNum = parseInt(match[2], 10);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthName = monthNames[monthNum - 1] || 'Unknown';
  return `${monthName} ${year}`;
}

/**
 * Syncs only the current month's notes file to Confluence
 * @param {ConfluenceClient} client - The Confluence client
 * @param {string} spaceKey - The Confluence space key
 * @param {string} parentPageId - The parent page ID (optional)
 * @param {boolean} verbose - Whether to show console output
 * @returns {Promise<void>}
 */
async function syncCurrentMonth(client, spaceKey, parentPageId, verbose) {
  // Find or create the "Daily Notes" parent page
  if (verbose) console.log(chalk.gray('Setting up Daily Notes folder...\n'));
  const dailyNotesParentId = await client.findOrCreateParentPage(
    spaceKey,
    'Daily Notes',
    parentPageId || undefined
  );

  // Get current month's file
  const filePath = await getNotesFilePath();
  if (!fs.existsSync(filePath)) {
    if (verbose) console.log(chalk.yellow('No notes file found for the current month.\n'));
    return;
  }

  const fileName = path.basename(filePath, '.html');
  const content = fs.readFileSync(filePath, 'utf-8');
  const pageTitle = generatePageTitle(fileName);

  const result = await client.createOrUpdatePage(
    spaceKey,
    pageTitle,
    content,
    dailyNotesParentId
  );

  if (verbose) {
    if (result.action === 'created') {
      console.log(chalk.green(`✓ Created: ${pageTitle}`));
    } else {
      console.log(chalk.blue(`✓ Updated: ${pageTitle}`));
    }
  }

  // Update parent page links with the synced page
  try {
    if (verbose) console.log(chalk.gray('\nUpdating Daily Notes page with links...\n'));
    await client.updateParentPageLinks(spaceKey, 'Daily Notes', [{
      title: pageTitle,
      id: result.page.id
    }]);
  } catch (error) {
    if (verbose) console.log(chalk.yellow(`⚠ Could not update parent page links: ${error.message}\n`));
  }

  if (verbose) console.log(chalk.green('\n🎉 Current month synced successfully!\n'));
}

/**
 * Silently syncs current month's notes to Confluence if enabled
 * Used for automatic background syncing after operations
 * @returns {Promise<void>}
 */
export async function autoSyncToConfluence() {
  try {
    const config = await getConfig();

    // Check if Confluence is configured and enabled
    if (!config || !config.confluence || !config.confluence.enabled) {
      return; // Silently skip if not configured
    }

    const { baseUrl, email, apiToken, spaceKey, parentPageId } = config.confluence;

    // Create Confluence client
    const client = new ConfluenceClient(baseUrl, email, apiToken);

    // Test connection first (silently)
    const connected = await client.testConnection();
    if (!connected) {
      return; // Silently fail
    }

    await syncCurrentMonth(client, spaceKey, parentPageId, false);
  } catch (error) {
    // Silently ignore all errors in auto-sync
  }
}

/**
 * Performs sync based on user's silentSync configuration setting
 * If silentSync is true, syncs silently in the background
 * If silentSync is false or not set, shows verbose sync output
 * @returns {Promise<void>}
 */
export async function performAutoSync() {
  try {
    const config = await getConfig();

    // Check if Confluence is configured and enabled
    if (!config || !config.confluence || !config.confluence.enabled) {
      return; // Skip if not configured
    }

    const { baseUrl, email, apiToken, spaceKey, parentPageId } = config.confluence;
    const client = new ConfluenceClient(baseUrl, email, apiToken);

    // Check silentSync setting - default to false (verbose) if not set
    const silentSync = config.confluence.silentSync === true;

    if (silentSync) {
      await autoSyncToConfluence();
    } else {
      // Verbose auto-sync: only sync current month
      console.log(chalk.blue('🔄 Syncing current month to Confluence...\n'));

      const connected = await client.testConnection();
      if (!connected) {
        console.log(chalk.red('✗ Could not connect to Confluence. Check your credentials.\n'));
        return;
      }
      console.log(chalk.green('✓ Connected to Confluence successfully\n'));

      await syncCurrentMonth(client, spaceKey, parentPageId, true);
    }
  } catch (error) {
    // Silently ignore errors
  }
}

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
    const syncedPages = [];

    // Sync each file
    for (const filePath of files) {
      const fileName = path.basename(filePath, '.html');
      const content = fs.readFileSync(filePath, 'utf-8');

      // Generate page title from filename (e.g., "2025-11-notes" -> "November 2025")
      const pageTitle = generatePageTitle(fileName);

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

        // Track synced pages for parent page update
        syncedPages.push({
          title: pageTitle,
          id: result.page.id
        });

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

    // Update parent page with links to all child pages
    if (syncedPages.length > 0) {
      try {
        console.log(chalk.gray('\nUpdating Daily Notes page with links...\n'));
        await client.updateParentPageLinks(spaceKey, 'Daily Notes', syncedPages);
      } catch (error) {
        console.log(chalk.yellow(`⚠ Could not update parent page links: ${error.message}\n`));
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
