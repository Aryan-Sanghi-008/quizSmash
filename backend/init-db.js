// init-db.js
const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Starting database initialization...');
console.log('📊 Database config:', {
  user: process.env.DB_USER || 'quizuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quizsmash',
  port: process.env.DB_PORT || 5432
});

const pool = new Pool({
  user: process.env.DB_USER || 'quizuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quizsmash',
  password: process.env.DB_PASSWORD || 'quizpass',
  port: process.env.DB_PORT || 5432,
});

async function initDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database');
    
    // Start transaction
    await client.query('BEGIN');
    
    // 1. First, drop all existing tables if they exist
    console.log('🗑️  Cleaning up old tables...');
    try {
      await client.query('DROP TABLE IF EXISTS answers CASCADE');
      console.log('  ✓ Dropped answers table');
      await client.query('DROP TABLE IF EXISTS questions CASCADE');
      console.log('  ✓ Dropped questions table');
      await client.query('DROP TABLE IF EXISTS players CASCADE');
      console.log('  ✓ Dropped players table');
      await client.query('DROP TABLE IF EXISTS rooms CASCADE');
      console.log('  ✓ Dropped rooms table');
    } catch (error) {
      console.log('  ⚠️ Could not drop tables:', error.message);
    }
    
    // 2. Create rooms table (simplified version first)
    console.log('📦 Creating rooms table...');
    await client.query(`
      CREATE TABLE rooms (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10) UNIQUE NOT NULL,
        host_username VARCHAR(50),
        topic VARCHAR(255),
        difficulty VARCHAR(20),
        status VARCHAR(20) DEFAULT 'waiting',
        current_players INTEGER DEFAULT 0,
        max_players INTEGER DEFAULT 4,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
      );
    `);
    console.log('  ✓ Rooms table created');
    
    // 3. Create players table
    console.log('👥 Creating players table...');
    await client.query(`
      CREATE TABLE players (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        username VARCHAR(50) NOT NULL,
        socket_id VARCHAR(255),
        score INTEGER DEFAULT 0,
        is_host BOOLEAN DEFAULT FALSE,
        joined_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ Players table created');
    
    // 4. Create questions table
    console.log('❓ Creating questions table...');
    await client.query(`
      CREATE TABLE questions (
        id SERIAL PRIMARY KEY,
        room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options TEXT[] NOT NULL,
        correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
        round_number INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ Questions table created');
    
    // 5. Create answers table
    console.log('📝 Creating answers table...');
    await client.query(`
      CREATE TABLE answers (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
        selected_index INTEGER NOT NULL CHECK (selected_index >= 0 AND selected_index <= 3),
        is_correct BOOLEAN NOT NULL,
        answered_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('  ✓ Answers table created');
    
    // 6. Create indexes
    console.log('📊 Creating indexes...');
    await client.query('CREATE INDEX idx_rooms_code ON rooms(code);');
    await client.query('CREATE INDEX idx_players_room_id ON players(room_id);');
    await client.query('CREATE INDEX idx_questions_room_id ON questions(room_id);');
    console.log('  ✓ Indexes created');
    
    // 7. Commit transaction
    await client.query('COMMIT');
    
    // 8. Test with sample data
    console.log('🧪 Testing with sample data...');
    const testRoom = await client.query(`
      INSERT INTO rooms (code, host_username, status) 
      VALUES ('TEST123', 'testuser', 'waiting')
      RETURNING *;
    `);
    console.log('  ✓ Created test room:', testRoom.rows[0].code);
    
    const testPlayer = await client.query(`
      INSERT INTO players (room_id, username, socket_id, is_host)
      VALUES ($1, 'testuser', 'test-socket-123', true)
      RETURNING *;
    `, [testRoom.rows[0].id]);
    console.log('  ✓ Created test player:', testPlayer.rows[0].username);
    
    console.log('🎉 Database initialization COMPLETE!');
    console.log('\n📋 Summary of created tables:');
    
    // Show all tables
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    tables.rows.forEach(table => {
      console.log(`  • ${table.tablename}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization FAILED:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run initialization
initDatabase();