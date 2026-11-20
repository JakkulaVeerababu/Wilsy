import {escapeHtml as e} from './directory-core.js';

// The typing test: original practice passages, scored the way government typing tests count speed. A word is
// five key depressions (characters, spaces included), so 35 words a minute is 10,500 key depressions an hour.
// SSC's LDC and JSA typing test asks for 35 words a minute in English (30 in Hindi) over 10 minutes; its data
// entry skill test asks for 8,000 key depressions an hour over 15 minutes.

export const DURATIONS = [[1, '1 min'], [2, '2 min'], [5, '5 min'], [10, '10 min · SSC'], [15, '15 min · DEO']];
export const BEST_KEY = 'wilsy-typing-best';
export const SSC_ENGLISH_WPM = 35;
export const DEO_KDPH = 8000;
const KEYS_PER_WORD = 5;

/** Practice passages, written for WILSY. Plain keyboard characters only: no curly quotes or dashes. */
export const PASSAGES = [
  {id: 'first-job', title: 'Starting your first job', text: 'Starting your first job is exciting, and it can also feel a little strange. For years you were judged on marks and exams, and now you are judged on the work you finish and the way you work with others. In the first few weeks, listen more than you speak. Learn the names of the people around you, write down how things are done, and ask questions early instead of guessing. Most managers would rather answer a simple question on Monday than fix a big mistake on Friday. Keep a short note of what you did each day. It will help you in your weekly meetings, and it will help you again when you update your resume at the end of the year. Be on time, reply to messages clearly, and finish what you promise. If you cannot finish something, say so before the deadline, not after it. Small habits like these build trust faster than clever ideas. Finally, look after your health. Sleep well, take short breaks, and leave some time for friends and family. A job is a long journey, and steady effort over many months matters far more than a few late nights.'},
  {id: 'library', title: 'The village library', text: 'In a small village near the river, there was an old library with wooden shelves and a ceiling fan that made a gentle noise all afternoon. Every evening, after school, children came to read stories, finish their homework and borrow books for the weekend. The librarian was a retired teacher who knew the place of every book by heart. She believed that a good library should feel like a second home, so she kept a jar of pencils at the door and a bench under the window for anyone who wanted a quiet place to think. Over the years, many students who studied there went on to work in cities across the country. Some became engineers, some became nurses, and one became a district officer. When they visited the village, they always stopped at the library and left a few new books on the counter. Today the shelves are fuller than ever, and a single computer sits in the corner for students who want to apply for scholarships and jobs online. The fan still makes the same gentle noise, and the bench under the window is still never empty.'},
  {id: 'interview', title: 'Preparing for an interview', text: 'A good interview begins long before you enter the room. Start by reading the job description carefully and listing the skills it asks for. Next to each skill, write one example from your studies, projects or past work that shows you can do it. Then learn about the organisation: what it does, who it serves and what it has done in the last year. Practise your answers aloud, not just in your head, because speaking helps you notice where you are unclear. Keep each answer short and specific, and end with what you achieved or learned. On the day of the interview, reach early, carry copies of your documents and keep your phone on silent. Listen to each question fully before you answer, and it is perfectly fine to take a moment to think. If you do not know something, say so honestly and explain how you would find the answer. At the end, ask one or two thoughtful questions about the team or the work. Whatever the result, note what went well and what you would change next time, because every interview makes the next one easier.'},
  {id: 'monsoon', title: 'Monsoon in the city', text: 'The first rain of the monsoon changes the mood of the whole city. In the morning the sky turns grey, the wind picks up dust from the road, and then, all at once, heavy drops begin to fall. Shopkeepers pull plastic sheets over their goods, children run out to splash in the puddles, and the smell of wet earth fills the air. Office workers who planned to walk to the station suddenly search for an auto, and the queue at the bus stop grows longer by the minute. By afternoon the streets near the market are full of water, and traffic moves slowly in long lines. Yet nobody seems truly upset. Tea stalls are crowded with people waiting for the rain to stop, and strangers share umbrellas and small talk. For farmers outside the city, the same rain brings hope for a good harvest and a better year. In the evening, when the clouds finally break and a cool breeze blows through the open windows, the city feels fresh and calm again, as if it has taken a long and much needed bath.'},
  {id: 'email', title: 'Writing a clear email', text: 'A clear email saves time for everyone who reads it. Start with a subject line that says exactly what the message is about, such as a meeting date, a report or a request for approval. In the first sentence, state the purpose of the email, so the reader knows at once what you need. Keep paragraphs short and put each idea in its own paragraph. If you are asking for something, mention the date by which you need it and explain why the date matters. When you share figures, check them twice, and attach the file instead of pasting large tables into the message. Be polite but direct, and avoid long greetings or vague phrases. Before you press send, read the email once as if you were the receiver. Ask yourself whether the message is easy to understand, whether the tone is friendly, and whether anything important is missing. Also check that you have chosen the right people in the address fields. A careful review of two minutes can prevent a long chain of replies, and over time it builds your reputation as someone who communicates well.'},
  {id: 'train', title: 'A train at night', text: 'There is something special about a long train journey at night. As the train leaves the station, the platform lights slide away and the city slowly gives way to dark fields and small towns. Inside the coach, families unpack dinner wrapped in paper, a group of students plays cards on the lower berth, and an elderly man reads the same page of his newspaper again and again. The tea seller walks through the corridor every hour, calling out in a voice that somehow never gets tired. Around midnight, most passengers climb into their berths and pull thin blankets over their shoulders. The steady sound of the wheels on the tracks works like a lullaby. Now and then the train stops at a quiet station where a single lamp shines over an empty bench. By early morning the sky turns pink, the fields are bright and green, and people begin to fold their sheets and wait for their turn at the small steel basin. When the train finally reaches its destination, everyone steps out a little tired but carrying stories that will last much longer than the trip itself.'},
  {id: 'learning', title: 'Learning a new skill', text: 'Learning a new skill online has never been easier, yet many people start a course with excitement and stop after the first week. The problem is rarely a lack of talent. More often it is a lack of a clear plan. Before you begin, decide why you want to learn the skill and what you want to build with it in three months. Choose one good course instead of five, and set a fixed time for it, such as one hour every weekday morning. Take notes in your own words, and after every lesson, try to use what you learned in a small project of your own. If you are learning to code, build a simple website or a tool that solves a problem in your daily life. If you are learning design, redesign a poster or a screen of an app you use often. Share your work with friends or an online group and ask for honest feedback. When you get stuck, take a short break and then try again with a fresh mind. Progress may feel slow from day to day, but when you look back after a few months, you will be surprised by how far you have come.'},
  {id: 'office', title: 'A day at the district office', text: 'The district office opens at ten in the morning, but the first visitors arrive well before that. Some come to submit forms for certificates, some to ask about the status of an application, and some simply to find out which counter they should go to. Inside, the staff begin by sorting the letters and files that arrived the day before. Each file is entered in a register with a number, a date and the name of the section it belongs to, so that it can be traced later. At the counters, clerks check documents, answer questions and explain what is missing, often repeating the same details many times before lunch. A good clerk stays patient, speaks politely and writes clear notes on every file, because the next person to handle it may be in another building. In the afternoon, officers review the files that are ready, sign the approvals and send back the ones that need more information. By the time the office closes at half past five, hundreds of small tasks have been completed, and many people go home with their work done.'},
];

export const words = text => String(text ?? '').trim().split(/\s+/).filter(Boolean);

/** The text for a test: the chosen passage, then the ones after it, until there is enough for the time. */
export function testText(id, minutes = 1) {
  const start = Math.max(0, PASSAGES.findIndex(p => p.id === id)), need = Math.max(120, Math.round(Number(minutes) || 1) * 120);
  const out = [];
  let count = 0;
  for(let i = 0; count < need && i < PASSAGES.length * 3; i++) {
    const text = PASSAGES[(start + i) % PASSAGES.length].text;
    out.push(text);
    count += words(text).length;
  }
  return out.join(' ');
}

/**
 * Wrong words: the fewest words to change, add or drop to turn what you typed into the start of the passage.
 * A word with any mistake in it counts once.
 */
export function wordErrors(typed, target) {
  const a = Array.isArray(typed) ? typed : words(typed), b = Array.isArray(target) ? target : words(target);
  const n = a.length;
  if(!n) return 0;
  const m = Math.min(b.length, 2 * n);
  let prev = new Uint32Array(m + 1);
  for(let j = 0; j <= m; j++) prev[j] = j;
  for(let i = 1; i <= n; i++) {
    const row = new Uint32Array(m + 1);
    row[0] = i;
    for(let j = 1; j <= m; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  let best = n;
  for(let j = 0; j <= m; j++) best = Math.min(best, prev[j]);
  return best;
}

/** Speed and accuracy. Net speed takes one word a minute off for each wrong word. */
export function typingScore({typed = '', target = '', seconds = 0} = {}) {
  const raw = String(typed), text = raw.trim(), list = words(text), goal = words(target), minutes = Math.max(Number(seconds) || 0, 1) / 60;
  // A word still being typed when time runs out isn't a mistake while it matches so far.
  const last = list[list.length - 1], want = goal[list.length - 1];
  const scored = list.length && !/\s$/.test(raw) && want && last !== want && want.startsWith(last) ? list.slice(0, -1) : list;
  const chars = text.length, errors = wordErrors(scored, goal);
  const gross = chars / KEYS_PER_WORD / minutes, net = Math.round(Math.max(0, gross - errors / minutes));
  const accuracy = scored.length ? Math.max(0, (scored.length - errors) / scored.length) : 0;
  return {seconds: Math.round(minutes * 60), words: list.length, chars, errors, gross: Math.round(gross), net,
    accuracy: Math.round(accuracy * 1000) / 10, kdph: net * KEYS_PER_WORD * 60};
}

/** How a score compares with the speeds SSC's skill tests ask for. */
export const benchmarks = score => [
  {name: 'SSC English typing test (LDC, JSA)', need: `${SSC_ENGLISH_WPM} words a minute`, met: score.net >= SSC_ENGLISH_WPM},
  {name: 'SSC data entry skill test (DEO)', need: `${DEO_KDPH.toLocaleString('en-IN')} key depressions an hour`, met: score.kdph >= DEO_KDPH},
];

/** Live marks while typing: each finished word right or wrong, and whether the word in progress is on track. */
export function liveMarks(typed, target) {
  const text = String(typed ?? ''), list = words(text), done = /\s$/.test(text) ? list.length : Math.max(0, list.length - 1);
  const marks = list.slice(0, done).map((word, i) => word === target[i]);
  const current = list.length > done ? list[done] : '';
  return {marks, index: done, onTrack: !current || String(target[done] ?? '').startsWith(current)};
}

export const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.max(0, seconds % 60)).padStart(2, '0')}`;

/** Personal bests, one per test length, as {minutes: {net, accuracy, at}}. */
export function bestAfter(bests, minutes, score, at = '') {
  const old = bests?.[minutes];
  const better = !old || score.net > old.net || (score.net === old.net && score.accuracy > old.accuracy);
  return {bests: better ? {...bests, [minutes]: {net: score.net, accuracy: score.accuracy, at}} : {...bests}, isBest: better && score.words > 0, previous: old || null};
}

export const shareText = (score, minutes) => `I typed ${score.net} words a minute with ${score.accuracy}% accuracy in the ${minutes}-minute typing test on WILSY. Can you beat it?`;
export const whatsappLink = (text, url) => 'https://wa.me/?text=' + encodeURIComponent(`${text} ${url}`.trim());

/** The result panel. */
export function typingResult(score, {minutes, best = null, isBest = false} = {}) {
  if(!score.words) return '<p class="match-empty">No words typed. Press “Try again” and start typing in the box.</p>';
  const marks = benchmarks(score).map(b => `<li class="${b.met ? 'is-ok' : 'is-tip'}"><span>${b.met ? 'Above' : 'Below'}</span>${e(b.name)}: ${e(b.need)}</li>`).join('');
  return `<div class="calc-headline typing-headline"><div><span>Net speed${isBest ? ' · new best' : ''}</span><strong>${score.net} wpm</strong><small>${score.gross} wpm gross, ${score.errors} wrong word${score.errors === 1 ? '' : 's'} in ${clockText(score.seconds)}</small></div>
    <div><span>Accuracy</span><strong>${score.accuracy}%</strong><small>${score.words} words typed</small></div>
    <div><span>Key depressions an hour</span><strong>${score.kdph.toLocaleString('en-IN')}</strong><small>Net speed × 5 × 60</small></div></div>
  <ul class="rb-check-list typing-bars">${marks}</ul>
  ${best && !isBest ? `<p class="typing-best">Your best for ${minutes} minute${minutes === 1 ? '' : 's'}: <strong>${best.net} wpm</strong> at ${best.accuracy}% accuracy.</p>` : ''}`;
}
const clockText = seconds => seconds >= 60 ? `${Math.floor(seconds / 60)} min${seconds % 60 ? ` ${seconds % 60} s` : ''}` : `${seconds} s`;
