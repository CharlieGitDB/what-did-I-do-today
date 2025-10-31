/**
 * Converts markdown to Confluence storage format (XHTML)
 * @param {string} markdown - Markdown content
 * @returns {string} Confluence storage format
 */
export function markdownToConfluence(markdown) {
  let html = markdown;

  // Escape HTML special characters in content (but not in our generated tags)
  // We'll do this selectively to avoid breaking our conversions

  // Headers - must come before other conversions
  // Process from most specific to least specific to avoid conflicts
  html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const language = lang || 'text';
    return `<ac:structured-macro ac:name="code"><ac:parameter ac:name="language">${language}</ac:parameter><ac:plain-text-body><![CDATA[${code.trim()}]]></ac:plain-text-body></ac:structured-macro>`;
  });

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  // Note: This is simplified - in reality we'd need better list detection

  // Task lists (checkboxes)
  html = html.replace(/<li>\[ \] (.+)<\/li>/g, '<li><ac:task><ac:task-status>incomplete</ac:task-status><ac:task-body>$1</ac:task-body></ac:task></li>');
  html = html.replace(/<li>\[x\] (.+)<\/li>/g, '<li><ac:task><ac:task-status>complete</ac:task-status><ac:task-body>$1</ac:task-body></ac:task></li>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr/>');

  // Line breaks - convert double newlines to paragraphs
  html = html.split('\n\n').map(para => {
    // Don't wrap if it's already wrapped in a block element
    if (para.match(/^<(h\d|ul|ol|hr|ac:|li|p)/)) {
      return para;
    }
    if (para.trim()) {
      return `<p>${para.replace(/\n/g, '<br/>')}</p>`;
    }
    return '';
  }).join('\n');

  return html;
}

/**
 * Cleans up the Confluence HTML by removing empty tags and fixing structure
 * @param {string} html - HTML content
 * @returns {string} Cleaned HTML
 */
export function cleanConfluenceHtml(html) {
  // Remove empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  // Remove empty list items
  html = html.replace(/<li>\s*<\/li>/g, '');

  // Remove empty lists
  html = html.replace(/<ul>\s*<\/ul>/g, '');
  html = html.replace(/<ol>\s*<\/ol>/g, '');

  return html.trim();
}

/**
 * Converts a full markdown file to Confluence storage format
 * @param {string} markdown - Full markdown content
 * @returns {string} Confluence storage format
 */
export function convertMarkdownFile(markdown) {
  const html = markdownToConfluence(markdown);
  return cleanConfluenceHtml(html);
}
