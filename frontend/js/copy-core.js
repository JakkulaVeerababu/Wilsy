import {findSkills, SKILLS} from './skills-core.js';
import {escapeHtml as e} from './directory-core.js';

// Copy check: does a resume or cover letter hand the job posting's own words back? Recruiters read copied
// sentences as generated from the posting. Hard keywords (tools, skills, the job title) should match the posting
// exactly; whole phrases and the posting's informal wording should not. Pure functions, no network.
// The rules are adapted from the "echo traps" guide of the open-source ai-job-search project
// (MIT licence, github.com/ai-job-search-dev/ai-job-search).

export const LIFT_WORDS = 5;

// Informal or company-speak words a posting may use that a candidate would rarely say about their own work.
export const VOICE = ['messy', 'ship fast', 'ship quickly', 'move fast', 'rockstar', 'rock star', 'ninja', 'guru', 'wizard', 'superstar',
  'wear many hats', 'fast-paced', 'fast paced', 'hit the ground running', 'self-starter', 'go-getter', 'hustle', 'scrappy', 'bias for action',
  'get things done', 'gets things done', 'how things actually get done', 'create leverage', 'world-class', 'best-in-class', 'obsessed',
  'make a dent', 'zero to one', '0 to 1', '10x', 'high-octane', 'startup-like', 'game changer', 'game-changer', 'thrive in ambiguity',
  'roll up your sleeves', 'move the needle', 'raise the bar', 'synergy', 'think outside the box', 'killer', 'crush it', 'secret sauce',
  'north star', 'dynamic environment', 'work hard play hard', 'unicorn'];

// Words that carry no content of the posting: a copied run made only of these and skill names is not a lift.
const STOP = new Set(('a an and are as at be by for from has have i in into is it its of on or our that the their this to was we were will with you your ' +
  'my me am can able ability work working worked team teams strong good great excellent experience experienced skills skill knowledge ' +
  'understanding years year role roles using use used including include such etc also well other new across within closely all any more').split(' '));
const SKILL_WORDS = new Set(SKILLS.flatMap(([name, aliases]) => [name, ...aliases]).flatMap(s => s.toLowerCase().split(/\s+/)));

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}+#'’./-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu;
function tokens(text) {
  return [...String(text || '').matchAll(TOKEN)].map(m => ({word: m[0].toLowerCase().replace(/[’]/g, "'"), start: m.index, end: m.index + m[0].length}));
}
const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const phrase = p => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(p).replace(/\\?[ -]/g, '[\\s-]+')}(?![\\p{L}\\p{N}])`, 'iu');
// A run is inside quotation marks when an odd number of double quotes come before it on its line.
function quoted(text, start) {
  const line = text.slice(text.lastIndexOf('\n', start - 1) + 1, start);
  return (line.match(/["“”]/g) || []).length % 2 === 1;
}

/**
 * Compares the visitor's text with the posting.
 * lifts: runs of LIFT_WORDS+ words copied in order from the posting (outside quotation marks) that carry at
 * least two of the posting's own content words. echoes: VOICE words found in both. kept/missing: the posting's
 * skills the text does and doesn't name. copiedShare: the share of the text's words inside lifts (0–100).
 */
export function copyCheck(posting, text) {
  const post = tokens(posting), mine = tokens(text);
  const grams = new Set();
  for(let i = 0; i + LIFT_WORDS <= post.length; i++) grams.add(post.slice(i, i + LIFT_WORDS).map(t => t.word).join(' '));
  const covered = new Array(mine.length).fill(false);
  for(let i = 0; i + LIFT_WORDS <= mine.length; i++) {
    if(grams.has(mine.slice(i, i + LIFT_WORDS).map(t => t.word).join(' '))) for(let k = i; k < i + LIFT_WORDS; k++) covered[k] = true;
  }
  const lifts = [];
  for(let i = 0; i < mine.length; i++) {
    if(!covered[i]) continue;
    let j = i; while(j + 1 < mine.length && covered[j + 1]) j++;
    const run = mine.slice(i, j + 1), start = run[0].start, end = run.at(-1).end;
    const content = run.filter(t => !STOP.has(t.word) && !SKILL_WORDS.has(t.word) && !/^\d+$/.test(t.word));
    if(content.length >= 2 && !quoted(String(text), start)) lifts.push({start, end, text: String(text).slice(start, end), words: run.length});
    i = j;
  }
  const echoes = VOICE.filter(p => phrase(p).test(posting) && phrase(p).test(text));
  const want = findSkills(posting), have = new Set(findSkills(text));
  const liftedWords = lifts.reduce((sum, l) => sum + l.words, 0);
  return {lifts, echoes, kept: want.filter(s => have.has(s)), missing: want.filter(s => !have.has(s)),
    copiedShare: mine.length ? Math.round(liftedWords / mine.length * 100) : 0, words: mine.length};
}

export function copyVerdict(r) {
  if(!r.words) return 'Paste your text to check it';
  if(!r.lifts.length && !r.echoes.length) return 'Reads as your own words';
  if(r.copiedShare >= 20 || r.lifts.length >= 4) return 'Heavily copied from the posting';
  return 'A few lines echo the posting';
}

/** The visitor's text as escaped HTML with each lift wrapped in <mark>. */
export function markLifts(text, lifts) {
  let html = '', at = 0;
  for(const l of [...lifts].sort((a, b) => a.start - b.start)) {
    html += e(text.slice(at, l.start)) + `<mark class="copy-lift">${e(text.slice(l.start, l.end))}</mark>`;
    at = l.end;
  }
  return html + e(text.slice(at));
}
