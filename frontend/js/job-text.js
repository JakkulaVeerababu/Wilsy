const entities = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  '#x27': "'",
  ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', hellip: '…',
};

export function decodeEntities(value) {
  return String(value ?? '').replace(/&(#x?[\da-f]+|[a-z]+);/gi, (match, name) => {
    const key = name.toLowerCase();
    if (key in entities) return entities[key];
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\uFFFD';
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\uFFFD';
    }
    return match;
  });
}

/** Convert source HTML/escaped HTML to safe, readable plain text for previews. */
export function plainJobText(value, fallback = 'See the employer listing for the full role description.') {
  let text = String(value ?? '');
  for (let pass = 0; pass < 4; pass += 1) text = decodeEntities(text);
  text = text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text || fallback;
}

export function previewJobText(value, max = 150) {
  const text = plainJobText(value);
  if (text.length <= max) return text;
  const clipped = text.slice(0, max).replace(/\s+\S*$/, '').trim();
  return `${clipped || text.slice(0, max).trim()}…`;
}
