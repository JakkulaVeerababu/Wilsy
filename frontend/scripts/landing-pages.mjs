// Crawlable job landing pages (/jobs/<slug>) built from the public search filters.
// The public search has no city filter, so pages are by role, career stage, country and workplace.
const roles = [
  ['software-engineering','Software engineering','software engineering'],
  ['backend','Backend','backend developer'],
  ['frontend','Frontend','frontend developer'],
  ['ai-ml','AI / ML','AI and machine learning'],
  ['genai','GenAI','generative AI'],
  ['data','Data','data'],
  ['devops-cloud','DevOps / Cloud','DevOps and cloud'],
  ['cybersecurity','Cybersecurity','cybersecurity'],
  ['embedded','Embedded','embedded systems'],
  ['vlsi','VLSI','VLSI'],
  ['ece-core','ECE core','ECE core engineering'],
];
const cap = text => text.charAt(0).toUpperCase()+text.slice(1);
export const landingPages = [
  ...roles.map(([role,short,noun])=>({slug:`${role}-jobs`,short,filters:{role},title:`${cap(noun)} jobs`,
    description:`Current ${noun} jobs from employers’ own career pages, with location, experience and pay in rupees. Every role links to its source.`})),
  ...roles.slice(0,6).map(([role,short,noun])=>({slug:`${role}-jobs-in-india`,short:`${short} in India`,filters:{role,country:'India'},title:`${cap(noun)} jobs in India`,
    description:`Current ${noun} jobs in India from employers’ own career pages, with experience, workplace and pay in rupees.`})),
  {slug:'internships',short:'Internships',filters:{stage:'internship'},title:'Internships',description:'Current internships from employers’ own career pages, with location, dates and stipend where disclosed.'},
  {slug:'internships-in-india',short:'Internships in India',filters:{stage:'internship',country:'India'},title:'Internships in India',description:'Current internships in India from employers’ own career pages, with location and stipend where disclosed.'},
  {slug:'fresher-jobs',short:'Fresher jobs',filters:{stage:'fresher'},title:'Fresher jobs',description:'Entry-level and fresher jobs from employers’ own career pages, with location and pay in rupees where disclosed.'},
  {slug:'fresher-jobs-in-india',short:'Fresher jobs in India',filters:{stage:'fresher',country:'India'},title:'Fresher jobs in India',description:'Entry-level and fresher jobs in India from employers’ own career pages.'},
  {slug:'new-grad-jobs',short:'New grad',filters:{stage:'new-grad'},title:'New grad jobs',description:'New graduate roles from employers’ own career pages, with location, experience and pay in rupees.'},
  {slug:'remote-jobs',short:'Remote jobs',filters:{mode:'remote'},title:'Remote jobs',description:'Remote jobs from employers’ own career pages. Check each role’s remote-eligibility rules before you apply.'},
  {slug:'jobs-in-india',short:'Jobs in India',filters:{country:'India'},title:'Jobs in India',description:'Current jobs in India from employers’ own career pages, with experience, workplace and pay in rupees.'},
];
export const landingUrl = page => '/jobs/'+page.slug;
export const workspaceUrl = page => '/jobs?'+new URLSearchParams(page.filters).toString();
const bySlug = slug => landingPages.find(page=>page.slug===slug);

// Browse links on the homepage and in the footer.
export const browseRoles = ['software-engineering-jobs','backend-jobs','frontend-jobs','ai-ml-jobs','data-jobs','devops-cloud-jobs','cybersecurity-jobs','embedded-jobs']
  .map(slug=>[landingUrl(bySlug(slug)),bySlug(slug).short]);
export const browseStages = ['internships','fresher-jobs','new-grad-jobs','remote-jobs','jobs-in-india']
  .map(slug=>[landingUrl(bySlug(slug)),bySlug(slug).short]);
