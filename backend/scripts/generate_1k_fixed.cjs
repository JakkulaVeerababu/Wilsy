const fs = require('fs');

const indPrefixes = ['Tech', 'Info', 'Bharat', 'Data', 'Cloud', 'Cyber', 'Neo', 'Next', 'Hyper', 'Fin', 'Health', 'Edu', 'Agri', 'Smart', 'Vishwa', 'Zeta', 'Omni', 'Aero', 'Quantum', 'Mind', 'Tata', 'Reliance', 'Wipro', 'HCL', 'Tech', 'Innova', 'Veda', 'Niti', 'Maha', 'Alpha', 'Beta', 'Gamma', 'Code', 'Dev', 'Stack', 'Core', 'Logic', 'Vision', 'Future', 'Apex'];
const indSuffixes = ['Systems', 'Solutions', 'Technologies', 'Labs', 'Software', 'Networks', 'Analytics', 'Consulting', 'Tech', 'Digital', 'Works', 'Hub', 'Space', 'Grid', 'Matrix', 'Dynamics', 'Services', 'Ventures', 'Innovations', 'Corp', 'Group', 'Studios', 'Enterprises'];

const realIndian = ['TCS', 'Infosys', 'Wipro', 'HCL Technologies', 'Tech Mahindra', 'LTIMindtree', 'Mphasis', 'Zoho', 'Freshworks', 'Razorpay', 'Zerodha', 'Postman', 'BrowserStack', 'Swiggy', 'Zomato', 'Paytm', 'PhonePe', 'Ola', 'Oyo', 'Cred', 'Dream11', 'ShareChat', 'Meesho', 'Unacademy', 'Byjus', 'Upstox', 'Groww', 'Lenskart', 'PolicyBazaar', 'Nykaa', 'Delhivery', 'Udaan', 'Pine Labs', 'BillDesk', 'BharatPe', 'Mindtree', 'Hexaware', 'Cyient', 'Coforge', 'Persistent Systems', 'Tata Elxsi', 'KPIT', 'Birlasoft', 'Zensar'];

const globalPrefixes = ['Global', 'Nexus', 'Apex', 'Vertex', 'Stellar', 'Core', 'Prime', 'Alpha', 'Meta', 'Omni', 'Sync', 'Pulse', 'Astro', 'Nova', 'Pioneer', 'Zenith', 'Frontier', 'Blue', 'Red', 'Green', 'Silver', 'Gold', 'Titan', 'Iron', 'Byte', 'Tera', 'Giga', 'Nano', 'Peta', 'Exa'];
const globalSuffixes = ['Systems', 'Corp', 'Inc', 'LLC', 'Technologies', 'Group', 'Holdings', 'Data', 'Cloud', 'AI', 'Robotics', 'Networks', 'Security', 'Labs', 'Dynamics', 'Works', 'Ventures', 'Capital'];
const realGlobal = ['Stripe', 'SpaceX', 'Epic Games', 'Canva', 'Discord', 'Plaid', 'Figma', 'Databricks', 'Notion', 'Airtable', 'Scale AI', 'Flexport', 'Rippling', 'Gusto', 'Brex', 'Ramp', 'Vercel', 'Supabase', 'Anthropic', 'OpenAI', 'Midjourney', 'Cohere', 'Stability AI', 'Palantir', 'Snowflake', 'CrowdStrike', 'Cloudflare', 'MongoDB', 'Datadog', 'Okta', 'Twilio', 'Shopify', 'Atlassian', 'Block', 'Coinbase', 'Robinhood'];

const path = require('path');
const dataDir = path.join(__dirname, '../data/raw');

const allExistingLines = [];
allExistingLines.push(...fs.readFileSync(path.join(dataDir, 'New_1000_Companies.txt'), 'utf8').split('\n'));
for (let i = 2; i <= 9; i++) {
    try {
        const lines = fs.readFileSync(path.join(dataDir, `New_1000_Companies_Batch${i}.txt`), 'utf8').split('\n');
        allExistingLines.push(...lines);
    } catch (err) {
        // file might not exist, ignore
    }
}
const existingNames = new Set(allExistingLines.map(line => line.split('. ')[1]?.split(' - ')[0]).filter(Boolean));

function generateNames(count, isIndia) {
    const names = new Set();
    const reals = isIndia ? realIndian : realGlobal;
    const prefixes = isIndia ? indPrefixes : globalPrefixes;
    const suffixes = isIndia ? indSuffixes : globalSuffixes;
    
    for (const name of reals) {
        if (names.size < count && !existingNames.has(name)) names.add(name);
    }
    
    let attempts = 0;
    while (names.size < count && attempts < 100000) {
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
        
        // Add random digits to guarantee uniqueness if combinations exhaust
        let name = `${pre} ${suf}`;
        if (attempts > 5000) {
           name += ` ${Math.floor(Math.random() * 1000)}`;
        }
        if (!existingNames.has(name)) {
            names.add(name);
        }
        attempts++;
    }
    
    return Array.from(names);
}

const newIndianCompanies = generateNames(700, true);
const newGlobalCompanies = generateNames(300, false);

const allCompanies = [];
let idCounter = 9001;

newIndianCompanies.forEach(name => {
    allCompanies.push(`${idCounter}. ${name} - (India)`);
    idCounter++;
});

newGlobalCompanies.forEach(name => {
    allCompanies.push(`${idCounter}. ${name} - (Global)`);
    idCounter++;
});

fs.writeFileSync(path.join(dataDir, 'New_1000_Companies_Batch10.txt'), allCompanies.join('\n'));
console.log('Successfully generated New_1000_Companies_Batch10.txt');
