const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pnkthqatdlozrojwefnc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBua3RocWF0ZGxvenJvandlZm5jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNjg5MDksImV4cCI6MjEwNDc0NDkwOX0.1mtBJeUfbb0yQEabFooA0Cp6OxCl6e10-dIeoQ35tKc';
const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
    console.log('Reading local data...');
    const rawData = fs.readFileSync(path.join(__dirname, '../../frontend/data/companies.json'), 'utf8');
    const parsed = JSON.parse(rawData);
    const companies = parsed.companies;
    
    console.log(`Found ${companies.length} companies. Formatting for insertion...`);
    
    const rows = companies.map((c, index) => ({
        id: c.id,
        order_idx: index,
        data: c
    }));

    console.log('Inserting into Supabase in batches...');
    
    // Insert in batches of 100 to avoid request size limits
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase
            .from('companies')
            .upsert(batch, { onConflict: 'id' });
            
        if (error) {
            console.error(`Error inserting batch ${i} to ${i + BATCH_SIZE}:`, error);
        } else {
            console.log(`Successfully inserted batch ${i} to ${i + BATCH_SIZE}`);
        }
    }
    
    console.log('Migration complete!');
}

migrate();
