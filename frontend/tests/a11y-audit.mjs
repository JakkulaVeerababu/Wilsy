// Accessibility audit helpers shared by tests/a11y.test.mjs. Plain functions with no Node imports,
// so the same audit can also run in a browser against the live page.
// A small, forgiving HTML parser: enough structure for labels, names and ids.
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr']);
const RAW = new Set(['script','style','textarea','title']);
const ENTITIES = {amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' '};
const decode = text => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, v) => v[0] === '#' ? String.fromCodePoint(v[1].toLowerCase() === 'x' ? parseInt(v.slice(2), 16) : Number(v.slice(1))) : ENTITIES[v.toLowerCase()] ?? m);
export function parse(html) {
  const doc = {tag: '#document', attrs: {}, children: [], parent: null};
  const tag = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
  let node = doc, last = 0, match;
  const text = value => { if(value) node.children.push({text: decode(value)}); };
  while((match = tag.exec(html))) {
    text(html.slice(last, match.index)); last = tag.lastIndex;
    const [, close, open, rawAttrs, selfClose] = match;
    if(close) {
      const name = close.toLowerCase();
      let target = node;
      while(target && target.tag !== name) target = target.parent;
      if(target && target.parent) node = target.parent;
      continue;
    }
    if(!open) continue;
    const name = open.toLowerCase(), attrs = {};
    for(const [, key, dq, sq, bare] of (rawAttrs || '').matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) attrs[key.toLowerCase()] = decode(dq ?? sq ?? bare ?? '');
    const element = {tag: name, attrs, children: [], parent: node};
    node.children.push(element);
    if(RAW.has(name)) {
      const end = html.toLowerCase().indexOf(`</${name}`, last);
      element.children.push({text: html.slice(last, end < 0 ? html.length : end)});
      last = tag.lastIndex = end < 0 ? html.length : html.indexOf('>', end) + 1;
      continue;
    }
    if(!VOID.has(name) && !selfClose) node = element;
  }
  text(html.slice(last));
  return doc;
}
function* walk(node) { for(const child of node.children || []) { if(child.tag) { yield child; yield* walk(child); } } }
const hiddenFromAt = el => el.attrs['aria-hidden'] === 'true';
// The text a screen reader would read for an element's contents.
function contentName(el) {
  if(el.text !== undefined) return el.text;
  if(hiddenFromAt(el) || ['script','style','template'].includes(el.tag)) return '';
  if(el.tag === 'img') return el.attrs.alt || '';
  if(el.tag === 'svg') return el.attrs['aria-label'] || (el.children.find(c => c.tag === 'title') ? contentName(el.children.find(c => c.tag === 'title')) : '');
  return el.children.map(contentName).join(' ');
}
function accessibleName(el, ids) {
  const labelledby = (el.attrs['aria-labelledby'] || '').split(/\s+/).filter(Boolean).map(id => ids.get(id)).filter(Boolean);
  if(labelledby.length) return labelledby.map(contentName).join(' ').trim();
  if(el.attrs['aria-label']?.trim()) return el.attrs['aria-label'].trim();
  const own = contentName(el).replace(/\s+/g, ' ').trim();
  return own || (el.attrs.title || '').trim();
}
const isControl = el => (el.tag === 'input' && !['hidden','submit','button','reset','image'].includes((el.attrs.type || 'text').toLowerCase())) || el.tag === 'select' || el.tag === 'textarea';
function controlLabel(el, ids, labelsFor) {
  if(el.attrs['aria-label']?.trim() || el.attrs.title?.trim()) return true;
  if(el.attrs['aria-labelledby']) return !!accessibleName(el, ids);
  if(el.attrs.id && labelsFor.get(el.attrs.id)?.some(label => contentName(label).trim())) return true;
  for(let p = el.parent; p; p = p.parent) if(p.tag === 'label') return !!contentName(p).replace(/\s+/g, '').length;
  return false;
}

export function auditPage(html) {
  const doc = parse(html), problems = [], ids = new Map(), labelsFor = new Map();
  const elements = [...walk(doc)];
  const htmlEl = elements.find(el => el.tag === 'html');
  if(!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(htmlEl?.attrs.lang || '')) problems.push('<html> has no valid lang');
  for(const el of elements) {
    // Ids inside <template> or SVG <defs> are still document ids, so all of them count.
    if(el.attrs.id !== undefined) { if(ids.has(el.attrs.id)) problems.push(`duplicate id "${el.attrs.id}"`); else ids.set(el.attrs.id, el); }
    if(el.tag === 'label' && el.attrs.for) labelsFor.set(el.attrs.for, [...(labelsFor.get(el.attrs.for) || []), el]);
  }
  const describe = el => `<${el.tag}${['id','class','name','href','src'].filter(k => el.attrs[k] !== undefined).map(k => ` ${k}="${String(el.attrs[k]).slice(0, 60)}"`).join('')}>`;
  for(const el of elements) {
    if(el.attrs.tabindex !== undefined && Number(el.attrs.tabindex) > 0) problems.push(`positive tabindex on ${describe(el)}`);
    if(el.tag === 'img' && el.attrs.alt === undefined) problems.push(`img without alt: ${describe(el)}`);
    if(isControl(el) && !controlLabel(el, ids, labelsFor)) problems.push(`unlabelled form control ${describe(el)}`);
    if(el.tag === 'label' && el.attrs.for && !ids.has(el.attrs.for)) problems.push(`label for missing id "${el.attrs.for}"`);
    if((el.tag === 'button' || (el.tag === 'a' && el.attrs.href !== undefined) || el.attrs.role === 'button' || el.attrs.role === 'link') && !accessibleName(el, ids)) problems.push(`no accessible name: ${describe(el)}`);
    if(el.tag === 'input' && ['submit','button'].includes(el.attrs.type) && !(el.attrs.value || el.attrs['aria-label'])) problems.push(`no accessible name: ${describe(el)}`);
  }
  return problems;
}

export function hexToRgb(value) {
  const v = value.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(v); if(m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})$/.exec(v); if(m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = /^rgb\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*\)$/.exec(v); if(m) return m.slice(1, 4).map(Number);
  if(v === '#fff' || v === 'white') return [255, 255, 255];
  return null;
}
export const luminance = rgb => { const [r, g, b] = rgb.map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// Specificity of the selectors that set tokens on the root element, by theme.
export function rootSpecificity(selector, dark) {
  const s = selector.trim();
  if(/\s|>|~|\+/.test(s)) return -1; // descendants are not the root element
  const darkClass = /\.dark-theme\b/.test(s), notDark = /:not\(\.dark-theme\)/.test(s);
  if(!/^(?:html|:root)/.test(s) || (darkClass && !notDark && !dark) || (notDark && dark)) return -1;
  if(/\.(?!dark-theme\b)[\w-]+|\[|#/.test(s.replace(/:not\(\.dark-theme\)/, ''))) return -1;
  const classes = (s.match(/\.[\w-]+|:(?!root)[\w-]+\(|:root/g) || []).length, types = /^html/.test(s) ? 1 : 0;
  return classes * 100 + types;
}
export function rootTokens(css, dark) {
  const declared = new Map(); // name -> {value, specificity, order, important}
  let order = 0;
  const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for(const [, selectors, block] of body.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    const specificity = Math.max(...selectors.split(',').map(s => rootSpecificity(s, dark)));
    if(specificity < 0) continue;
    for(const [, name, raw] of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
      const important = /!important/.test(raw), value = raw.replace(/!important/, '').trim(), prev = declared.get(name), next = {value, specificity, order: ++order, important};
      if(!prev || (important && !prev.important) || (important === prev.important && specificity >= prev.specificity)) declared.set(name, next);
    }
  }
  const resolve = (name, seen = new Set()) => {
    if(seen.has(name)) return null;
    seen.add(name);
    const value = declared.get(name)?.value;
    if(!value) return null;
    const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(value);
    return ref ? resolve(ref[1], seen) ?? ref[2] ?? null : value;
  };
  return name => resolve(name);
}
