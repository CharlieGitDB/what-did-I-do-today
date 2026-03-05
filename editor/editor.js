/**
 * @fileoverview Main editor: state management, event loop, public API
 */

import termkit from 'terminal-kit';
import { createEmptyDocument, htmlToDocument, documentToHtml } from './convert.js';
import { render } from './render.js';
import { handleNormalKey, handleInsertKey, handleVisualKey, handleCommandKey } from './keymap.js';

const term = termkit.terminal;

/**
 * Creates the initial editor state
 * @param {import('./convert.js').Block[]} [document] - Initial document
 * @returns {Object} Editor state
 */
function createState(document) {
  return {
    document: document || createEmptyDocument(),
    cursor: { blockIdx: 0, itemIdx: 0, offset: 0 },
    mode: 'normal',
    pendingKey: null,
    pendingLeader: false,
    visualAnchor: null,
    commandBuffer: '',
    insertBold: false,
    undoStack: [],
    scrollOffset: 0,
    dirty: false,
    statusMessage: '',
    toolbarFocused: false,
    toolbarIndex: 0,
    toolbarItems: ['Bold', 'H1', 'H2', 'H3', 'Bullet', 'Number', 'Para']
  };
}

/**
 * Opens the editor with optional initial HTML content
 * Returns the edited HTML content, or null if the user quit without saving
 * @param {string} [initialHtml] - Initial HTML content to edit
 * @returns {Promise<string|null>} The edited HTML, or null if cancelled
 */
export async function openEditor(initialHtml) {
  let document;
  if (initialHtml) {
    document = htmlToDocument(initialHtml);
  } else {
    document = createEmptyDocument();
  }

  const state = createState(document);

  // Set up terminal
  term.fullscreen(true);
  term.grabInput({ mouse: false });
  term.hideCursor(false);

  // Initial render
  render(term, state);

  return new Promise((resolve) => {
    function cleanup(result) {
      term.grabInput(false);
      term.hideCursor(false);
      term.fullscreen(false);
      term.clear();
      resolve(result);
    }

    function handleAction(action) {
      if (!action) return;

      switch (action) {
        case 'save': {
          const html = documentToHtml(state.document);
          state.dirty = false;
          state.statusMessage = 'Saved!';
          state._savedHtml = html;
          render(term, state);
          break;
        }
        case 'quit': {
          if (state.dirty) {
            state.statusMessage = 'Unsaved changes! Use :q! to force quit or :wq to save and quit';
            render(term, state);
          } else {
            cleanup(state._savedHtml || null);
          }
          break;
        }
        case 'force-quit': {
          cleanup(null);
          break;
        }
        case 'save-quit': {
          const html = documentToHtml(state.document);
          cleanup(html);
          break;
        }
      }
    }

    term.on('key', (key) => {
      let action = null;

      switch (state.mode) {
        case 'normal':
          action = handleNormalKey(state, key);
          break;
        case 'insert':
          action = handleInsertKey(state, key);
          break;
        case 'visual':
          action = handleVisualKey(state, key);
          break;
        case 'command':
          action = handleCommandKey(state, key);
          break;
      }

      render(term, state);
      handleAction(action);
    });
  });
}
