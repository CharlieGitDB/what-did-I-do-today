import fs from 'fs';
import path from 'path';
import { getAllMonthlyNotesFiles } from './utils/fileHandler.js';

console.log('Migrating task format in all notes files...\n');

const files = await getAllMonthlyNotesFiles();

for (const file of files) {
  console.log(`Processing: ${path.basename(file)}`);

  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;

  // Replace old ac:task format with new status attribute format (no Unicode)
  // Pattern: <li id="todo-X"><ac:task><ac:task-status>complete/incomplete</ac:task-status><ac:task-body>TEXT</ac:task-body></ac:task></li>
  content = content.replace(
    /<li id="todo-(\d+)"><ac:task><ac:task-status>(complete|incomplete)<\/ac:task-status><ac:task-body>(.+?)<\/ac:task-body><\/ac:task><\/li>/g,
    (match, id, status, body) => {
      changed = true;
      const taskStatus = status === 'complete' ? 'checked' : 'unchecked';
      return `<li data-inline-task-id="${id}" data-inline-task-status="${taskStatus}"><span class="placeholder-inline-tasks">${body}</span></li>`;
    }
  );

  // Replace newer ac:task format with ac:task-id
  content = content.replace(
    /<ac:task><ac:task-id>(\d+)<\/ac:task-id><ac:task-status>(COMPLETE|INCOMPLETE)<\/ac:task-status><ac:task-body><span[^>]*>(.+?)<\/span><\/ac:task-body><\/ac:task>/g,
    (match, id, status, body) => {
      changed = true;
      const taskStatus = status === 'COMPLETE' ? 'checked' : 'unchecked';
      return `<li data-inline-task-id="${id}" data-inline-task-status="${taskStatus}"><span class="placeholder-inline-tasks">${body}</span></li>`;
    }
  );

  // Remove Unicode checkboxes from existing migrated tasks
  content = content.replace(
    /<li data-inline-task-id="(\d+)"><span class="placeholder-inline-tasks"[^>]*>(✓|☐) (.+?)<\/span><\/li>/g,
    (match, id, checkbox, body) => {
      changed = true;
      const taskStatus = checkbox === '✓' ? 'checked' : 'unchecked';
      return `<li data-inline-task-id="${id}" data-inline-task-status="${taskStatus}"><span class="placeholder-inline-tasks">${body}</span></li>`;
    }
  );

  // Replace <ul> with <ul class="inline-task-list"> after <h3>Todos</h3>
  content = content.replace(
    /(<h3>Todos<\/h3>\s*\n)(<ul>)/g,
    '$1<ul class="inline-task-list">'
  );

  // Replace ac:task-list with ul
  content = content.replace(/<ac:task-list>/g, '<ul class="inline-task-list">');
  content = content.replace(/<\/ac:task-list>/g, '</ul>');

  // Replace old context div format with info panels
  content = content.replace(
    /<div id="context-([^"]+)" style="[^"]*">\s*<p><strong>\[([^\]]+)\]<\/strong><\/p>\s*<p>(.+?)<\/p>\s*<\/div>/g,
    (match, contextId, contextIdLabel, contextText) => {
      changed = true;
      return `<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">[${contextId}]</ac:parameter><ac:rich-text-body><p>${contextText}</p></ac:rich-text-body></ac:structured-macro>`;
    }
  );

  // Clean up nested divs (some contexts have multiple nested divs)
  let prevContent;
  do {
    prevContent = content;
    content = content.replace(
      /<div id="context-([^"]+)" style="[^"]*">\s*(<div id="context-\1"[^>]*>)/g,
      '$2'
    );
    content = content.replace(/<\/div>\s*<\/div>\s*<\/div>/g, '</div>');
  } while (content !== prevContent);

  // Try to clean remaining context divs
  content = content.replace(
    /<div id="context-([^"]+)"[^>]*>\s*<p><strong>\[([^\]]+)\]<\/strong><\/p>\s*<p>(.+?)<\/p>\s*<\/div>/g,
    (match, contextId, contextIdLabel, contextText) => {
      changed = true;
      return `<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">[${contextId}]</ac:parameter><ac:rich-text-body><p>${contextText}</p></ac:rich-text-body></ac:structured-macro>`;
    }
  );

  // Clean up old format context (without divs)
  content = content.replace(
    /(<h3>Context<\/h3>\s*\n\s*\n)(<p><strong>\[([^\]]+)\]<\/strong><\/p>\s*<p>(.+?)<\/p>)/g,
    (match, header, oldFormat, contextId, contextText) => {
      changed = true;
      return `${header}<ac:structured-macro ac:name="info" ac:schema-version="1"><ac:parameter ac:name="title">[${contextId}]</ac:parameter><ac:rich-text-body><p>${contextText}</p></ac:rich-text-body></ac:structured-macro>`;
    }
  );

  if (changed) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`  ✓ Updated\n`);
  } else {
    console.log(`  - No changes needed\n`);
  }
}

console.log('Migration complete!');
