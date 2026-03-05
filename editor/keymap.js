/**
 * @fileoverview Vim keybinding handlers for the WYSIWYG editor
 */

import { spansToText } from './convert.js';

const BRACKET_PAIRS = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{' };
const QUOTE_CHARS = new Set(['"', "'", '`']);

/**
 * Gets the text content of the current block/item at cursor
 * @param {Object} state
 * @returns {string}
 */
function getCurrentText(state) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return '';
  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    return spansToText(block.items[state.cursor.itemIdx] || []);
  }
  return spansToText(block.content);
}

/**
 * Gets the spans array for the current cursor position
 * @param {Object} state
 * @returns {import('./convert.js').Span[]}
 */
function getCurrentSpans(state) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return [];
  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    return block.items[state.cursor.itemIdx] || [];
  }
  return block.content;
}

/**
 * Sets the spans for the current cursor position
 * @param {Object} state
 * @param {import('./convert.js').Span[]} spans
 */
function setCurrentSpans(state, spans) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return;
  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    block.items[state.cursor.itemIdx] = spans;
  } else {
    block.content = spans;
  }
}

/**
 * Clamps cursor offset to valid range
 * @param {Object} state
 * @param {boolean} [allowEnd] - Whether to allow cursor at text.length (insert mode)
 */
function clampOffset(state, allowEnd = false) {
  const text = getCurrentText(state);
  const max = allowEnd ? text.length : Math.max(0, text.length - 1);
  state.cursor.offset = Math.max(0, Math.min(state.cursor.offset, max));
}

/**
 * Gets total number of "lines" (blocks + list items)
 * @param {Object} state
 * @returns {number}
 */
function getTotalLines(state) {
  let count = 0;
  for (const block of state.document) {
    if (block.type === 'unordered-list' || block.type === 'ordered-list') {
      count += block.items.length;
    } else {
      count++;
    }
  }
  return count;
}

/**
 * Moves cursor down one line
 * @param {Object} state
 */
function moveCursorDown(state) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return;

  if ((block.type === 'unordered-list' || block.type === 'ordered-list') &&
      state.cursor.itemIdx < block.items.length - 1) {
    state.cursor.itemIdx++;
  } else if (state.cursor.blockIdx < state.document.length - 1) {
    state.cursor.blockIdx++;
    state.cursor.itemIdx = 0;
  }
  clampOffset(state, state.mode === 'insert');
}

/**
 * Moves cursor up one line
 * @param {Object} state
 */
function moveCursorUp(state) {
  const block = state.document[state.cursor.blockIdx];
  if (!block) return;

  if ((block.type === 'unordered-list' || block.type === 'ordered-list') &&
      state.cursor.itemIdx > 0) {
    state.cursor.itemIdx--;
  } else if (state.cursor.blockIdx > 0) {
    state.cursor.blockIdx--;
    const prevBlock = state.document[state.cursor.blockIdx];
    if (prevBlock.type === 'unordered-list' || prevBlock.type === 'ordered-list') {
      state.cursor.itemIdx = prevBlock.items.length - 1;
    } else {
      state.cursor.itemIdx = 0;
    }
  }
  clampOffset(state, state.mode === 'insert');
}

/**
 * Moves cursor left
 * @param {Object} state
 */
function moveCursorLeft(state) {
  if (state.cursor.offset > 0) {
    state.cursor.offset--;
  }
}

/**
 * Moves cursor right
 * @param {Object} state
 */
function moveCursorRight(state) {
  const text = getCurrentText(state);
  const max = state.mode === 'insert' ? text.length : Math.max(0, text.length - 1);
  if (state.cursor.offset < max) {
    state.cursor.offset++;
  }
}

/**
 * Moves cursor to next word start
 * @param {Object} state
 */
function moveWordForward(state) {
  const text = getCurrentText(state);
  let pos = state.cursor.offset;
  // Skip current word chars
  while (pos < text.length && text[pos] !== ' ') pos++;
  // Skip spaces
  while (pos < text.length && text[pos] === ' ') pos++;
  state.cursor.offset = pos;
  clampOffset(state, state.mode === 'insert');
}

/**
 * Moves cursor to previous word start
 * @param {Object} state
 */
function moveWordBackward(state) {
  const text = getCurrentText(state);
  let pos = state.cursor.offset;
  // Skip spaces backwards
  while (pos > 0 && text[pos - 1] === ' ') pos--;
  // Skip word chars backwards
  while (pos > 0 && text[pos - 1] !== ' ') pos--;
  state.cursor.offset = pos;
}

/**
 * Moves cursor to end of word
 * @param {Object} state
 */
function moveWordEnd(state) {
  const text = getCurrentText(state);
  let pos = state.cursor.offset;
  // Move past current char
  if (pos < text.length) pos++;
  // Skip spaces
  while (pos < text.length && text[pos] === ' ') pos++;
  // Skip word chars
  while (pos < text.length && text[pos] !== ' ') pos++;
  state.cursor.offset = Math.max(0, pos - 1);
  clampOffset(state, state.mode === 'insert');
}

/**
 * Pushes current state onto undo stack
 * @param {Object} state
 */
function pushUndo(state) {
  state.undoStack.push({
    document: JSON.parse(JSON.stringify(state.document)),
    cursor: { ...state.cursor }
  });
  // Keep undo stack reasonable
  if (state.undoStack.length > 100) {
    state.undoStack.shift();
  }
}

/**
 * Pops undo stack and restores state
 * @param {Object} state
 */
function undo(state) {
  if (state.undoStack.length === 0) {
    state.statusMessage = 'Nothing to undo';
    return;
  }
  const prev = state.undoStack.pop();
  state.document = prev.document;
  state.cursor = prev.cursor;
  state.dirty = true;
  state.statusMessage = 'Undone';
}

/**
 * Inserts a character at the cursor position
 * @param {Object} state
 * @param {string} char
 */
function insertChar(state, char) {
  pushUndo(state);
  const spans = getCurrentSpans(state);
  const offset = state.cursor.offset;
  const bold = state.insertBold;

  // Find which span and position within that span the cursor is at
  let pos = 0;
  let spanIdx = 0;
  let spanOffset = 0;

  for (let i = 0; i < spans.length; i++) {
    if (pos + spans[i].text.length >= offset) {
      spanIdx = i;
      spanOffset = offset - pos;
      break;
    }
    pos += spans[i].text.length;
    if (i === spans.length - 1) {
      spanIdx = i;
      spanOffset = spans[i].text.length;
    }
  }

  const currentSpan = spans[spanIdx];

  if (currentSpan.bold === bold) {
    // Same bold state — insert into current span
    currentSpan.text = currentSpan.text.slice(0, spanOffset) + char + currentSpan.text.slice(spanOffset);
  } else {
    // Different bold state — split the span
    const before = currentSpan.text.slice(0, spanOffset);
    const after = currentSpan.text.slice(spanOffset);
    const newSpans = [];

    // Add spans before current
    for (let i = 0; i < spanIdx; i++) newSpans.push(spans[i]);

    // Split current span
    if (before) newSpans.push({ text: before, bold: currentSpan.bold });
    newSpans.push({ text: char, bold });
    if (after) newSpans.push({ text: after, bold: currentSpan.bold });

    // Add spans after current
    for (let i = spanIdx + 1; i < spans.length; i++) newSpans.push(spans[i]);

    setCurrentSpans(state, mergeSpans(newSpans));
  }

  state.cursor.offset = offset + 1;
  state.dirty = true;
}

/**
 * Merges adjacent spans with the same bold attribute
 * @param {import('./convert.js').Span[]} spans
 * @returns {import('./convert.js').Span[]}
 */
function mergeSpans(spans) {
  if (spans.length <= 1) return spans;
  const merged = [spans[0]];
  for (let i = 1; i < spans.length; i++) {
    const last = merged[merged.length - 1];
    if (last.bold === spans[i].bold) {
      last.text += spans[i].text;
    } else {
      merged.push(spans[i]);
    }
  }
  return merged.filter(s => s.text.length > 0 || merged.length === 1);
}

/**
 * Deletes the character behind the cursor (backspace)
 * @param {Object} state
 */
function deleteCharBehind(state) {
  const offset = state.cursor.offset;

  if (offset === 0) {
    // At beginning of block — merge with previous block/item
    const block = state.document[state.cursor.blockIdx];

    if (block.type === 'unordered-list' || block.type === 'ordered-list') {
      if (state.cursor.itemIdx > 0) {
        // Merge with previous item in same list
        pushUndo(state);
        const prevItem = block.items[state.cursor.itemIdx - 1];
        const curItem = block.items[state.cursor.itemIdx];
        const prevLen = spansToText(prevItem).length;
        block.items[state.cursor.itemIdx - 1] = mergeSpans([...prevItem, ...curItem]);
        block.items.splice(state.cursor.itemIdx, 1);
        state.cursor.itemIdx--;
        state.cursor.offset = prevLen;
        state.dirty = true;
        // If list is now empty, remove it
        if (block.items.length === 0) {
          state.document.splice(state.cursor.blockIdx, 1);
          if (state.document.length === 0) {
            state.document.push({ type: 'paragraph', content: [{ text: '', bold: false }] });
          }
          state.cursor.blockIdx = Math.max(0, state.cursor.blockIdx - 1);
          state.cursor.itemIdx = 0;
          state.cursor.offset = 0;
        }
      } else if (state.cursor.blockIdx > 0) {
        // First item in list — merge with previous block
        pushUndo(state);
        const curItem = block.items[state.cursor.itemIdx];
        const prevBlock = state.document[state.cursor.blockIdx - 1];
        let prevSpans;
        if (prevBlock.type === 'unordered-list' || prevBlock.type === 'ordered-list') {
          prevSpans = prevBlock.items[prevBlock.items.length - 1];
        } else {
          prevSpans = prevBlock.content;
        }
        const prevLen = spansToText(prevSpans).length;

        // Remove the item from the list
        block.items.splice(0, 1);

        // Merge text into previous block
        if (prevBlock.type === 'unordered-list' || prevBlock.type === 'ordered-list') {
          prevBlock.items[prevBlock.items.length - 1] = mergeSpans([...prevSpans, ...curItem]);
          state.cursor.itemIdx = prevBlock.items.length - 1;
        } else {
          prevBlock.content = mergeSpans([...prevSpans, ...curItem]);
          state.cursor.itemIdx = 0;
        }

        // Remove empty list
        if (block.items.length === 0) {
          state.document.splice(state.cursor.blockIdx, 1);
        }

        state.cursor.blockIdx--;
        state.cursor.offset = prevLen;
        state.dirty = true;
      }
    } else if (state.cursor.blockIdx > 0) {
      // Merge with previous block
      pushUndo(state);
      const prevBlock = state.document[state.cursor.blockIdx - 1];
      let prevSpans;
      if (prevBlock.type === 'unordered-list' || prevBlock.type === 'ordered-list') {
        prevSpans = prevBlock.items[prevBlock.items.length - 1];
      } else {
        prevSpans = prevBlock.content;
      }
      const prevLen = spansToText(prevSpans).length;

      if (prevBlock.type === 'unordered-list' || prevBlock.type === 'ordered-list') {
        prevBlock.items[prevBlock.items.length - 1] = mergeSpans([...prevSpans, ...block.content]);
        state.cursor.itemIdx = prevBlock.items.length - 1;
      } else {
        prevBlock.content = mergeSpans([...prevSpans, ...block.content]);
        state.cursor.itemIdx = 0;
      }

      state.document.splice(state.cursor.blockIdx, 1);
      state.cursor.blockIdx--;
      state.cursor.offset = prevLen;
      state.dirty = true;
    }
    return;
  }

  pushUndo(state);
  const spans = getCurrentSpans(state);

  // Find which span contains the char to delete
  let pos = 0;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (pos + span.text.length >= offset) {
      const charIdx = offset - pos - 1;
      span.text = span.text.slice(0, charIdx) + span.text.slice(charIdx + 1);
      break;
    }
    pos += span.text.length;
  }

  // Clean up empty spans (keep at least one)
  const cleaned = mergeSpans(spans.filter(s => s.text.length > 0));
  setCurrentSpans(state, cleaned.length > 0 ? cleaned : [{ text: '', bold: false }]);

  state.cursor.offset = offset - 1;
  state.dirty = true;
}

/**
 * Deletes the character at the cursor (x in normal mode)
 * @param {Object} state
 */
function deleteCharAt(state) {
  const text = getCurrentText(state);
  if (text.length === 0) return;

  pushUndo(state);
  const spans = getCurrentSpans(state);
  const offset = state.cursor.offset;

  let pos = 0;
  for (let i = 0; i < spans.length; i++) {
    const span = spans[i];
    if (pos + span.text.length > offset) {
      const charIdx = offset - pos;
      span.text = span.text.slice(0, charIdx) + span.text.slice(charIdx + 1);
      break;
    }
    pos += span.text.length;
  }

  const cleaned = mergeSpans(spans.filter(s => s.text.length > 0));
  setCurrentSpans(state, cleaned.length > 0 ? cleaned : [{ text: '', bold: false }]);
  clampOffset(state);
  state.dirty = true;
}

/**
 * Deletes the current block
 * @param {Object} state
 */
function deleteBlock(state) {
  pushUndo(state);
  const block = state.document[state.cursor.blockIdx];

  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    // Delete just the current item
    block.items.splice(state.cursor.itemIdx, 1);
    if (block.items.length === 0) {
      state.document.splice(state.cursor.blockIdx, 1);
    } else if (state.cursor.itemIdx >= block.items.length) {
      state.cursor.itemIdx = block.items.length - 1;
    }
  } else {
    state.document.splice(state.cursor.blockIdx, 1);
  }

  if (state.document.length === 0) {
    state.document.push({ type: 'paragraph', content: [{ text: '', bold: false }] });
    state.cursor.blockIdx = 0;
  } else if (state.cursor.blockIdx >= state.document.length) {
    state.cursor.blockIdx = state.document.length - 1;
    const b = state.document[state.cursor.blockIdx];
    if (b.type === 'unordered-list' || b.type === 'ordered-list') {
      state.cursor.itemIdx = b.items.length - 1;
    } else {
      state.cursor.itemIdx = 0;
    }
  }

  state.cursor.offset = 0;
  state.dirty = true;
}

/**
 * Deletes a range of text from startOffset to endOffset (exclusive) in the current spans
 * @param {Object} state
 * @param {number} startOffset
 * @param {number} endOffset
 */
function deleteRange(state, startOffset, endOffset) {
  const spans = getCurrentSpans(state);
  const { beforeSpans } = splitSpansAtOffset(spans, startOffset);
  const { afterSpans } = splitSpansAtOffset(spans, endOffset);

  let result = mergeSpans([...beforeSpans, ...afterSpans]);
  if (result.length === 0 || (result.length === 1 && result[0].text === '' && beforeSpans[0].text === '' && afterSpans[0].text === '')) {
    result = [{ text: '', bold: false }];
  }
  // Filter empty spans but keep at least one
  const filtered = result.filter(s => s.text.length > 0);
  setCurrentSpans(state, filtered.length > 0 ? filtered : [{ text: '', bold: false }]);
}

/**
 * Deletes from cursor to the next occurrence of targetChar (dt<char>)
 * @param {Object} state
 * @param {string} targetChar
 */
function deleteTo(state, targetChar) {
  const text = getCurrentText(state);
  const foundIdx = text.indexOf(targetChar, state.cursor.offset + 1);
  if (foundIdx === -1) {
    state.statusMessage = `Character '${targetChar}' not found`;
    return;
  }
  pushUndo(state);
  deleteRange(state, state.cursor.offset, foundIdx);
  state.dirty = true;
}

/**
 * Deletes inside a delimiter pair (di<char>)
 * @param {Object} state
 * @param {string} inputChar
 */
function deleteInside(state, inputChar) {
  const text = getCurrentText(state);
  const offset = state.cursor.offset;
  let openPos = -1;
  let closePos = -1;

  if (QUOTE_CHARS.has(inputChar)) {
    // Find quote pair around cursor
    let leftQuote = -1;
    let rightQuote = -1;

    // Search left for quote
    for (let i = offset - 1; i >= 0; i--) {
      if (text[i] === inputChar) { leftQuote = i; break; }
    }
    // Search right for quote
    for (let i = offset + 1; i < text.length; i++) {
      if (text[i] === inputChar) { rightQuote = i; break; }
    }

    if (text[offset] === inputChar) {
      // Cursor is on a quote — find partner on other side
      if (rightQuote !== -1) {
        openPos = offset;
        closePos = rightQuote;
      } else if (leftQuote !== -1) {
        openPos = leftQuote;
        closePos = offset;
      }
    } else if (leftQuote !== -1 && rightQuote !== -1) {
      openPos = leftQuote;
      closePos = rightQuote;
    }
  } else if (inputChar in BRACKET_PAIRS) {
    // Determine the open/close bracket characters
    let openChar, closeChar;
    if ('([{'.includes(inputChar)) {
      openChar = inputChar;
      closeChar = BRACKET_PAIRS[inputChar];
    } else {
      closeChar = inputChar;
      openChar = BRACKET_PAIRS[inputChar];
    }

    // Search backward for unmatched open bracket
    let searchStart = offset;
    if (text[offset] === closeChar) searchStart = offset - 1;

    let depth = 0;
    for (let i = searchStart; i >= 0; i--) {
      if (text[i] === closeChar) depth++;
      if (text[i] === openChar) {
        if (depth === 0) { openPos = i; break; }
        depth--;
      }
    }

    // Search forward for matching close bracket
    if (openPos !== -1) {
      depth = 0;
      for (let i = openPos + 1; i < text.length; i++) {
        if (text[i] === openChar) depth++;
        if (text[i] === closeChar) {
          if (depth === 0) { closePos = i; break; }
          depth--;
        }
      }
    }
  } else {
    state.statusMessage = `Not a delimiter: '${inputChar}'`;
    return;
  }

  if (openPos === -1 || closePos === -1) {
    state.statusMessage = `No surrounding '${inputChar}' found`;
    return;
  }

  // Check if already empty inside
  if (closePos - openPos <= 1) {
    state.statusMessage = 'Already empty inside delimiters';
    return;
  }

  pushUndo(state);
  deleteRange(state, openPos + 1, closePos);
  state.cursor.offset = openPos + 1;
  clampOffset(state);
  state.dirty = true;
}

/**
 * Handles Enter key in insert mode
 * @param {Object} state
 */
function handleEnter(state) {
  pushUndo(state);
  const block = state.document[state.cursor.blockIdx];

  if (block.type === 'unordered-list' || block.type === 'ordered-list') {
    const currentItem = block.items[state.cursor.itemIdx];
    const currentText = spansToText(currentItem);

    if (currentText === '') {
      // Empty item — exit list, create new paragraph
      block.items.splice(state.cursor.itemIdx, 1);
      if (block.items.length === 0) {
        // Replace the empty list with a paragraph
        state.document[state.cursor.blockIdx] = {
          type: 'paragraph',
          content: [{ text: '', bold: false }]
        };
      } else {
        // Insert new paragraph after the list
        const newBlock = { type: 'paragraph', content: [{ text: '', bold: false }] };
        state.document.splice(state.cursor.blockIdx + 1, 0, newBlock);
        state.cursor.blockIdx++;
      }
      state.cursor.itemIdx = 0;
      state.cursor.offset = 0;
    } else {
      // Split current item at cursor, create new item below
      const { beforeSpans, afterSpans } = splitSpansAtOffset(currentItem, state.cursor.offset);
      block.items[state.cursor.itemIdx] = beforeSpans;
      block.items.splice(state.cursor.itemIdx + 1, 0, afterSpans);
      state.cursor.itemIdx++;
      state.cursor.offset = 0;
    }
  } else {
    // Split the block at cursor position
    const { beforeSpans, afterSpans } = splitSpansAtOffset(block.content, state.cursor.offset);
    block.content = beforeSpans;

    const newBlock = { type: 'paragraph', content: afterSpans };
    state.document.splice(state.cursor.blockIdx + 1, 0, newBlock);
    state.cursor.blockIdx++;
    state.cursor.itemIdx = 0;
    state.cursor.offset = 0;
  }

  state.dirty = true;
}

/**
 * Splits spans at a given text offset, returning before and after span arrays
 * @param {import('./convert.js').Span[]} spans
 * @param {number} offset
 * @returns {{ beforeSpans: import('./convert.js').Span[], afterSpans: import('./convert.js').Span[] }}
 */
function splitSpansAtOffset(spans, offset) {
  const before = [];
  const after = [];
  let pos = 0;
  let splitDone = false;

  for (const span of spans) {
    if (splitDone) {
      after.push({ ...span });
      continue;
    }

    if (pos + span.text.length <= offset) {
      before.push({ ...span });
      pos += span.text.length;
    } else {
      const splitAt = offset - pos;
      if (splitAt > 0) {
        before.push({ text: span.text.slice(0, splitAt), bold: span.bold });
      }
      if (splitAt < span.text.length) {
        after.push({ text: span.text.slice(splitAt), bold: span.bold });
      }
      splitDone = true;
      pos += span.text.length;
    }
  }

  if (before.length === 0) before.push({ text: '', bold: false });
  if (after.length === 0) after.push({ text: '', bold: false });

  return { beforeSpans: before, afterSpans: after };
}

/**
 * Converts current block to a different type (leader key formatting)
 * @param {Object} state
 * @param {string} newType
 */
function convertBlockType(state, newType) {
  pushUndo(state);
  const block = state.document[state.cursor.blockIdx];

  if (newType === 'unordered-list' || newType === 'ordered-list') {
    // Convert to list
    let content;
    if (block.type === 'unordered-list' || block.type === 'ordered-list') {
      block.type = newType;
      return; // Already a list, just change type
    }
    content = block.content;
    state.document[state.cursor.blockIdx] = {
      type: newType,
      items: [content]
    };
    state.cursor.itemIdx = 0;
  } else {
    // Convert to paragraph/heading
    let content;
    if (block.type === 'unordered-list' || block.type === 'ordered-list') {
      content = block.items[state.cursor.itemIdx] || [{ text: '', bold: false }];
      // If there are other items, keep them as a separate list
      if (block.items.length > 1) {
        const remainingBefore = block.items.slice(0, state.cursor.itemIdx);
        const remainingAfter = block.items.slice(state.cursor.itemIdx + 1);
        const newBlocks = [];

        if (remainingBefore.length > 0) {
          newBlocks.push({ type: block.type, items: remainingBefore });
        }
        newBlocks.push({ type: newType, content });
        if (remainingAfter.length > 0) {
          newBlocks.push({ type: block.type, items: remainingAfter });
        }

        state.document.splice(state.cursor.blockIdx, 1, ...newBlocks);
        state.cursor.blockIdx += remainingBefore.length > 0 ? 1 : 0;
        state.cursor.itemIdx = 0;
        state.dirty = true;
        return;
      }
      content = block.items[0] || [{ text: '', bold: false }];
    } else {
      content = block.content;
    }
    state.document[state.cursor.blockIdx] = {
      type: newType,
      content
    };
    state.cursor.itemIdx = 0;
  }

  state.dirty = true;
}

/**
 * Toggles bold on the visual selection
 * @param {Object} state
 */
function toggleBoldSelection(state) {
  // For now, toggle bold on entire current spans
  pushUndo(state);
  const spans = getCurrentSpans(state);
  const allBold = spans.every(s => s.bold);
  for (const span of spans) {
    span.bold = !allBold;
  }
  state.dirty = true;
}

/**
 * Deletes the visual selection (currently deletes current block content)
 * @param {Object} state
 */
function deleteSelection(state) {
  pushUndo(state);
  setCurrentSpans(state, [{ text: '', bold: false }]);
  state.cursor.offset = 0;
  state.dirty = true;
}

/**
 * Applies the toolbar action at the current toolbar index
 * @param {Object} state
 */
function applyToolbarAction(state) {
  const item = state.toolbarItems[state.toolbarIndex];
  switch (item) {
    case 'Bold':
      state.insertBold = !state.insertBold;
      toggleBoldSelection(state);
      break;
    case 'H1':
      convertBlockType(state, 'heading1');
      break;
    case 'H2':
      convertBlockType(state, 'heading2');
      break;
    case 'H3':
      convertBlockType(state, 'heading3');
      break;
    case 'Bullet':
      convertBlockType(state, 'unordered-list');
      break;
    case 'Number':
      convertBlockType(state, 'ordered-list');
      break;
    case 'Para':
      convertBlockType(state, 'paragraph');
      break;
  }
}

/**
 * Handles keys when the toolbar is focused
 * @param {Object} state
 * @param {string} key
 * @returns {string|null}
 */
function handleToolbarKey(state, key) {
  switch (key) {
    case 'h': case 'LEFT':
      state.toolbarIndex = Math.max(0, state.toolbarIndex - 1);
      break;
    case 'l': case 'RIGHT':
      state.toolbarIndex = Math.min(state.toolbarItems.length - 1, state.toolbarIndex + 1);
      break;
    case 'j': case 'DOWN': case 'ESCAPE':
      // Return to document
      state.toolbarFocused = false;
      break;
    case 'ENTER':
      applyToolbarAction(state);
      state.toolbarFocused = false;
      break;
    case ':':
      state.toolbarFocused = false;
      state.mode = 'command';
      state.commandBuffer = '';
      break;
    case 'CTRL_S':
      state.toolbarFocused = false;
      return 'save';
    default:
      break;
  }
  return null;
}

/**
 * Handles a key event in normal mode
 * @param {Object} state
 * @param {string} key
 * @returns {string|null} Action to take ('save', 'quit', 'force-quit', 'save-quit', null)
 */
export function handleNormalKey(state, key) {
  state.statusMessage = '';

  // --- Toolbar-focused mode ---
  if (state.toolbarFocused) {
    return handleToolbarKey(state, key);
  }

  // Handle pending 'g' for gg
  if (state.pendingKey === 'g') {
    state.pendingKey = null;
    if (key === 'g') {
      state.cursor.blockIdx = 0;
      state.cursor.itemIdx = 0;
      state.cursor.offset = 0;
      return null;
    }
    // Unknown combo — ignore
    return null;
  }

  // Handle pending 'd' for dd/dt/di
  if (state.pendingKey === 'd') {
    if (key === 'd') { state.pendingKey = null; deleteBlock(state); return null; }
    if (key === 't') { state.pendingKey = 'dt'; return null; }
    if (key === 'i') { state.pendingKey = 'di'; return null; }
    state.pendingKey = null;
    return null;
  }

  if (state.pendingKey === 'dt') {
    state.pendingKey = null;
    if (key === 'ESCAPE') return null;
    if (key.length === 1) deleteTo(state, key);
    return null;
  }

  if (state.pendingKey === 'di') {
    state.pendingKey = null;
    if (key === 'ESCAPE') return null;
    if (key.length === 1) deleteInside(state, key);
    return null;
  }

  // Handle leader key
  if (state.pendingLeader) {
    state.pendingLeader = false;
    switch (key) {
      case '1': convertBlockType(state, 'heading1'); break;
      case '2': convertBlockType(state, 'heading2'); break;
      case '3': convertBlockType(state, 'heading3'); break;
      case 'u': convertBlockType(state, 'unordered-list'); break;
      case 'o': convertBlockType(state, 'ordered-list'); break;
      case 'p': convertBlockType(state, 'paragraph'); break;
      case 'ESCAPE': break; // Cancel
      default: state.statusMessage = `Unknown format key: ${key}`;
    }
    return null;
  }

  switch (key) {
    // Movement
    case 'h': case 'LEFT': moveCursorLeft(state); break;
    case 'j': case 'DOWN': moveCursorDown(state); break;
    case 'k': case 'UP':
      // If at top of document, focus toolbar
      if (state.cursor.blockIdx === 0 && state.cursor.itemIdx === 0) {
        state.toolbarFocused = true;
      } else {
        moveCursorUp(state);
      }
      break;
    case 'l': case 'RIGHT': moveCursorRight(state); break;
    case 'w': moveWordForward(state); break;
    case 'b': moveWordBackward(state); break;
    case 'e': moveWordEnd(state); break;
    case '0': case 'HOME': state.cursor.offset = 0; break;
    case '$': case 'END':
      state.cursor.offset = Math.max(0, getCurrentText(state).length - 1);
      break;
    case 'G':
      state.cursor.blockIdx = state.document.length - 1;
      const lastBlock = state.document[state.cursor.blockIdx];
      if (lastBlock.type === 'unordered-list' || lastBlock.type === 'ordered-list') {
        state.cursor.itemIdx = lastBlock.items.length - 1;
      } else {
        state.cursor.itemIdx = 0;
      }
      state.cursor.offset = 0;
      break;
    case 'g': state.pendingKey = 'g'; break;

    // Enter insert mode
    case 'i':
      state.mode = 'insert';
      break;
    case 'a':
      state.mode = 'insert';
      moveCursorRight(state);
      // Allow cursor at end of text in insert mode
      clampOffset(state, true);
      break;
    case 'A':
      state.mode = 'insert';
      state.cursor.offset = getCurrentText(state).length;
      break;
    case 'I':
      state.mode = 'insert';
      state.cursor.offset = 0;
      break;
    case 'o': {
      // New line below
      pushUndo(state);
      const block = state.document[state.cursor.blockIdx];
      if (block.type === 'unordered-list' || block.type === 'ordered-list') {
        block.items.splice(state.cursor.itemIdx + 1, 0, [{ text: '', bold: false }]);
        state.cursor.itemIdx++;
      } else {
        const newBlock = { type: 'paragraph', content: [{ text: '', bold: false }] };
        state.document.splice(state.cursor.blockIdx + 1, 0, newBlock);
        state.cursor.blockIdx++;
        state.cursor.itemIdx = 0;
      }
      state.cursor.offset = 0;
      state.mode = 'insert';
      state.dirty = true;
      break;
    }
    case 'O': {
      // New line above
      pushUndo(state);
      const block2 = state.document[state.cursor.blockIdx];
      if (block2.type === 'unordered-list' || block2.type === 'ordered-list') {
        block2.items.splice(state.cursor.itemIdx, 0, [{ text: '', bold: false }]);
      } else {
        const newBlock = { type: 'paragraph', content: [{ text: '', bold: false }] };
        state.document.splice(state.cursor.blockIdx, 0, newBlock);
      }
      state.cursor.offset = 0;
      state.mode = 'insert';
      state.dirty = true;
      break;
    }

    // Delete
    case 'x': deleteCharAt(state); break;
    case 'd': state.pendingKey = 'd'; break;

    // Visual mode
    case 'v':
      state.mode = 'visual';
      state.visualAnchor = { ...state.cursor };
      break;

    // Command mode
    case ':':
      state.mode = 'command';
      state.commandBuffer = '';
      break;

    // Undo
    case 'u': undo(state); break;

    // Leader key
    case '\\':
    case '/':
      state.pendingLeader = true;
      break;

    // Ctrl+B for bold toggle on current line
    case 'CTRL_B':
      toggleBoldSelection(state);
      break;

    // Ctrl+S save
    case 'CTRL_S':
      return 'save';

    default:
      // Ignore unknown keys
      break;
  }

  return null;
}

/**
 * Handles a key event in insert mode
 * @param {Object} state
 * @param {string} key
 * @returns {string|null} Action
 */
export function handleInsertKey(state, key) {
  state.statusMessage = '';

  // Handle leader key in insert mode
  if (state.pendingLeader) {
    state.pendingLeader = false;
    switch (key) {
      case '1': convertBlockType(state, 'heading1'); break;
      case '2': convertBlockType(state, 'heading2'); break;
      case '3': convertBlockType(state, 'heading3'); break;
      case 'u': convertBlockType(state, 'unordered-list'); break;
      case 'o': convertBlockType(state, 'ordered-list'); break;
      case 'p': convertBlockType(state, 'paragraph'); break;
      case 'ESCAPE': break;
      default:
        // Not a format key — insert the backslash and the character
        insertChar(state, '\\');
        if (key.length === 1) insertChar(state, key);
    }
    return null;
  }

  switch (key) {
    case 'ESCAPE':
      state.mode = 'normal';
      state.insertBold = false;
      clampOffset(state);
      break;

    case 'ENTER':
      handleEnter(state);
      break;

    case 'BACKSPACE':
      deleteCharBehind(state);
      break;

    case 'DELETE':
      deleteCharAt(state);
      break;

    case 'LEFT':
      moveCursorLeft(state);
      break;

    case 'RIGHT':
      moveCursorRight(state);
      break;

    case 'UP':
      moveCursorUp(state);
      break;

    case 'DOWN':
      moveCursorDown(state);
      break;

    case 'HOME':
      state.cursor.offset = 0;
      break;

    case 'END':
      state.cursor.offset = getCurrentText(state).length;
      break;

    case 'CTRL_B':
      state.insertBold = !state.insertBold;
      state.statusMessage = state.insertBold ? 'Bold ON' : 'Bold OFF';
      break;

    case 'CTRL_S':
      return 'save';

    case '\\':
      state.pendingLeader = true;
      break;

    case 'TAB':
      insertChar(state, '    ');
      break;

    default:
      // Insert printable characters
      if (key.length === 1) {
        insertChar(state, key);
      }
      break;
  }

  return null;
}

/**
 * Handles a key event in visual mode
 * @param {Object} state
 * @param {string} key
 * @returns {string|null} Action
 */
export function handleVisualKey(state, key) {
  state.statusMessage = '';

  switch (key) {
    case 'ESCAPE':
      state.mode = 'normal';
      state.visualAnchor = null;
      break;

    case 'h': case 'LEFT': moveCursorLeft(state); break;
    case 'j': case 'DOWN': moveCursorDown(state); break;
    case 'k': case 'UP': moveCursorUp(state); break;
    case 'l': case 'RIGHT': moveCursorRight(state); break;

    case 'CTRL_B':
      toggleBoldSelection(state);
      state.mode = 'normal';
      state.visualAnchor = null;
      break;

    case 'd':
      deleteSelection(state);
      state.mode = 'normal';
      state.visualAnchor = null;
      break;

    default:
      break;
  }

  return null;
}

/**
 * Handles a key event in command mode
 * @param {Object} state
 * @param {string} key
 * @returns {string|null} Action
 */
export function handleCommandKey(state, key) {
  switch (key) {
    case 'ESCAPE':
      state.mode = 'normal';
      state.commandBuffer = '';
      break;

    case 'ENTER': {
      const cmd = state.commandBuffer.trim();
      state.mode = 'normal';
      state.commandBuffer = '';

      if (cmd === 'w') return 'save';
      if (cmd === 'q') return 'quit';
      if (cmd === 'wq' || cmd === 'x') return 'save-quit';
      if (cmd === 'q!') return 'force-quit';

      state.statusMessage = `Unknown command: :${cmd}`;
      break;
    }

    case 'BACKSPACE':
      if (state.commandBuffer.length > 0) {
        state.commandBuffer = state.commandBuffer.slice(0, -1);
      } else {
        state.mode = 'normal';
      }
      break;

    default:
      if (key.length === 1) {
        state.commandBuffer += key;
      }
      break;
  }

  return null;
}
