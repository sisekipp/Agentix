#!/usr/bin/env node

const { execSync } = require('child_process');
const { Client } = require('pg');

async function waitForDatabase(maxAttempts = 30) {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/agentix';

  console.log('🔍 Checking database connection...');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const client = new Client({ connectionString });
      await client.connect();
      await client.end();
      console.log('✅ Database connection established!');
      return true;
    } catch (error) {
      if (attempt === maxAttempts) {
        console.error('❌ Could not connect to database after', maxAttempts, 'attempts');
        console.error('💡 Make sure PostgreSQL is running: docker-compose -f docker-compose.dev.yml up -d');
        process.exit(1);
      }
      process.stdout.write(`⏳ Waiting for database... (${attempt}/${maxAttempts})\r`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function pushSchema() {
  console.log('📊 Pushing database schema...');
  try {
    execSync('npm run db:push', { stdio: 'inherit' });
    console.log('✅ Database schema updated!');
  } catch (error) {
    console.error('❌ Failed to push database schema');
    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Starting development setup...\n');
  await waitForDatabase();
  await pushSchema();
  console.log('\n🎉 Development setup complete!\n');
}

main().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
