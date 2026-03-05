/**
 * @fileoverview Bidirectional conversion between Document model and Confluence XHTML
 */

/**
 * @typedef {Object} Span
 * @property {string} text
 * @property {boolean} bold
 */

/**
 * @typedef {Object} Block
 * @property {'paragraph'|'heading1'|'heading2'|'heading3'|'unordered-list'|'ordered-list'} type
 * @property {Span[]} [content] - For paragraph/heading types
 * @property {Span[][]} [items] - For list types, each item is an array of spans
 */

/**
 * Escapes HTML special characters
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Unescapes HTML entities
 * @param {string} text
 * @returns {string}
 */
function unescapeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Converts an array of spans to HTML string
 * @param {Span[]} spans
 * @returns {string}
 */
function spansToHtml(spans) {
  return spans.map(span => {
    const escaped = escapeHtml(span.text);
    return span.bold ? `<strong>${escaped}</strong>` : escaped;
  }).join('');
}

/**
 * Converts a Document (array of blocks) to Confluence XHTML
 * @param {Block[]} document
 * @returns {string}
 */
export function documentToHtml(document) {
  const parts = [];

  // Group consecutive list blocks of the same type
  let i = 0;
  while (i < document.length) {
    const block = document[i];

    if (block.type === 'paragraph') {
      parts.push(`<p>${spansToHtml(block.content)}</p>`);
      i++;
    } else if (block.type === 'heading1') {
      parts.push(`<h1>${spansToHtml(block.content)}</h1>`);
      i++;
    } else if (block.type === 'heading2') {
      parts.push(`<h2>${spansToHtml(block.content)}</h2>`);
      i++;
    } else if (block.type === 'heading3') {
      parts.push(`<h3>${spansToHtml(block.content)}</h3>`);
      i++;
    } else if (block.type === 'unordered-list') {
      const listItems = block.items.map(item => `<li>${spansToHtml(item)}</li>`).join('');
      parts.push(`<ul>${listItems}</ul>`);
      i++;
    } else if (block.type === 'ordered-list') {
      const listItems = block.items.map(item => `<li>${spansToHtml(item)}</li>`).join('');
      parts.push(`<ol>${listItems}</ol>`);
      i++;
    } else {
      i++;
    }
  }

  return parts.join('\n');
}

/**
 * Parses inline content (text with <strong> tags) into spans
 * @param {string} html - The inline HTML content
 * @returns {Span[]}
 */
function parseInlineContent(html) {
  const spans = [];
  const regex = /<strong>(.*?)<\/strong>/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(html)) !== null) {
    // Add any text before the <strong> tag
    if (match.index > lastIndex) {
      const text = unescapeHtml(html.substring(lastIndex, match.index));
      if (text) spans.push({ text, bold: false });
    }
    // Add the bold text
    const text = unescapeHtml(match[1]);
    if (text) spans.push({ text, bold: true });
    lastIndex = regex.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < html.length) {
    const text = unescapeHtml(html.substring(lastIndex));
    if (text) spans.push({ text, bold: false });
  }

  // If no spans were found, return a single empty span
  if (spans.length === 0) {
    spans.push({ text: '', bold: false });
  }

  return spans;
}

/**
 * Converts Confluence XHTML to a Document (array of blocks)
 * @param {string} html
 * @returns {Block[]}
 */
export function htmlToDocument(html) {
  const blocks = [];
  // Strip leading/trailing whitespace from lines
  const cleaned = html.trim();

  if (!cleaned) {
    return [{ type: 'paragraph', content: [{ text: '', bold: false }] }];
  }

  // Parse block-level elements
  const blockRegex = /<(p|h1|h2|h3|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = blockRegex.exec(cleaned)) !== null) {
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];

    // Skip timestamp paragraphs
    if (tag === 'p' && match[0].includes('style="color: #888"')) {
      continue;
    }

    if (tag === 'p') {
      blocks.push({
        type: 'paragraph',
        content: parseInlineContent(innerHtml)
      });
    } else if (tag === 'h1') {
      blocks.push({
        type: 'heading1',
        content: parseInlineContent(innerHtml)
      });
    } else if (tag === 'h2') {
      blocks.push({
        type: 'heading2',
        content: parseInlineContent(innerHtml)
      });
    } else if (tag === 'h3') {
      blocks.push({
        type: 'heading3',
        content: parseInlineContent(innerHtml)
      });
    } else if (tag === 'ul' || tag === 'ol') {
      const items = [];
      const liRegex = /<li>([\s\S]*?)<\/li>/gi;
      let liMatch;
      while ((liMatch = liRegex.exec(innerHtml)) !== null) {
        items.push(parseInlineContent(liMatch[1]));
      }
      blocks.push({
        type: tag === 'ul' ? 'unordered-list' : 'ordered-list',
        items: items.length > 0 ? items : [[{ text: '', bold: false }]]
      });
    }
  }

  // If no blocks were parsed, treat the whole thing as a single paragraph
  if (blocks.length === 0) {
    blocks.push({
      type: 'paragraph',
      content: parseInlineContent(cleaned.replace(/<[^>]+>/g, ''))
    });
  }

  return blocks;
}

/**
 * Gets the plain text content of spans
 * @param {Span[]} spans
 * @returns {string}
 */
export function spansToText(spans) {
  return spans.map(s => s.text).join('');
}

/**
 * Creates an empty document with one empty paragraph
 * @returns {Block[]}
 */
export function createEmptyDocument() {
  return [{ type: 'paragraph', content: [{ text: '', bold: false }] }];
}
