const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

async function tableExists(client, schema, table) {
  const { rows } = await client.query(
    `select 1 from information_schema.tables where table_schema=$1 and table_name=$2 limit 1`,
    [schema, table]
  )
  return rows.length > 0
}

async function columnExists(client, schema, table, column) {
  const { rows } = await client.query(
    `select 1 from information_schema.columns where table_schema=$1 and table_name=$2 and column_name=$3 limit 1`,
    [schema, table, column]
  )
  return rows.length > 0
}

async function runMigrations(client, migrationsDir) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const full = path.join(migrationsDir, file)
    const sql = fs.readFileSync(full, 'utf8')
    console.log(`Applying migration: ${file}`)
    try {
      await client.query(sql)
      console.log(`✔ Applied: ${file}`)
    } catch (err) {
      console.error(`✖ Failed on: ${file}`)
      console.error(err.message || err)
      throw err
    }
  }
}

async function main() {
  const connectionString = process.env.DB_URL
  const applyAll = process.env.APPLY_ALL === '1'
  if (!connectionString) {
    console.error('DB_URL env var is required')
    process.exit(1)
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()

    const billsExists = await tableExists(client, 'public', 'bills')

    if (!billsExists || applyAll) {
      console.log(
        `Bills table exists: ${billsExists}. Running all migrations to sync schema...`
      )
      const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
      await runMigrations(client, migrationsDir)
    }

    // Ensure discount column exists
    const hasDiscount = await columnExists(client, 'public', 'bills', 'discount')
    if (!hasDiscount) {
      await client.query(
        'ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS discount numeric(10,2) NOT NULL DEFAULT 0;'
      )
      console.log('✔ Column discount added to public.bills')
    } else {
      console.log('ℹ Column discount already exists on public.bills')
    }

    // Verify column exists
    const verified = await columnExists(client, 'public', 'bills', 'discount')
    if (verified) {
      console.log('SUCCESS: Column discount is present on public.bills.')
    } else {
      console.warn('WARNING: Column discount not found after operations.')
    }
  } catch (err) {
    console.error('ERROR applying schema/column:', err.message || err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()