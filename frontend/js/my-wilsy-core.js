import {findSkills, SKILLS, skillSlug, indiaCity} from './skills-core.js';
import {RELATED} from './resume-core.js';
import {degreeLevel, degreeRank} from './job-facts.js';

// My WILSY: compares a person's profile (skills, degree, graduation year, years of experience) with live
// jobs. Pure functions, no network; the page keeps the profile on this device only.

export const PROFILE_KEY = 'wilsy-profile';
export const MAX_SKILLS = 30;
export const DEGREE_OPTIONS = [['', 'Not set'], ['school', '12th / high school'], ['diploma', 'Diploma'], ['bachelor', 'Bachelor’s (B.Tech, BCA, B.Sc…)'],
  ['master', 'Master’s (M.Tech, MCA, MBA…)'], ['phd', 'PhD']];
const DEGREE_NAMES = {school: 'high school certificate', diploma: 'diploma', bachelor: 'bachelor’s degree', master: 'master’s degree', phd: 'PhD'};
const SENIOR = new Set(['senior', 'lead', 'staff', 'principal', 'director']);
const known = new Map(SKILLS.map(([name]) => [name.toLowerCase(), name]));

/** A skill as WILSY names it ("reactjs" → "React"); names WILSY does not know are kept, trimmed. */
export function canonicalSkill(value) {
  const text = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  return known.get(text.toLowerCase()) || findSkills(text)[0] || text;
}

/** A stored profile, cleaned: anything missing or malformed becomes "not set". */
export function readProfile(raw) {
  let data = raw;
  if(typeof raw === 'string') { try { data = JSON.parse(raw); } catch { data = {}; } }
  data = data && typeof data === 'object' ? data : {};
  const skills = [...new Set((Array.isArray(data.skills) ? data.skills : []).map(canonicalSkill).filter(Boolean))].slice(0, MAX_SKILLS);
  const degree = DEGREE_OPTIONS.some(([id]) => id && id === data.degree) ? data.degree : '';
  const gradYear = Number.isInteger(Number(data.gradYear)) && Number(data.gradYear) >= 1980 && Number(data.gradYear) <= 2040 ? Number(data.gradYear) : null;
  const years = data.years === '' || data.years == null || !Number.isFinite(Number(data.years)) ? null : Math.min(40, Math.max(0, Math.round(Number(data.years) * 2) / 2));
  const where = ['any', 'india', 'remote'].includes(data.where) ? data.where : 'any';
  return {skills, degree, gradYear, years, where};
}

const jobSkills = job => [...new Set([...(job.skills || []), ...(job.tech_stack || [])].map(canonicalSkill).filter(Boolean))];
const relatedTo = (skill, mine) => RELATED.find(group => group.includes(skill))?.find(other => other !== skill && mine.has(other)) || '';

/** Which of the job's listed skills the profile has; related skills count half. score is null when the job lists none. */
export function skillMatch(skills, job) {
  const mine = new Set(skills), want = jobSkills(job);
  const matched = want.filter(skill => mine.has(skill));
  const close = want.filter(skill => !mine.has(skill)).map(skill => [skill, relatedTo(skill, mine)]).filter(([, near]) => near);
  const missing = want.filter(skill => !mine.has(skill) && !close.some(([s]) => s === skill));
  return {want, matched, close, missing, score: want.length ? Math.round((matched.length + close.length / 2) / want.length * 100) : null};
}

/** Whether the profile meets what the job states; reasons name each requirement it does not meet. Unknowns never count against you. */
export function eligibility(profile, job) {
  const reasons = [];
  if(profile.years != null && job.experience_min != null && profile.years < Number(job.experience_min)) reasons.push(`Asks for ${Number(job.experience_min)}+ years`);
  const level = degreeLevel(job.education);
  if(profile.degree && level && level !== 'none' && degreeRank(level) > degreeRank(profile.degree) && !/equivalent|relevant experience/i.test(job.education || ''))
    reasons.push(`Asks for a ${DEGREE_NAMES[level]}`);
  if(profile.years != null && profile.years < 3 && job.experience_min == null && SENIOR.has(String(job.seniority_level || '').toLowerCase())) reasons.push('Senior role');
  const grads = (job.graduation_years || []).map(Number);
  if(profile.gradYear && grads.length && !grads.includes(profile.gradYear)) reasons.push(`For ${grads.join(' or ')} graduates`);
  return {ok: !reasons.length, reasons};
}

const isIndia = job => job.country === 'India' || job.country_code === 'IN' || /\bindia\b/i.test(job.location || '') || !!indiaCity(job.location);
export const inPlace = (where, job) => where === 'india' ? isIndia(job) : where === 'remote' ? job.work_mode === 'remote' : true;
const seen = job => Date.parse(job.posted_at || job.first_seen_at || job.discovered_at || '') || 0;

/** Jobs that list at least one of the profile's skills, best first, each with its match and eligibility. */
export function rankJobs(profile, jobs, {onlyEligible = false} = {}) {
  return jobs.filter(job => inPlace(profile.where, job))
    .map(job => ({job, match: skillMatch(profile.skills, job), eligible: eligibility(profile, job)}))
    .filter(r => r.match.matched.length || r.match.close.length)
    .filter(r => !onlyEligible || r.eligible.ok)
    // Most of your skills first, then the larger share of the job's skills, then the newest.
    .sort((a, b) => b.match.matched.length + b.match.close.length / 2 - a.match.matched.length - a.match.close.length / 2
      || b.match.score - a.match.score || seen(b.job) - seen(a.job));
}

/** Skills the profile lacks that the most matching jobs ask for, with how many of those jobs ask. */
export function skillGaps(results, {limit = 8} = {}) {
  const counts = new Map();
  for(const {match} of results) for(const skill of match.missing.concat(match.close.map(([s]) => s))) counts.set(skill, (counts.get(skill) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([skill, jobs]) => ({skill, jobs, slug: skillSlug(skill)}));
}

/** Companies with the most matching jobs, and the skills of yours they ask for most. */
export function companiesHiring(results, {limit = 8} = {}) {
  const byCompany = new Map();
  for(const {job, match} of results) {
    const entry = byCompany.get(job.company) || {company: job.company, slug: job.company_slug || '', jobs: 0, skills: new Map()};
    entry.jobs++;
    for(const skill of match.matched) entry.skills.set(skill, (entry.skills.get(skill) || 0) + 1);
    byCompany.set(job.company, entry);
  }
  return [...byCompany.values()].sort((a, b) => b.jobs - a.jobs || a.company.localeCompare(b.company)).slice(0, limit)
    .map(c => ({...c, skills: [...c.skills].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)}));
}

/** Matching jobs whose employer published a closing date within the next `days` days, soonest first. */
export function closingSoon(results, {now = Date.now(), days = 30} = {}) {
  return results.filter(({job}) => { const t = Date.parse(job.deadline_at || ''); return t > now && t <= now + days * 86_400_000; })
    .sort((a, b) => Date.parse(a.job.deadline_at) - Date.parse(b.job.deadline_at));
}

// Free places to learn each skill: official tutorials and docs, or free courses from the people who make it.
export const LEARN = {
  Python: 'https://docs.python.org/3/tutorial/', Java: 'https://dev.java/learn/', JavaScript: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide',
  TypeScript: 'https://www.typescriptlang.org/docs/handbook/intro.html', Go: 'https://go.dev/tour/', Rust: 'https://doc.rust-lang.org/book/',
  Kotlin: 'https://kotlinlang.org/docs/getting-started.html', Swift: 'https://docs.swift.org/swift-book/', 'C++': 'https://www.learncpp.com/',
  'C#': 'https://learn.microsoft.com/en-us/dotnet/csharp/', '.NET': 'https://learn.microsoft.com/en-us/dotnet/core/introduction', Ruby: 'https://www.ruby-lang.org/en/documentation/quickstart/',
  Rails: 'https://guides.rubyonrails.org/getting_started.html', PHP: 'https://www.php.net/manual/en/tutorial.php', Scala: 'https://docs.scala-lang.org/tour/tour-of-scala.html',
  Elixir: 'https://hexdocs.pm/elixir/introduction.html', Flutter: 'https://docs.flutter.dev/get-started', 'React Native': 'https://reactnative.dev/docs/getting-started',
  React: 'https://react.dev/learn', Vue: 'https://vuejs.org/guide/introduction.html', Angular: 'https://angular.dev/tutorials', 'Next.js': 'https://nextjs.org/learn',
  'Node.js': 'https://nodejs.org/en/learn', Django: 'https://docs.djangoproject.com/en/stable/intro/tutorial01/', Flask: 'https://flask.palletsprojects.com/en/stable/tutorial/',
  FastAPI: 'https://fastapi.tiangolo.com/tutorial/', Spring: 'https://spring.io/guides', GraphQL: 'https://graphql.org/learn/', 'REST APIs': 'https://developer.mozilla.org/en-US/docs/Web/HTTP',
  gRPC: 'https://grpc.io/docs/', HTML: 'https://developer.mozilla.org/en-US/docs/Learn_web_development', CSS: 'https://developer.mozilla.org/en-US/docs/Learn_web_development',
  Tailwind: 'https://tailwindcss.com/docs', SQL: 'https://sqlbolt.com/', PostgreSQL: 'https://www.postgresql.org/docs/current/tutorial.html',
  MySQL: 'https://dev.mysql.com/doc/refman/8.4/en/tutorial.html', MongoDB: 'https://learn.mongodb.com/', Redis: 'https://redis.io/learn',
  BigQuery: 'https://cloud.google.com/bigquery/docs/introduction', Spark: 'https://spark.apache.org/docs/latest/quick-start.html', Kafka: 'https://kafka.apache.org/quickstart',
  Airflow: 'https://airflow.apache.org/docs/apache-airflow/stable/tutorial/index.html', Pandas: 'https://pandas.pydata.org/docs/getting_started/index.html',
  NumPy: 'https://numpy.org/learn/', 'Power BI': 'https://learn.microsoft.com/en-us/training/powerplatform/power-bi', Tableau: 'https://www.tableau.com/learn/training',
  Excel: 'https://support.microsoft.com/en-us/excel', Statistics: 'https://www.khanacademy.org/math/statistics-probability',
  'Machine learning': 'https://developers.google.com/machine-learning/crash-course', 'Deep learning': 'https://d2l.ai/', PyTorch: 'https://pytorch.org/tutorials/',
  TensorFlow: 'https://www.tensorflow.org/tutorials', LLMs: 'https://huggingface.co/learn/llm-course', 'Generative AI': 'https://huggingface.co/learn/llm-course',
  NLP: 'https://huggingface.co/learn/llm-course', RAG: 'https://huggingface.co/learn/llm-course', 'Computer vision': 'https://huggingface.co/learn/computer-vision-course',
  'scikit-learn': 'https://scikit-learn.org/stable/getting_started.html', AWS: 'https://skillbuilder.aws/', GCP: 'https://www.cloudskillsboost.google/',
  Azure: 'https://learn.microsoft.com/en-us/training/azure/', Kubernetes: 'https://kubernetes.io/docs/tutorials/kubernetes-basics/', Docker: 'https://docs.docker.com/get-started/',
  Terraform: 'https://developer.hashicorp.com/terraform/tutorials', 'CI/CD': 'https://docs.github.com/en/actions', Linux: 'https://linuxjourney.com/', Git: 'https://git-scm.com/book/en/v2',
  Microservices: 'https://microservices.io/', 'Distributed systems': 'https://github.com/donnemartin/system-design-primer', iOS: 'https://developer.apple.com/tutorials/swiftui',
  Android: 'https://developer.android.com/courses', Figma: 'https://help.figma.com/hc/en-us', Salesforce: 'https://trailhead.salesforce.com/', HubSpot: 'https://academy.hubspot.com/',
  SEO: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', Agile: 'https://scrumguides.org/', Jira: 'https://university.atlassian.com/',
};
/** Where to learn a skill for free: {url, site}; WILSY's own skill page when there is no listed course. */
export function learnLink(skill) {
  const url = LEARN[skill];
  if(url) return {url, site: new URL(url).hostname.replace(/^www\./, ''), external: true};
  return {url: `/skills/${skillSlug(skill)}`, site: 'WILSY skill page', external: false};
}

/** A four-week plan for the top one to three gaps: learn, build, then show it and apply. */
export function learningPlan(gaps) {
  const [a, b, c] = gaps.map(g => g.skill);
  if(!a) return [];
  const learn = skill => ({skill, link: learnLink(skill)});
  if(c) return [
    {week: 1, title: `Learn the basics of ${a}`, ...learn(a), task: `Work through the first chapters and write small exercises every day.`},
    {week: 2, title: `Learn the basics of ${b}`, ...learn(b), task: `Do the same for ${b}, and note where it meets ${a}.`},
    {week: 3, title: `Learn the basics of ${c}`, ...learn(c), task: `Finish with ${c}, then plan one small project that uses all three.`},
    {week: 4, title: 'Build it and apply', task: `Build the project, put it on GitHub with a short README, add ${a}, ${b} and ${c} to your resume with what you built, and apply to the matching jobs.`}];
  if(b) return [
    {week: 1, title: `Learn the basics of ${a}`, ...learn(a), task: 'Work through the first chapters and write small exercises every day.'},
    {week: 2, title: `Build something with ${a}`, ...learn(a), task: `Build a small project with ${a} and put it on GitHub.`},
    {week: 3, title: `Learn the basics of ${b}`, ...learn(b), task: `Learn ${b} and add it to your project.`},
    {week: 4, title: 'Show it and apply', task: `Add ${a} and ${b} to your resume with what you built, check it with Resume match, and apply to the matching jobs.`}];
  return [
    {week: 1, title: `Learn the basics of ${a}`, ...learn(a), task: 'Work through the first chapters and write small exercises every day.'},
    {week: 2, title: `Practise ${a}`, ...learn(a), task: 'Solve practice problems and read other people’s code.'},
    {week: 3, title: `Build something with ${a}`, task: `Build a small project with ${a} and put it on GitHub with a short README.`},
    {week: 4, title: 'Show it and apply', task: `Add ${a} to your resume with what you built, check it with Resume match, and apply to the matching jobs.`}];
}

/** Skills read from resume text, for "Fill from my resume". */
export const skillsFromText = text => findSkills(text).slice(0, MAX_SKILLS);
