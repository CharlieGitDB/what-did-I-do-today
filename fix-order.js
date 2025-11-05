#!/usr/bin/env node

/**
 * One-time script to reverse the order of items in each section
 * so that newest items appear at the top
 */

import fs from 'fs';
import path from 'path';
import { getConfig } from './utils/config.js';
import { getAllMonthlyNotesFiles } from './utils/fileHandler.js';

/**
 * Reverses the order of todos in a task list
 */
function reverseTodos(lines, startIdx, endIdx) {
  const todos = [];

  for (let i = startIdx + 1; i < endIdx; i++) {
    if (lines[i].includes('<ac:task>')) {
      todos.push(lines[i]);
    }
  }

  // Remove todos from lines
  for (let i = endIdx - 1; i > startIdx; i--) {
    if (lines[i].includes('<ac:task>')) {
      lines.splice(i, 1);
    }
  }

  // Re-insert in reverse order
  todos.reverse();
  for (let i = 0; i < todos.length; i++) {
    lines.splice(startIdx + 1 + i, 0, todos[i]);
  }
}

/**
 * Reverses the order of items in a section (Notes, References, Context)
 */
function reverseSection(lines, sectionName, startIdx, nextSectionIdx) {
  const items = [];
  let i = startIdx + 1;

  while (i < nextSectionIdx) {
    const line = lines[i];

    // Check if this is a timestamped item
    if (line.includes('style="color: #888')) {
      // This is a timestamp, collect it with its content
      const item = [line];
      i++;

      // Collect associated content lines
      while (i < nextSectionIdx && !lines[i].includes('style="color: #888') && !lines[i].startsWith('<h3>')) {
        if (lines[i].trim()) {
          item.push(lines[i]);
        }
        i++;
      }

      items.push(item);
    } else if (line.includes('<ac:structured-macro')) {
      // Context item without timestamp
      items.push([line]);
      i++;
    } else if (line.startsWith('<p>') && !line.includes('style=')) {
      // Note or reference without timestamp
      items.push([line]);
      i++;
    } else {
      i++;
    }
  }

  if (items.length === 0) return;

  // Remove all items from the section
  for (let i = nextSectionIdx - 1; i > startIdx; i--) {
    if (lines[i].trim()) {
      lines.splice(i, 1);
      nextSectionIdx--;
    }
  }

  // Re-insert in reverse order
  items.reverse();
  let insertIdx = startIdx + 1;

  // Skip any empty lines right after section header
  while (insertIdx < lines.length && !lines[insertIdx].trim()) {
    insertIdx++;
  }

  for (const item of items) {
    for (const itemLine of item) {
      lines.splice(insertIdx, 0, itemLine);
      insertIdx++;
    }

    // Add spacing after item
    if (item !== items[items.length - 1]) {
      lines.splice(insertIdx, 0, '');
      insertIdx++;
    }
  }
}

/**
 * Fixes a single notes file
 */
async function fixFile(filePath) {
  console.log(`Processing: ${filePath}`);

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Find section headers
    if (line === '<h3>Todos</h3>') {
      // Find task-list bounds
      let taskListStart = -1;
      let taskListEnd = -1;

      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j] === '<ac:task-list>') {
          taskListStart = j;
        } else if (lines[j] === '</ac:task-list>') {
          taskListEnd = j;
          break;
        }
      }

      if (taskListStart !== -1 && taskListEnd !== -1) {
        reverseTodos(lines, taskListStart, taskListEnd);
      }
    } else if (line === '<h3>Context</h3>' || line === '<h3>References</h3>' || line === '<h3>Notes</h3>') {
      // Find next section or HR
      let nextSectionIdx = lines.length;

      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].startsWith('<h3>') || lines[j].startsWith('<h2>') || lines[j].startsWith('<hr')) {
          nextSectionIdx = j;
          break;
        }
      }

      const sectionName = line.match(/<h3>(.+?)<\/h3>/)[1];
      reverseSection(lines, sectionName, i, nextSectionIdx);
    }

    i++;
  }

  // Write back
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`✓ Fixed: ${filePath}`);
}

/**
 * Main function
 */
async function main() {
  try {
    const files = await getAllMonthlyNotesFiles();

    if (files.length === 0) {
      console.log('No notes files found.');
      return;
    }

    console.log(`Found ${files.length} notes file(s) to process.\n`);

    for (const file of files) {
      await fixFile(file);
    }

    console.log('\n✓ All files have been fixed!');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
