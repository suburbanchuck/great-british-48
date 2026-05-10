import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const geojson = JSON.parse(
  readFileSync(join(process.cwd(), 'public', 'counties.geojson'), 'utf-8')
);

const rows = geojson.features.map((feature: { properties: { NAME: string } }) => {
  const name = feature.properties.NAME;
  const id = name.toLowerCase().replace(/[^a-z0-9 ']/g, '').replace(/[ ']+/g, '-');
  return { id, name };
});

async function main() {
  const { error } = await supabase
    .from('counties')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Upsert failed:', error.message);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} counties.`);
  rows.forEach((r: { id: string; name: string }) => console.log(`  ${r.id} → ${r.name}`));
}

main();
