import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { getAdminClient } from '../index.js';

/**
 * Migration script that executes SQL files in packages/db/migrations/ in order
 * Uses service role key to bypass RLS for schema operations
 */
async function migrate() {
  const supabase = getAdminClient();
  const migrationsDir = resolve(process.cwd(), 'packages/db/migrations');

  try {
    console.log('🔍 Reading migrations directory:', migrationsDir);
    
    // Read all SQL files in migrations directory
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter(file => file.endsWith('.sql'))
      .sort(); // Execute in alphabetical/numerical order

    if (sqlFiles.length === 0) {
      console.log('⚠️  No migration files found');
      return;
    }

    console.log(`📦 Found ${sqlFiles.length} migration files:`);
    sqlFiles.forEach(file => console.log(`   - ${file}`));

    // Execute each migration file
    for (const file of sqlFiles) {
      const filePath = join(migrationsDir, file);
      console.log(`\n🚀 Executing migration: ${file}`);
      
      try {
        // Read SQL file content
        const sql = await readFile(filePath, 'utf-8');
        
        // Execute SQL using Supabase admin client
        const { error } = await supabase.rpc('exec_sql', { sql });
        
        if (error) {
          // If exec_sql RPC doesn't exist, try direct SQL execution
          const { error: directError } = await supabase.from('_').select('*').limit(0);
          if (directError?.message?.includes('relation "_" does not exist')) {
            // Use alternative approach - execute via query
            const { error: queryError } = await supabase.rpc('query', { query_text: sql });
            if (queryError) {
              throw queryError;
            }
          } else {
            throw error;
          }
        }
        
        console.log(`✅ Successfully executed: ${file}`);
        
      } catch (migrationError) {
        console.error(`❌ Failed to execute migration ${file}:`, migrationError);
        process.exit(1);
      }
    }

    console.log('\n🎉 All migrations completed successfully!');
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run migrations if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch(console.error);
}

export { migrate };