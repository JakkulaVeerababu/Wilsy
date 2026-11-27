// Skill and role detection shared by the hiring-trends build (counting what live jobs ask for) and the
// resume match checker (comparing a resume with a job). Plain text in, canonical names out; no network.

// Canonical name, then the spellings that count as it. Ambiguous words (C, R, "go") are left out on purpose.
export const SKILLS = [
  ['Python', ['python']], ['Java', ['java']], ['JavaScript', ['javascript', 'es6']], ['TypeScript', ['typescript']],
  ['Go', ['golang']], ['Rust', ['rust']], ['Kotlin', ['kotlin']], ['Swift', ['swift', 'swiftui']], ['C++', ['c++', 'cpp']],
  ['C#', ['c#']], ['.NET', ['.net', 'asp.net', 'dotnet']], ['Ruby', ['ruby']], ['Rails', ['rails', 'ruby on rails']], ['PHP', ['php']],
  ['Scala', ['scala']], ['Elixir', ['elixir']], ['Flutter', ['flutter']], ['React Native', ['react native']],
  ['React', ['react', 'reactjs', 'react.js']], ['Vue', ['vue', 'vue.js', 'vuejs']], ['Angular', ['angular']],
  ['Next.js', ['next.js', 'nextjs']], ['Node.js', ['node.js', 'nodejs', 'node js']], ['Django', ['django']], ['Flask', ['flask']],
  ['FastAPI', ['fastapi']], ['Spring', ['spring boot', 'spring']], ['GraphQL', ['graphql']], ['REST APIs', ['rest api', 'rest apis', 'restful']],
  ['gRPC', ['grpc']], ['HTML', ['html', 'html5']], ['CSS', ['css', 'css3']], ['Tailwind', ['tailwind', 'tailwindcss']],
  ['SQL', ['sql']], ['PostgreSQL', ['postgresql', 'postgres']], ['MySQL', ['mysql']], ['MongoDB', ['mongodb', 'mongo']],
  ['Redis', ['redis']], ['Elasticsearch', ['elasticsearch']], ['Snowflake', ['snowflake']], ['BigQuery', ['bigquery']],
  ['Spark', ['spark', 'apache spark', 'pyspark']], ['Kafka', ['kafka']], ['Airflow', ['airflow']], ['dbt', ['dbt']],
  ['ETL', ['etl', 'elt']], ['Pandas', ['pandas']], ['NumPy', ['numpy']], ['Tableau', ['tableau']], ['Power BI', ['power bi', 'powerbi']],
  ['Looker', ['looker']], ['Excel', ['excel', 'microsoft excel', 'ms excel', 'advanced excel']], ['Statistics', ['statistics', 'statistical']],
  ['A/B testing', ['a/b testing', 'a/b tests', 'ab testing']], ['Machine learning', ['machine learning', 'ml']],
  ['Deep learning', ['deep learning']], ['PyTorch', ['pytorch']], ['TensorFlow', ['tensorflow']],
  ['LLMs', ['llm', 'llms', 'large language model', 'large language models']], ['Generative AI', ['generative ai', 'genai', 'gen ai']],
  ['NLP', ['nlp', 'natural language processing']], ['Computer vision', ['computer vision']],
  ['RAG', ['rag', 'retrieval augmented generation', 'retrieval-augmented generation']], ['scikit-learn', ['scikit-learn', 'sklearn']],
  ['AWS', ['aws', 'amazon web services']], ['GCP', ['gcp', 'google cloud']], ['Azure', ['azure']],
  ['Kubernetes', ['kubernetes', 'k8s']], ['Docker', ['docker']], ['Terraform', ['terraform']], ['CI/CD', ['ci/cd', 'cicd']],
  ['Linux', ['linux']], ['Git', ['git']], ['Microservices', ['microservices']], ['Distributed systems', ['distributed systems']],
  ['iOS', ['ios']], ['Android', ['android']], ['Cybersecurity', ['cybersecurity', 'cyber security']],
  ['Figma', ['figma']], ['User research', ['user research', 'ux research']], ['Salesforce', ['salesforce']], ['HubSpot', ['hubspot']],
  ['SEO', ['seo']], ['Google Analytics', ['google analytics']], ['Agile', ['agile', 'scrum']], ['Jira', ['jira']],
  ['Financial modelling', ['financial modeling', 'financial modelling', 'financial model']], ['CRM', ['crm']],
];

const canonical = new Map();
for(const [name, aliases] of SKILLS) for(const alias of aliases) canonical.set(alias, name);
const escape = value => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
// Longest spellings first, so "react native" wins over "react" and "spring boot" over "spring".
const pattern = new RegExp(`(?<![a-z0-9])(${[...canonical.keys()].sort((a, b) => b.length - a.length).map(escape).join('|')})(?![a-z0-9+#])`, 'g');
// Words that are skills only in some sentences: "excel at", "rust belt", "spring 2027", "angular momentum".
const notSkill = {excel: /^\s+(?:at|in)\b/, react: /^\s+(?:to|quickly|fast|swiftly)\b/, rust: /^\s+belt\b/, spring: /^\s+(?:20\d\d|semester|term|internship|break)\b/, angular: /^\s+momentum\b/, swift: /^\s+(?:code|message|transfer)/, rag: /^\s*-?\s*tag\b/};

/** The skills a text mentions, as canonical names in vocabulary order. */
export function findSkills(text) {
  const source = String(text || '').toLowerCase().slice(0, 60000), found = new Set();
  for(const match of source.matchAll(pattern)) {
    const alias = match[1], stop = notSkill[alias];
    if(stop && stop.test(source.slice(match.index + alias.length, match.index + alias.length + 24))) continue;
    found.add(canonical.get(alias));
  }
  return SKILLS.map(([name]) => name).filter(name => found.has(name));
}

/**
 * Where each skill shows up: skill name → the first line of the text that names it (trimmed, at most 160
 * characters). Lets the job fit check show the resume line behind each matched skill.
 */
export function skillEvidence(text) {
  const lines = String(text || '').slice(0, 60000).split(/\r?\n|(?<=[.;•])\s+/), found = new Map();
  for(const raw of lines) {
    const line = raw.replace(/^[\s•\-–*·]+/, '').replace(/\s+/g, ' ').trim();
    if(!line) continue;
    for(const skill of findSkills(line)) if(!found.has(skill)) found.set(skill, line.length > 160 ? line.slice(0, 157) + '…' : line);
  }
  return found;
}

// Job families for trends, checked in this order (a "Data Engineer" is Data & AI, a "Sales Engineer" is Sales).
export const ROLE_FAMILIES = [
  ['Data & AI', /\b(?:data|machine learning|ml|ai|analytics|business analyst|scientist|research engineer|mlops)\b/],
  ['Product & programme', /\b(?:product manager|product owner|product lead|program manager|programme manager|project manager|product management)\b/],
  ['Design', /\b(?:designer|design lead|ux|ui|creative director|illustrator)\b/],
  ['Sales & BD', /\b(?:sales|account executive|business development|bdr|sdr|account manager|partnerships?|solutions consultant)\b/],
  ['Marketing', /\b(?:marketing|growth|seo|content|brand|communications|social media|copywriter|community)\b/],
  ['Customer success', /\b(?:support|customer success|customer experience|implementation|onboarding|solutions engineer)\b/],
  ['Finance', /\b(?:finance|financial|accountant|accounting|controller|tax|audit|fp&a|treasury|payroll|investment)\b/],
  ['People & HR', /\b(?:recruit\w*|talent|hr|people|human resources)\b/],
  ['Legal', /\b(?:legal|counsel|compliance|paralegal|attorney|lawyer)\b/],
  ['Engineering', /\b(?:engineer\w*|developer|sde|programmer|devops|sre|architect|qa|tester|firmware|embedded|technician|security)\b/],
  ['Operations', /\b(?:operations|ops|supply chain|logistics|procurement|administrator|assistant|coordinator)\b/],
];
export function roleFamily(title) {
  const t = String(title || '').toLowerCase();
  return ROLE_FAMILIES.find(([, re]) => re.test(t))?.[0] || 'Other';
}

// Indian cities for "where the jobs are", with the spellings employers use.
export const INDIA_CITIES = [
  ['Bengaluru', /\b(?:bengaluru|bangalore)\b/], ['Delhi NCR', /\b(?:delhi|new delhi|gurugram|gurgaon|noida|ncr)\b/],
  ['Mumbai', /\b(?:mumbai|navi mumbai|thane)\b/], ['Hyderabad', /\bhyderabad\b/], ['Pune', /\bpune\b/], ['Chennai', /\bchennai\b/],
  ['Kolkata', /\bkolkata\b/], ['Ahmedabad', /\bahmedabad\b/], ['Kochi', /\b(?:kochi|cochin)\b/], ['Jaipur', /\bjaipur\b/],
];
export function indiaCity(text) {
  const t = String(text || '').toLowerCase();
  return INDIA_CITIES.find(([, re]) => re.test(t))?.[0] || '';
}

// Web addresses for skill pages (/skills/<slug>): readable spellings for names with symbols.
const SKILL_SLUGS = {'C++': 'cpp', 'C#': 'csharp', '.NET': 'dotnet', 'Node.js': 'nodejs', 'Next.js': 'nextjs', 'A/B testing': 'ab-testing', 'CI/CD': 'ci-cd'};
export const skillSlug = name => SKILL_SLUGS[name] || String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
