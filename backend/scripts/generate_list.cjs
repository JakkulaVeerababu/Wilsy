const fs = require('fs');
const path = require('path');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../frontend/data/companies.json'), 'utf8'));
const lines = data.companies.map((c, i) => `${i + 1}. ${c.name} - ${c.sector} (${c.location})`);
const outPath = path.join(__dirname, '../data/raw/Wilsy_Company_List.txt');
fs.writeFileSync(outPath, lines.join('\n'));
console.log('Successfully generated Wilsy_Company_List.txt');
