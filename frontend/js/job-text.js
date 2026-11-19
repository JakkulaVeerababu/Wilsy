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

// Card previews skip the section heading many listings open with ("ABOUT THE TEAM", "Company overview:").
const namedHeading = /^(?:about (?:us|the (?:team|role|company|job|position|opportunity))|who we are|company (?:overview|description)|job (?:description|summary|overview)|role (?:overview|summary)|position summary|overview|the role)\b[\s:—–-]*(?=[A-Z])/i;
const capsHeading = /^(?:[A-Z][A-Z&'’]+\s+){2,5}(?=[A-Z][a-z])/;
// They also drop bare web addresses, and an opening "About Stripe" that only repeats the name that follows.
const webAddress = /\b(?:https?:\/\/|www\.)\S+/gi;
const aboutName = /^(?:about|why)\s+(?:(\S+(?:\s+\S+){0,3}?)\s*[:—–-]?\s+(?=\1\b)|(?:[^\s:]+\s+){0,2}[^\s:]+:\s*)/i;
export function previewJobText(value, max = 150) {
  const full = plainJobText(value).replace(webAddress, '').replace(/\s+/g, ' ').trim() || plainJobText('');
  // Headings can be stacked ("Who we are About Stripe Stripe is…"), so strip until none is left.
  let stripped = full;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = stripped.replace(namedHeading, '').replace(aboutName, '').replace(capsHeading, '').trim();
    if (next === stripped) break;
    stripped = next;
  }
  const text = stripped.length > 40 ? stripped[0].toUpperCase() + stripped.slice(1) : full;
  if (text.length <= max) return text;
  const clipped = text.slice(0, max).replace(/\s+\S*$/, '').trim();
  return `${clipped || text.slice(0, max).trim()}…`;
}
