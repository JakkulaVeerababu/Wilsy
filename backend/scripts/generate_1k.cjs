const fs = require('fs');

// Seed data for Indian Tech Companies
const indPrefixes = ['Tech', 'Info', 'Bharat', 'Data', 'Cloud', 'Cyber', 'Neo', 'Next', 'Hyper', 'Fin', 'Health', 'Edu', 'Agri', 'Smart', 'Vishwa', 'Zeta', 'Omni', 'Aero', 'Quantum', 'Mind', 'Tata', 'Reliance', 'Wipro', 'HCL', 'Tech', 'Innova', 'Veda', 'Niti', 'Maha'];
const indSuffixes = ['Systems', 'Solutions', 'Technologies', 'Labs', 'Software', 'Networks', 'Analytics', 'Consulting', 'Tech', 'Digital', 'Works', 'Hub', 'Space', 'Grid', 'Matrix', 'Dynamics', 'Services', 'Ventures'];
const realIndian = ['TCS', 'Infosys', 'Wipro', 'HCL Technologies', 'Tech Mahindra', 'LTIMindtree', 'Mphasis', 'Zoho', 'Freshworks', 'Razorpay', 'Zerodha', 'Postman', 'BrowserStack', 'Swiggy', 'Zomato', 'Paytm', 'PhonePe', 'Ola', 'Oyo', 'Cred', 'Dream11', 'ShareChat', 'Meesho', 'Unacademy', 'Byjus', 'Upstox', 'Groww', 'Lenskart', 'PolicyBazaar', 'Nykaa', 'Delhivery', 'Udaan', 'Pine Labs', 'BillDesk', 'BharatPe', 'Mindtree', 'Hexaware', 'Cyient', 'Coforge', 'Persistent Systems', 'Tata Elxsi', 'KPIT', 'Birlasoft', 'Zensar'];

// Seed data for Global Tech Companies
const globalPrefixes = ['Global', 'Nexus', 'Apex', 'Vertex', 'Stellar', 'Core', 'Prime', 'Alpha', 'Meta', 'Omni', 'Sync', 'Pulse', 'Astro', 'Nova', 'Pioneer', 'Zenith', 'Frontier', 'Blue', 'Red', 'Green'];
const globalSuffixes = ['Systems', 'Corp', 'Inc', 'LLC', 'Technologies', 'Group', 'Holdings', 'Data', 'Cloud', 'AI', 'Robotics', 'Networks', 'Security', 'Labs'];
const realGlobal = ['Stripe', 'SpaceX', 'Epic Games', 'Canva', 'Discord', 'Plaid', 'Figma', 'Databricks', 'Notion', 'Airtable', 'Scale AI', 'Flexport', 'Rippling', 'Gusto', 'Brex', 'Ramp', 'Vercel', 'Supabase', 'Anthropic', 'OpenAI', 'Midjourney', 'Cohere', 'Stability AI', 'Palantir', 'Snowflake', 'CrowdStrike', 'Cloudflare', 'MongoDB', 'Datadog', 'Okta', 'Twilio', 'Shopify', 'Atlassian', 'Block', 'Coinbase', 'Robinhood'];

function generateNames(count, isIndia) {
    const names = new Set();
    const reals = isIndia ? realIndian : realGlobal;
    const prefixes = isIndia ? indPrefixes : globalPrefixes;
    const suffixes = isIndia ? indSuffixes : globalSuffixes;
    
    // Add real companies first
    for (const name of reals) {
        if (names.size < count) names.add(name);
    }
    
    // Generate the rest
    while (names.size < count) {
        const pre = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suf = suffixes[Math.floor(Math.random() * suffixes.length)];
        const name = `${pre} ${suf}`;
        names.add(name);
    }
    
    return Array.from(names);
}

const indiaCount = 700;
const globalCount = 300;

const newIndianCompanies = generateNames(indiaCount, true);
const newGlobalCompanies = generateNames(globalCount, false);

const allCompanies = [];
let idCounter = 1;

newIndianCompanies.forEach(name => {
    allCompanies.push(`${idCounter}. ${name} - (India)`);
    idCounter++;
});

newGlobalCompanies.forEach(name => {
    allCompanies.push(`${idCounter}. ${name} - (Global)`);
    idCounter++;
});

const path = require('path');
const outPath = path.join(__dirname, '../data/raw/New_1000_Companies.txt');
fs.writeFileSync(outPath, allCompanies.join('\n'));
console.log('Successfully generated New_1000_Companies.txt');
