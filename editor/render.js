/**
 * @fileoverview Terminal rendering for the WYSIWYG editor using terminal-kit
 */

import { spansToText } from './convert.js';

/**
 * Renders the editor to the terminal
 * @param {import('terminal-kit').Terminal} term - The terminal-kit terminal
 * @param {Object} state - The editor state
 */
export function render(term, state) {
  const width = term.width;
  const height = term.height;
  // Reserve: row 1 = status bar, row 2 = toolbar, row height = bottom bar
  const contentStartRow = 3;
  const contentHeight = height - 3;

  term.clear();

  // --- Row 1: Top status bar ---
  term.moveTo(1, 1);
  term.bgGray.white(' wdidt editor');
  const modeLabel = ` [${state.mode.toUpperCase()}] `;
  const saveLabel = state.dirty ? 'Ctrl+S ' : '';
  const rightSide = modeLabel + saveLabel;
  const padding = width - 13 - rightSide.length;
  term.bgGray.white(' '.repeat(Math.max(0, padding)));
  if (state.mode === 'insert') {
    term.bgGreen.black(modeLabel);
  } else if (state.mode === 'visual') {
    term.bgMagenta.white(modeLabel);
  } else if (state.mode === 'command') {
    term.bgYellow.black(modeLabel);
  } else {
    term.bgBlue.white(modeLabel);
  }
  if (saveLabel) term.bgGray.white(saveLabel);

  // --- Row 2: Toolbar ---
  renderToolbar(term, state, width);

  // --- Render document content ---
  const lines = buildDisplayLines(state);
  const totalLines = lines.length;

  // Adjust scroll offset so cursor is visible (only when not in toolbar)
  if (!state.toolbarFocused) {
    const cursorDisplayLine = getCursorDisplayLine(state, lines);
    if (cursorDisplayLine < state.scrollOffset) {
      state.scrollOffset = cursorDisplayLine;
    }
    if (cursorDisplayLine >= state.scrollOffset + contentHeight) {
      state.scrollOffset = cursorDisplayLine - contentHeight + 1;
    }
  }

  // Render visible lines
  for (let row = 0; row < contentHeight; row++) {
    const lineIdx = row + state.scrollOffset;
    term.moveTo(1, row + contentStartRow);

    if (lineIdx < totalLines) {
      const line = lines[lineIdx];
      renderLine(term, line, width, state, lineIdx);
    } else {
      term.gray('~');
      term.eraseLineAfter();
    }
  }

  // --- Bottom bar ---
  term.moveTo(1, height);
  term.bgGray.white(' '.repeat(width));
  term.moveTo(1, height);

  if (state.mode === 'command') {
    term.bgGray.white(':' + state.commandBuffer);
  } else if (state.pendingLeader) {
    term.bgGray.yellow(' Waiting for format key... (1/2/3/u/o/p/Esc)');
  } else if (state.pendingKey === 'd') {
    term.bgGray.yellow(' d: waiting for motion... (d/t/i)');
  } else if (state.pendingKey === 'dt') {
    term.bgGray.yellow(' dt: waiting for target char...');
  } else if (state.pendingKey === 'di') {
    term.bgGray.yellow(" di: waiting for delimiter... (\"/'/`/(/[/{)");
  } else if (state.insertBold) {
    term.bgGray.cyan(' BOLD ON');
  } else if (state.statusMessage) {
    term.bgGray.white(` ${state.statusMessage}`);
  } else if (state.toolbarFocused) {
    term.bgGray.white(' h/l: Select  Enter: Apply  j/DOWN: Back to document');
  } else {
    // Show position info
    const { blockIdx, itemIdx, offset } = state.cursor;
    const block = state.document[blockIdx];
    const blockType = block ? block.type : '?';
    term.bgGray.white(` ${blockType} | Block ${blockIdx + 1}/${state.document.length} | Col ${offset}`);
  }

  // Position the terminal cursor
  if (state.toolbarFocused) {
    positionToolbarCursor(term, state);
  } else {
    positionCursor(term, state, lines, contentHeight, contentStartRow);
  }
}

/**
 * Renders the toolbar row
 * @param {import('terminal-kit').Terminal} term
 * @param {Object} state
 * @param {number} width
 */
function renderToolbar(term, state, width) {
  term.moveTo(1, 2);

  const items = state.toolbarItems;
  // Track positions for cursor placement
  state._toolbarPositions = [];
  let col = 1;

  for (let i = 0; i < items.length; i++) {
    const label = ` ${items[i]} `;
    state._toolbarPositions.push(col);

    if (state.toolbarFocused && i === state.toolbarIndex) {
      // Focused + selected: bright highlight
      term.bgCyan.black.bold(label);
    } else if (isToolbarItemActive(state, i)) {
      // Active (current block matches this type): bright
      term.bgColor(238).brightWhite.bold(label);
    } else {
      // Normal
      term.bgColor(238).gray(label);
    }

    if (i < items.length - 1) {
      term.bgColor(238).gray('\u2502'); // vertical separator
      col += 1;
    }
    col += label.length;
  }

  // Fill rest of toolbar row
  const remaining = width - col + 1;
  if (remaining > 0) {
    term.bgColor(238)(' '.repeat(remaining));
  }
}

/**
 * Checks if a toolbar item corresponds to the current block's state
 * @param {Object} state
 * @param {number} itemIndex
 * @returns {boolean}
 */
function isToolbarItemActive(state, itemIndex) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return false;

  const item = state.toolbarItems[itemIndex];
  switch (item) {
    case 'Bold':
      return state.insertBold;
    case 'H1':
      return block.type === 'heading1';
    case 'H2':
      return block.type === 'heading2';
    case 'H3':
      return block.type === 'heading3';
    case 'Bullet':
      return block.type === 'unordered-list';
    case 'Number':
      return block.type === 'ordered-list';
    case 'Para':
      return block.type === 'paragraph';
    default:
      return false;
  }
}

/**
 * @typedef {Object} DisplayLine
 * @property {import('./convert.js').Span[]} spans - The spans to render
 * @property {string} prefix - The prefix to render (e.g., "# ", "• ", "1. ")
 * @property {string} prefixColor - Color for the prefix
 * @property {boolean} headingBold - Whether the whole line is bold (headings)
 * @property {string} [headingColor] - Color for headings
 * @property {number} blockIdx - Which block this line belongs to
 * @property {number} itemIdx - Which item within a list block (0 for non-lists)
 */

/**
 * Builds an array of display lines from the document
 * @param {Object} state
 * @returns {DisplayLine[]}
 */
function buildDisplayLines(state) {
  const lines = [];

  for (let blockIdx = 0; blockIdx < state.document.length; blockIdx++) {
    const block = state.document[blockIdx];

    if (block.type === 'paragraph') {
      lines.push({
        spans: block.content,
        prefix: '',
        prefixColor: 'white',
        headingBold: false,
        blockIdx,
        itemIdx: 0
      });
    } else if (block.type === 'heading1') {
      lines.push({
        spans: block.content,
        prefix: '# ',
        prefixColor: 'cyan',
        headingBold: true,
        headingColor: 'cyan',
        blockIdx,
        itemIdx: 0
      });
    } else if (block.type === 'heading2') {
      lines.push({
        spans: block.content,
        prefix: '## ',
        prefixColor: 'yellow',
        headingBold: true,
        headingColor: 'yellow',
        blockIdx,
        itemIdx: 0
      });
    } else if (block.type === 'heading3') {
      lines.push({
        spans: block.content,
        prefix: '### ',
        prefixColor: 'white',
        headingBold: true,
        headingColor: 'white',
        blockIdx,
        itemIdx: 0
      });
    } else if (block.type === 'unordered-list') {
      for (let itemIdx = 0; itemIdx < block.items.length; itemIdx++) {
        lines.push({
          spans: block.items[itemIdx],
          prefix: '  \u2022 ',
          prefixColor: 'gray',
          headingBold: false,
          blockIdx,
          itemIdx
        });
      }
    } else if (block.type === 'ordered-list') {
      for (let itemIdx = 0; itemIdx < block.items.length; itemIdx++) {
        lines.push({
          spans: block.items[itemIdx],
          prefix: `  ${itemIdx + 1}. `,
          prefixColor: 'gray',
          headingBold: false,
          blockIdx,
          itemIdx
        });
      }
    }
  }

  return lines;
}

/**
 * Renders a single display line
 * @param {import('terminal-kit').Terminal} term
 * @param {DisplayLine} line
 * @param {number} width
 * @param {Object} state
 * @param {number} lineIdx - The display line index (for visual selection)
 */
function renderLine(term, line, width, state, lineIdx) {
  // Render prefix
  if (line.prefix) {
    if (line.headingBold) {
      term.bold[line.prefixColor](line.prefix);
    } else {
      term[line.prefixColor](line.prefix);
    }
  }

  // Render spans
  const spans = line.spans;
  for (const span of spans) {
    if (!span.text) continue;

    if (line.headingBold && line.headingColor) {
      term.bold[line.headingColor](span.text);
    } else if (span.bold) {
      term.bold.white(span.text);
    } else {
      term.white(span.text);
    }
  }

  term.eraseLineAfter();
}

/**
 * Gets the display line index for the current cursor position
 * @param {Object} state
 * @param {DisplayLine[]} lines
 * @returns {number}
 */
function getCursorDisplayLine(state, lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].blockIdx === state.cursor.blockIdx &&
        lines[i].itemIdx === state.cursor.itemIdx) {
      return i;
    }
  }
  return 0;
}

/**
 * Positions the terminal cursor at the editor cursor location
 * @param {import('terminal-kit').Terminal} term
 * @param {Object} state
 * @param {DisplayLine[]} lines
 * @param {number} contentHeight
 * @param {number} contentStartRow
 */
function positionCursor(term, state, lines, contentHeight, contentStartRow) {
  const displayLine = getCursorDisplayLine(state, lines);
  const row = displayLine - state.scrollOffset + contentStartRow;

  if (row < contentStartRow || row > contentHeight + contentStartRow - 1) return;

  const line = lines[displayLine];
  const prefixLen = line ? line.prefix.length : 0;
  const col = prefixLen + state.cursor.offset + 1;

  term.moveTo(col, row);
  term.hideCursor(false);
}

/**
 * Positions cursor on the toolbar
 * @param {import('terminal-kit').Terminal} term
 * @param {Object} state
 */
function positionToolbarCursor(term, state) {
  const positions = state._toolbarPositions || [];
  const col = positions[state.toolbarIndex] || 1;
  term.moveTo(col + 1, 2); // +1 to be inside the label padding
  term.hideCursor(false);
}

export { buildDisplayLines, getCursorDisplayLine };
