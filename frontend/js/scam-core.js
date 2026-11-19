// Job scam check: the warning signs of common job scams in a pasted offer, message or listing. Runs in
// the browser only; nothing pasted is sent anywhere. A flag is a reason to check, not proof, and finding
// no flags doesn't prove an offer is real.

export const SCAM_MAX = 20000;

// Free email services. A recruiter at a large company writes from the company's own domain.
export const PERSONAL_DOMAINS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'ymail.com', 'rediffmail.com',
  'outlook.com', 'outlook.in', 'hotmail.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'protonmail.com', 'proton.me',
  'zohomail.in', 'zohomail.com', 'mail.com', 'gmx.com', 'yandex.com', 'tutanota.com'];

// Large employers that job scams often name: [name, how the text names it, the key a lookalike address
// contains, the domains the company really uses, and (optionally) a stricter "named" pattern for common words].
export const BRANDS = [
  ['TCS', 'tcs|tata\\s+consultancy(?:\\s+services)?', 'tcs', ['tcs.com', 'tcsion.com']],
  ['Infosys', 'infosys', 'infosys', ['infosys.com', 'infosysbpm.com']],
  ['Wipro', 'wipro', 'wipro', ['wipro.com']],
  ['Accenture', 'accenture', 'accenture', ['accenture.com']],
  ['Cognizant', 'cognizant', 'cognizant', ['cognizant.com']],
  ['Capgemini', 'capgemini', 'capgemini', ['capgemini.com']],
  ['Deloitte', 'deloitte', 'deloitte', ['deloitte.com']],
  ['HCLTech', 'hcl(?:\\s*tech(?:nologies)?)?', 'hcl', ['hcltech.com', 'hcl.com']],
  ['Tech Mahindra', 'tech\\s*mahindra', 'techmahindra', ['techmahindra.com']],
  ['IBM', 'ibm', 'ibm', ['ibm.com']],
  ['Amazon', 'amazon', 'amazon', ['amazon.com', 'amazon.in', 'amazon.jobs', 'aboutamazon.com', 'aboutamazon.in', 'amazonaws.com']],
  ['Google', 'google', 'google', ['google.com', 'googleapis.com', 'googleusercontent.com', 'googlegroups.com', 'withgoogle.com']],
  ['Microsoft', 'microsoft', 'microsoft', ['microsoft.com', 'microsoftonline.com']],
  ['Flipkart', 'flipkart', 'flipkart', ['flipkart.com', 'flipkartcareers.com']],
  ['IndiGo', 'indigo(?:\\s+airlines?)?|interglobe(?:\\s+aviation)?', 'indigo', ['goindigo.in'], 'indigo\\s+(?:airlines?|hr|careers?|recruitment|cabin\\s+crew)|interglobe'],
  ['Air India', 'air\\s*india', 'airindia', ['airindia.com']],
].map(([name, source, key, official, strict]) => ({name, key, official,
  named: new RegExp(`\\b(?:${strict || source})\\b`, 'i'),
  // Writing as the company: "from TCS", "Infosys HR", "selected at Amazon", "Wipro recruitment team".
  claims: new RegExp(`\\b(?:from|at|join(?:ing)?|behalf\\s+of|selected\\s+(?:in|for|at|by)|offer\\s+(?:from|letter\\s+from)|(?:position|role|job|opening|vacancy|vacancies)\\s+(?:at|in|with)|hiring\\s+(?:at|for)|work(?:ing)?\\s+(?:at|for))\\s+(?:the\\s+)?(?:${source})\\b|\\b(?:${source})\\s+(?:hr|recruit\\w*|hiring|careers?|talent|human\\s+resources|team|pvt|private|ltd|limited|india|group|offer|jobs?|work\\s+from\\s+home|wfh)\\b`, 'i')}));

const SUFFIX2 = /^(?:co|org|net|ac|gov|nic|firm|gen|ind)\.(?:in|uk)$/;
/** The part of a host name that is registered: "careers.tcs.com" → "tcs.com", "tcs-jobs.co.in" → "tcs-jobs.co.in". */
export const shortDomain = host => {
  const parts = String(host).toLowerCase().replace(/\.$/, '').split('.');
  return parts.slice(SUFFIX2.test(parts.slice(-2).join('.')) ? -3 : -2).join('.');
};

/** Every email address and web address in the text, with its host. */
export function addresses(input) {
  const text = String(input), found = [];
  for(const m of text.matchAll(/[\w.+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/gi)) found.push({kind: 'email', value: m[0].replace(/\.$/, ''), domain: m[1].toLowerCase()});
  for(const m of text.matchAll(/\b(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s<>"')]*)?/gi)) {
    if(text[m.index - 1] === '@' || text[m.index + m[0].length] === '@') continue; // part of an email address
    found.push({kind: 'link', value: m[0].replace(/[.,;:!?]+$/, ''), domain: m[1].toLowerCase().replace(/^www\./, '')});
  }
  return found;
}

/** The brand a host imitates: it carries the brand's name, but isn't one of the brand's own domains. */
export function imitates(host, brands = BRANDS) {
  const domain = String(host).toLowerCase(), registered = shortDomain(domain), tokens = domain.split(/[.-]/);
  if(PERSONAL_DOMAINS.includes(domain)) return null;
  return brands.find(b => (b.key.length >= 5 ? domain.replace(/-/g, '').includes(b.key) : tokens.some(t => t.startsWith(b.key)))
    && !b.official.includes(registered) && registered.split('.')[0] !== b.key) || null;
}

const AMOUNT = '(?:(?:₹|rs\\.?|inr)\\s?\\d[\\d,]*(?:\\.\\d+)?(?:\\s*k\\b|\\s*/-)?|\\d[\\d,]*(?:\\.\\d+)?\\s*(?:rupees|rs\\b|inr\\b)(?:\\s*/-)?)';
const FOR_WHAT = '(?:registration|security|training|processing|kit|deposit|fee|fees|joining|verification|laptop|uniform|id\\s*card|insurance|documents?|onboarding|interview|certificate|slot|seat|offer\\s+letter)';
const RULES = [
  {id: 'fee', level: 'high', title: 'Asks you to pay',
    why: 'Real employers never charge you to apply, train, get a laptop or join. A fee or deposit, even a “refundable” one, is the most common sign of a job scam.',
    tests: [
      /\b(?:registration|security|joining|training|processing|verification|documentation|document|interview|onboarding|refundable|laptop|kit|uniform|id\s*card|courier|insurance|certificate|offer\s+letter)\s+(?:fee|fees|charge|charges|deposit|amount\s+of)\b/i,
      /\b(?:refundable|security|caution)\s+(?:deposit|money|amount)\b/i,
      new RegExp(`${AMOUNT}\\s*(?:only\\s+)?(?:as|for|towards)\\s+(?:the\\s+|a\\s+|your\\s+)?${FOR_WHAT}`, 'i'),
      new RegExp(`\\b(?:you\\s+(?:have|need|must|are\\s+required|will\\s+need)\\s+to|need\\s+to|have\\s+to|must|required\\s+to|kindly|please|just|only)\\s+(?:pay|deposit|transfer|send)\\s+(?:a\\s+|the\\s+|only\\s+|just\\s+)?(?:small\\s+|one[\\s-]time\\s+|nominal\\s+)?(?:amount\\s+of\\s+|fee\\s+of\\s+|sum\\s+of\\s+)?${AMOUNT}`, 'i'),
      new RegExp(`\\b(?:pay|deposit|transfer)\\s+${AMOUNT}\\s*(?:only\\s+)?(?:to|and)\\s+(?:register|confirm|book|reserve|secure|activate|unlock|start|get|receive|complete|join)\\b`, 'i'),
      /\b(?:pay|send|transfer)\s+(?:the\s+|this\s+)?(?:amount|money|fee|fees|charges?|deposit|payment)\b[^.\n]{0,40}\b(?:upi|g\s?pay|google\s*pay|phone\s*pe|paytm|bhim|qr)\b/i,
      /\bscan\s+(?:the\s+|this\s+|our\s+)?qr\s*(?:code)?\s+(?:to|and)\s+pay\b/i,
      /\b[\w.-]{2,}@(?:ok(?:axis|icici|sbi|hdfcbank)|ybl|ibl|axl|paytm|upi|apl|yapl|pt(?:yes|axis|hdfc|sbi)|axisbank|icici|sbi|hdfcbank|kotak|freecharge|airtel|jio|fbl|idfcbank)\b(?!\.\w)/i,
    ]},
  {id: 'task', level: 'high', title: 'Paid “tasks” such as liking videos or rating hotels',
    why: 'Being paid to like videos, rate hotels or write reviews, then asked to “top up” or “recharge” to unlock bigger tasks or withdraw your earnings, is a well-known task scam.',
    tests: [
      /\b(?:prepaid|pre-paid|merchant|combo|vip)\s+tasks?\b/i,
      /\b(?:per|each|every|for\s+each)\s+(?:like|review|rating|click)\b/i,
      /\b(?:like|subscribe\s+to)\s+(?:youtube\s+|instagram\s+)?(?:videos?|channels?|reels?|posts?)\b/i,
      /\b(?:rate|rating|review|reviewing)\s+(?:hotels?|restaurants?|movies?|places\s+on\s+google|google\s+maps?)\b/i,
      /\b(?:top[\s-]?up|recharge|deposit)\b[^.\n]{0,60}\b(?:withdraw\w*|unlock\w*|commission|earnings|profits?)\b/i,
      /\b(?:withdraw\w*|unlock\w*)\b[^.\n]{0,60}\b(?:top[\s-]?up|recharge)\b/i,
    ]},
  {id: 'secrets', level: 'high', title: 'Asks for an OTP, PIN, CVV or banking password',
    why: 'No employer needs your OTP, UPI PIN, ATM PIN, CVV or net banking password. Anyone who has them can empty your account.',
    tests: [
      /\b(?:share|send|tell|give|provide|forward|read\s+out)\b[^.\n]{0,40}\b(?:otp|one[\s-]time\s+password|upi\s+pin|atm\s+pin|m-?pin|cvv|cvc|card\s+(?:number|details)|net\s*-?banking|bank(?:ing)?\s+(?:password|login))\b/i,
      /\b(?:otp|one[\s-]time\s+password|upi\s+pin|atm\s+pin|cvv)\b[^.\n]{0,40}\b(?:share|send|tell|forward)\b/i,
    ]},
  {id: 'invest', level: 'high', title: 'Turns into an investment or crypto deal',
    why: 'A “job” that asks you to invest, buy USDT or crypto, or join a trading group with guaranteed returns is investment fraud.',
    tests: [
      /\b(?:invest|investment|deposit|buy|purchase|transfer|send)\s+(?:\w+\s+){0,3}(?:usdt|tether|trc-?20)\b/i,
      /\b(?:invest|deposit)\b[^.\n]{0,30}\b(?:crypto(?:currency)?|bitcoin|btc|binance|trust\s*wallet)\b/i,
      new RegExp(`\\b(?:invest|investment)\\s+(?:of\\s+)?(?:only\\s+|just\\s+)?(?:${AMOUNT}|\\$\\s?\\d)`, 'i'),
      /\b(?:guaranteed|assured|fixed|daily|weekly)\s+(?:returns?|profits?)\b|\bdouble\s+(?:your|the)\s+(?:money|investment)\b/i,
    ]},
  {id: 'remote', level: 'high', title: 'Asks you to install a screen-sharing app or an .apk file',
    why: 'Screen-sharing apps such as AnyDesk or TeamViewer, or an app file (.apk) sent over chat, let a scammer see and control your phone, including the OTPs your bank sends.',
    tests: [
      /\b(?:install|download)\b[^.\n]{0,40}\b(?:anydesk|any\s+desk|teamviewer|team\s+viewer|quick\s*support|rustdesk|airdroid)\b/i,
      /\w\.apk\b|\bapk\s+(?:file|link)\b/i,
    ]},
  {id: 'exam-fee', level: 'medium', title: 'An application or exam fee',
    why: 'Government exams and some institutes do charge an application fee, but only on their official website (ending in gov.in or nic.in). Private employers don’t charge one.',
    tests: [/\b(?:application|exam(?:ination)?)\s+(?:fee|fees|charges?)\b/i]},
  {id: 'chat', level: 'medium', title: 'Recruiting over WhatsApp or Telegram',
    why: 'Many recruiters use WhatsApp, but scams almost always stay on chat: no company email, no careers page and no real interview. Check the company through its own website.',
    tests: [
      /\bwa\.me\/|\bt\.me\/|\bchat\.whatsapp\.com\//i,
      /\bwhats\s*app\b[^.\n]{0,30}\b(?:only|number|no|chat|message|contact|ping|hr)\b/i,
      /\b(?:contact|message|ping|text|chat|reach|dm|whatsapp\s+us)\b[^.\n]{0,25}\b(?:on|via|through|over)\s+(?:whats\s*app|telegram)\b/i,
      /\b(?:join|contact|message|dm|ping|add)\b[^.\n]{0,25}\btelegram\b|\btelegram\s+(?:group|channel|id|username|handle)\b/i,
    ]},
  {id: 'guarantee', level: 'medium', title: 'A guaranteed job, or no interview at all',
    why: 'Real jobs involve some selection. A “100% guaranteed” job, or an offer with no interview at all, is a classic hook.',
    tests: [
      /\b(?:no|without(?:\s+any)?)\s+interviews?\b(?!\s+(?:fee|fees|charges?))/i,
      /\b(?:100\s*%|guaranteed|assured)\s+(?:job|placement|selection|joining|offer|income)s?\b|\bjob\s+guarantee\b/i,
      /\bdirect\s+(?:joining|selection|offer\s+letter)\b/i,
    ]},
  {id: 'selected', level: 'medium', title: 'You were “selected” out of the blue',
    why: 'Being told you are selected or shortlisted for a job you don’t remember applying to is a common opening line. Make sure you really applied and interviewed.',
    tests: [
      /\b(?:you\s+(?:are|have\s+been)|you've\s+been|your\s+(?:profile|resume|cv)\s+(?:is|has\s+been))\s+(?:selected|shortlisted|hired|chosen)\b/i,
      /\bcongratulations\b[^.\n]{0,60}\b(?:selected|shortlisted|hired)\b/i,
    ]},
  {id: 'urgent', level: 'medium', title: 'Pressure to act right now',
    why: 'Pressure to pay, register or accept within hours is meant to stop you checking. A real offer gives you time.',
    tests: [
      /\b(?:limited\s+(?:seats|slots)|only\s+(?:\d+\s+)?(?:seats|slots)\s+left|(?:seats|slots)\s+(?:are\s+)?filling\s+fast|hurry\s+(?:up|now)|last\s+chance|act\s+(?:now|fast)|today\s+only|offer\s+(?:valid|expires?)\s+(?:only\s+)?(?:today|tonight))\b/i,
      /\b(?:pay|register|confirm|accept|join|complete|submit|deposit|sign)\b[^.\n]{0,30}\bwithin\s+(?:the\s+next\s+)?(?:\d{1,2}|one|two|three|twenty[\s-]four)\s+(?:hours?|hrs?|minutes?|mins?)\b/i,
    ]},
  {id: 'too-good', level: 'medium', title: 'Easy money that sounds too good',
    why: 'High daily or hourly pay for simple part-time or work-from-home tasks, with no experience needed, is how most task scams begin.',
    test: text => easyMoney(text)},
  {id: 'documents', level: 'medium', title: 'Asks for Aadhaar, PAN or bank details early',
    why: 'Share Aadhaar, PAN or bank details only once you have a verified offer, and only through the company’s own onboarding, never over chat.',
    tests: [/\b(?:send|share|upload|whatsapp|submit|forward)\b[^.\n]{0,40}\b(?:aadha?a?r(?:\s+card)?|pan\s*card|bank\s+(?:details|statement|passbook|account\s+details)|passbook|cancell?ed\s+cheque)\b/i]},
  {id: 'short-link', level: 'medium', title: 'A shortened link',
    why: 'A short link hides where it really goes. Find the company’s careers site yourself instead of following it.',
    tests: [/\b(?:bit\.ly|tinyurl\.com|cutt\.ly|rb\.gy|t\.ly|is\.gd|v\.gd|shorturl\.at|tiny\.cc|goo\.gl|ow\.ly|rebrand\.ly|s\.id|shorte\.st|bl\.ink|surl\.li|short\.gy)\/\S+/i]},
];

// The lowest pay that sounds "too good" for easy work, per period.
const FLOORS = {day: 500, hour: 200, week: 3000, month: 40000};
const EASY = /\b(?:part[\s-]?time|housewi(?:fe|ves)|homemakers?|students?|no\s+experience|zero\s+experience|any\s+qualification|simple\s+tasks?|easy\s+(?:tasks?|work|job)|on\s+your\s+(?:mobile|phone)|\d\s*(?:-|to)\s*\d\s+hours?\s+(?:a|per)\s+day)\b/i;
const PAY = /\b(?:earn(?:ing)?s?|income|payout|salary|make|get\s+paid|paid)\b[^.\n]{0,40}?(?:₹|rs\.?|inr)\s?(\d[\d,]*)(\s*k\b)?(?:\s*(?:-|to|–)\s*(?:₹|rs\.?)?\s?\d[\d,]*\s*k?)?\s*(?:\/-\s*)?(?:(?:per|a|an|\/|every|each)\s*(day|hour|hr|week|month)\b|(daily|weekly|monthly)\b)/gi;
/** "Earn ₹800 a day, part-time, on your phone": an amount per day, hour, week or month, said alongside easy work. */
export function easyMoney(text) {
  const source = String(text);
  if(!EASY.test(source)) return '';
  for(const m of source.matchAll(PAY)) {
    const value = Number(m[1].replace(/,/g, '')) * (m[2] ? 1000 : 1);
    const period = {hr: 'hour', daily: 'day', weekly: 'week', monthly: 'month'}[(m[3] || m[4]).toLowerCase()] || (m[3] || m[4]).toLowerCase();
    if(value >= FLOORS[period]) return m[0].replace(/\s+/g, ' ').trim();
  }
  return '';
}

const quote = (text, index, length) => {
  const start = Math.max(0, index - 24), end = Math.min(text.length, index + length + 24);
  const out = (start ? '…' : '') + text.slice(start, end).replace(/\s+/g, ' ').trim() + (end < text.length ? '…' : '');
  return out.length > 160 ? out.slice(0, 159) + '…' : out;
};
const FEE_IS_EXAM = /\b(?:application|exam(?:ination)?)\s+(?:fee|fees|charges?)\b/i;
// "No registration fee", "we will never ask you to share an OTP": a negation up to three words before a match cancels it.
const NEGATION = /\b(?:no|not|never|without|zero|nil|free\s+of|don['’]?t|doesn['’]?t|won['’]?t|cannot|can['’]?t)\b(?:\s+[^\s.!?]+){0,3}\s*$/i;
const negated = (text, index) => NEGATION.test(text.slice(Math.max(0, index - 60), index).split(/[.!?\n]/).pop());
function firstMatch(text, re) {
  for(const m of text.matchAll(new RegExp(re.source, re.flags + 'g'))) if(!negated(text, m.index)) return m;
  return null;
}

/** The warning signs a text shows, worst first, each with the words that matched; and an overall level. */
export function checkScam(input) {
  const text = String(input ?? '').slice(0, SCAM_MAX);
  if(!text.trim()) return {flags: [], level: null};
  const flags = [];
  for(const rule of RULES) {
    let found = '';
    if(rule.test) found = rule.test(text);
    else for(const re of rule.tests) { const m = firstMatch(text, re); if(m) { found = quote(text, m.index, m[0].length); break; } }
    if(!found) continue;
    // "Pay ₹100 as application fee" is how government exams word it: an exam-fee note, not a scam flag.
    if(rule.id === 'fee' && FEE_IS_EXAM.test(found)) continue;
    if(rule.id === 'exam-fee' && flags.some(f => f.id === 'fee')) continue;
    flags.push({id: rule.id, level: rule.level, title: rule.title, why: rule.why, found});
  }
  // Addresses: a domain that imitates a big company, or a big company's name with a free email address.
  const found = addresses(text);
  const personal = found.filter(a => a.kind === 'email' && PERSONAL_DOMAINS.includes(a.domain));
  const fake = found.map(a => ({...a, brand: imitates(a.domain)})).find(a => a.brand && a.brand.named.test(text));
  const claimed = BRANDS.find(b => b.claims.test(text));
  if(fake) flags.push({id: 'lookalike', level: 'high', title: `An address that imitates ${fake.brand.name}`,
    why: `${fake.domain} uses ${fake.brand.name}’s name, but it isn’t one of ${fake.brand.name}’s own websites (${fake.brand.official.slice(0, 2).join(', ')}). Scammers register lookalike addresses to seem real.`, found: fake.value});
  else if(personal.length && claimed) flags.push({id: 'brand-email', level: 'high', title: `${claimed.name}’s name with a ${personal[0].domain} address`,
    why: `Recruiters at ${claimed.name} write from the company’s own domain (${claimed.official[0]}), not from Gmail, Yahoo or Outlook. A large company’s name with a free email address is a strong sign of impersonation.`, found: personal[0].value});
  else if(personal.length) flags.push({id: 'personal-email', level: 'medium', title: 'A free email address',
    why: 'Real recruiters usually write from a company address. Small firms do use Gmail, so this alone isn’t proof, but check the company yourself before you share anything.', found: personal[0].value});
  flags.sort((a, b) => (a.level === 'high' ? 0 : 1) - (b.level === 'high' ? 0 : 1));
  return {flags, level: flags.some(f => f.level === 'high') ? 'high' : flags.length ? 'some' : 'none'};
}

export const VERDICTS = {
  high: ['High risk', 'This shows signs of a known job scam. Don’t pay anything, and don’t share codes or documents, until you have checked the company yourself.'],
  some: ['Some warning signs', 'Some of this is common in job scams. Check the company and the offer through its official website before you go further.'],
  none: ['No common warning signs found', 'That doesn’t prove the offer is real. Still apply through the employer’s own careers site, and never pay to get a job.'],
};

/** Every warning sign, for the page's list that works without scripts. */
export const SIGNS = [...RULES.map(({id, level, title, why}) => ({id, level, title, why})),
  {id: 'lookalike', level: 'high', title: 'A big company’s name from a free or lookalike address', why: 'Large employers write from their own domain. A Gmail address, or a site like “company-careers-hr.in”, that claims to be them is a strong sign of impersonation.'}];

/** A made-up scam message, for "Try an example". */
export const EXAMPLE = `Congratulations! Your profile has been shortlisted for a Work From Home Data Entry role at Amazon India.
Earn ₹1,500 per day, part-time, on your phone. No interview needed.
Pay a refundable registration fee of ₹499 to confirm your seat within 2 hours. Limited slots!
Contact our HR on WhatsApp only: wa.me/910000000000 or email amazon.hr.jobs@gmail.com`;
