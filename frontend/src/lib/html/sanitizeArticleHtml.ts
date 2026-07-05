const SAFE_HTML_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'dd',
  'del',
  'details',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
]);

const GLOBAL_SAFE_ATTRIBUTES = new Set(['aria-label', 'dir', 'lang', 'title']);
const LINK_SAFE_ATTRIBUTES = new Set(['href', 'title']);
const IMAGE_SAFE_ATTRIBUTES = new Set(['alt', 'height', 'src', 'title', 'width']);
const TABLE_SAFE_ATTRIBUTES = new Set(['colspan', 'rowspan', 'scope']);

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./')) return true;

  try {
    const parsed = new URL(trimmed, 'https://newsboxone.local');
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isSafeAttribute(tagName: string, attributeName: string): boolean {
  if (GLOBAL_SAFE_ATTRIBUTES.has(attributeName)) return true;
  if (tagName === 'a') return LINK_SAFE_ATTRIBUTES.has(attributeName);
  if (tagName === 'img') return IMAGE_SAFE_ATTRIBUTES.has(attributeName);
  if (['td', 'th'].includes(tagName)) return TABLE_SAFE_ATTRIBUTES.has(attributeName);
  return false;
}

function sanitizeNode(source: Node, targetDocument: Document): Node | null {
  if (source.nodeType === Node.TEXT_NODE) {
    return targetDocument.createTextNode(source.textContent ?? '');
  }

  if (source.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const sourceElement = source as Element;
  const tagName = sourceElement.tagName.toLowerCase();
  const sanitizedChildren = Array.from(sourceElement.childNodes)
    .map((child) => sanitizeNode(child, targetDocument))
    .filter((child): child is Node => child !== null);

  if (!SAFE_HTML_TAGS.has(tagName)) {
    const fragment = targetDocument.createDocumentFragment();
    for (const child of sanitizedChildren) {
      fragment.appendChild(child);
    }
    return fragment;
  }

  const element = targetDocument.createElement(tagName);
  for (const attribute of Array.from(sourceElement.attributes)) {
    const attributeName = attribute.name.toLowerCase();
    if (attributeName.startsWith('on') || attributeName === 'style') continue;
    if (!isSafeAttribute(tagName, attributeName)) continue;
    if ((attributeName === 'href' || attributeName === 'src') && !isSafeUrl(attribute.value)) {
      continue;
    }
    element.setAttribute(attributeName, attribute.value);
  }

  if (tagName === 'a' && element.hasAttribute('href')) {
    element.setAttribute('rel', 'noopener noreferrer');
  }

  for (const child of sanitizedChildren) {
    element.appendChild(child);
  }

  return element;
}

function sanitizeDocumentBody(sourceDocument: Document, targetDocument: Document): string {
  const fragment = targetDocument.createDocumentFragment();

  for (const child of Array.from(sourceDocument.body.childNodes)) {
    const sanitized = sanitizeNode(child, targetDocument);
    if (sanitized) {
      fragment.appendChild(sanitized);
    }
  }

  const container = targetDocument.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

function stripHtmlTagsFallback(html: string): string {
  let output = '';
  let index = 0;

  while (index < html.length) {
    const character = html[index];

    if (character !== '<') {
      output += character;
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let quote: string | null = null;

    while (cursor < html.length) {
      const current = html[cursor];

      if (quote !== null) {
        if (current === quote) {
          quote = null;
        }
      } else if (current === '"' || current === "'") {
        quote = current;
      } else if (current === '>') {
        break;
      }

      cursor += 1;
    }

    if (cursor >= html.length) {
      break;
    }

    const tagContent = html.slice(index + 1, cursor).trim().toLowerCase();
    const isClosingTag = tagContent.startsWith('/');
    const tagName = tagContent.replace(/^\/+/, '').split(/\s|\//, 1)[0];

    if (!isClosingTag && (tagName === 'script' || tagName === 'style')) {
      const closingTag = `</${tagName}>`;
      const closingIndex = html.toLowerCase().indexOf(closingTag, cursor + 1);
      if (closingIndex === -1) {
        break;
      }

      index = closingIndex + closingTag.length;
      continue;
    }

    index = cursor + 1;
  }

  return output;
}

/**
 * Sanitizes publisher-controlled article HTML before it can be rendered.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html.trim()) return '';
  if (typeof DOMParser === 'undefined' || typeof document === 'undefined') {
    return stripHtmlTagsFallback(html);
  }

  const parser = new DOMParser();
  const sourceDocument = parser.parseFromString(html, 'text/html');
  const targetDocument = document.implementation.createHTMLDocument('sanitized-article');
  return sanitizeDocumentBody(sourceDocument, targetDocument);
}