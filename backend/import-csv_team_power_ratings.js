const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const Papa = require('papaparse');
require('dotenv').config({ path: './dataconfig.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    const dbName = process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.split('/').pop().split('?')[0] : 'Unknown';
    console.log(`Connected to PostgreSQL database: ${dbName}`);
    release();
  }
});

class PowerRatingsImporter {
  
  async createTableIfNotExists() {
    console.log('📊 Checking team_power_ratings table...');
    
    try {
      // Check if table exists
      const tableCheck = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'team_power_ratings'
      `);
      
      if (tableCheck.rows.length === 0) {
        console.log('🔨 Creating team_power_ratings table...');
        await pool.query(`
          CREATE TABLE team_power_ratings (
            id SERIAL PRIMARY KEY,
            team_name VARCHAR(255) NOT NULL,
            season INTEGER NOT NULL,
            power_rating DECIMAL(6,3),
            offense_rating DECIMAL(6,3),
            defense_rating DECIMAL(6,3),
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(team_name, season)
          )
        `);
        console.log('✅ Table created successfully');
      } else {
        console.log('✅ Table already exists');
      }
      
      // Show current table structure
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'team_power_ratings'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Current table structure:');
      columnsResult.rows.forEach(col => {
        console.log(`   ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
      });
      
    } catch (error) {
      console.error('❌ Error with table setup:', error);
      throw error;
    }
  }

  async importFromCSV(filePath, season, options = {}) {
    const {
      clearExisting = false,
      dryRun = false,
      teamNameColumn = 'team_name',
      powerRatingColumn = 'power_rating',
      offenseRatingColumn = 'offense_rating',
      defenseRatingColumn = 'defense_rating'
    } = options;
    
    console.log(`📁 Importing power ratings from: ${filePath}`);
    console.log(`🎯 Season: ${season}`);
    console.log(`🔧 Options:`, { clearExisting, dryRun, teamNameColumn, powerRatingColumn });
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Read and parse CSV
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const parseResult = Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });
      
      if (parseResult.errors.length > 0) {
        console.log('⚠️ CSV parsing warnings:');
        parseResult.errors.forEach(error => {
          console.log(`   Row ${error.row}: ${error.message}`);
        });
      }
      
      const data = parseResult.data;
      console.log(`📊 Parsed ${data.length} rows from CSV`);
      
      // Show first few rows for verification
      console.log('\n📋 Sample data (first 3 rows):');
      data.slice(0, 3).forEach((row, index) => {
        console.log(`   Row ${index + 1}:`, JSON.stringify(row, null, 2));
      });
      
      // Validate required columns
      const headers = Object.keys(data[0] || {});
      console.log('\n📝 Available columns:', headers);
      
      const requiredColumns = [teamNameColumn, powerRatingColumn];
      const missingColumns = requiredColumns.filter(col => !headers.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Missing required columns: ${missingColumns.join(', ')}\nAvailable: ${headers.join(', ')}`);
      }
      
      // Clear existing data if requested
      if (clearExisting && !dryRun) {
        console.log(`🧹 Clearing existing power ratings for ${season}...`);
        const deleteResult = await pool.query('DELETE FROM team_power_ratings WHERE season = $1', [season]);
        console.log(`✅ Cleared ${deleteResult.rowCount} existing records`);
      }
      
      // Process and insert data
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const errors = [];
      
      console.log(`\n⚙️ Processing ${data.length} teams...`);
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        
        try {
          // Extract and validate data
          const teamName = row[teamNameColumn];
          const powerRating = parseFloat(row[powerRatingColumn]);
          const offenseRating = row[offenseRatingColumn] ? parseFloat(row[offenseRatingColumn]) : null;
          const defenseRating = row[defenseRatingColumn] ? parseFloat(row[defenseRatingColumn]) : null;
          
          // Check if CSV has a season column and filter by it
          const csvSeason = row.season || row.Season;
          if (csvSeason && parseInt(csvSeason) !== season) {
            skippedCount++;
            if (skippedCount <= 5) {
              console.log(`   ⚠️ Row ${i + 1}: ${teamName} is ${csvSeason} season, filtering for ${season}, skipping`);
            }
            continue;
          }
          
          if (!teamName || teamName.trim() === '') {
            skippedCount++;
            console.log(`   ⚠️ Row ${i + 1}: Missing team name, skipping`);
            continue;
          }
          
          if (isNaN(powerRating)) {
            skippedCount++;
            console.log(`   ⚠️ Row ${i + 1}: Invalid power rating for ${teamName}, skipping`);
            continue;
          }
          
          // Insert or update record
          if (!dryRun) {
            // First try to update existing record
            const updateResult = await pool.query(`
              UPDATE team_power_ratings 
              SET power_rating = $3, offense_rating = $4, defense_rating = $5
              WHERE team_name = $1 AND season = $2
            `, [teamName.trim(), season, powerRating, offenseRating, defenseRating]);
            
            // If no rows were updated, insert new record
            if (updateResult.rowCount === 0) {
              await pool.query(`
                INSERT INTO team_power_ratings (team_name, season, power_rating, offense_rating, defense_rating)
                VALUES ($1, $2, $3, $4, $5)
              `, [teamName.trim(), season, powerRating, offenseRating, defenseRating]);
            }
          }
          
          successCount++;
          
          // Log progress every 50 teams
          if (successCount % 50 === 0) {
            console.log(`   📈 Processed ${successCount} teams...`);
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = `Row ${i + 1} (${row[teamNameColumn] || 'unknown'}): ${error.message}`;
          errors.push(errorMsg);
          
          if (errorCount <= 5) {
            console.log(`   ❌ ${errorMsg}`);
          }
        }
      }
      
      // Summary
      console.log('\n📊 Import Summary:');
      console.log(`   ✅ Successfully processed: ${successCount} teams`);
      console.log(`   ⚠️ Skipped: ${skippedCount} teams`);
      console.log(`   ❌ Errors: ${errorCount} teams`);
      
      if (dryRun) {
        console.log('\n🧪 DRY RUN - No data was actually imported');
      } else {
        console.log(`\n✅ Import completed for ${season} season!`);
      }
      
      // Show errors if any
      if (errors.length > 5) {
        console.log(`\n❌ Additional errors (showing first 5 of ${errors.length}):`);
        errors.slice(0, 5).forEach(error => console.log(`   ${error}`));
      }
      
      // Verify final count
      if (!dryRun) {
        const countResult = await pool.query(
          'SELECT COUNT(*) as total FROM team_power_ratings WHERE season = $1', 
          [season]
        );
        console.log(`\n📈 Total teams in database for ${season}: ${countResult.rows[0].total}`);
        
        // Show some sample results
        const sampleResult = await pool.query(`
          SELECT team_name, power_rating, offense_rating, defense_rating
          FROM team_power_ratings 
          WHERE season = $1 
          ORDER BY power_rating DESC 
          LIMIT 5
        `, [season]);
        
        console.log('\n🏆 Top 5 teams by power rating:');
        sampleResult.rows.forEach((team, index) => {
          console.log(`   ${index + 1}. ${team.team_name}: ${team.power_rating} (O: ${team.offense_rating || 'N/A'}, D: ${team.defense_rating || 'N/A'})`);
        });
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      throw error;
    }
  }

  async showStats(season = null) {
    console.log('📊 Power Ratings Statistics:');
    
    try {
      let query = 'SELECT season, COUNT(*) as team_count FROM team_power_ratings';
      let params = [];
      
      if (season) {
        query += ' WHERE season = $1';
        params = [season];
      }
      
      query += ' GROUP BY season ORDER BY season DESC';
      
      const result = await pool.query(query, params);
      
      if (result.rows.length === 0) {
        console.log('   No power ratings found in database');
        return;
      }
      
      result.rows.forEach(row => {
        console.log(`   ${row.season}: ${row.team_count} teams`);
      });
      
      // Show some sample data for latest season
      const latestSeason = result.rows[0].season;
      const sampleResult = await pool.query(`
        SELECT team_name, power_rating, offense_rating, defense_rating
        FROM team_power_ratings 
        WHERE season = $1 
        ORDER BY power_rating DESC 
        LIMIT 3
      `, [latestSeason]);
      
      console.log(`\n📋 Sample from ${latestSeason} season:`);
      sampleResult.rows.forEach(team => {
        console.log(`   ${team.team_name}: ${team.power_rating} (O: ${team.offense_rating || 'N/A'}, D: ${team.defense_rating || 'N/A'})`);
      });
      
    } catch (error) {
      console.error('❌ Error showing stats:', error);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const importer = new PowerRatingsImporter();
  
  try {
    if (args.includes('--help') || args.length === 0) {
      console.log('📋 Power Ratings CSV Importer Usage:');
      console.log('');
      console.log('Setup:');
      console.log('  node power-ratings-importer.js --setup');
      console.log('');
      console.log('Import from CSV:');
      console.log('  node power-ratings-importer.js --import --file=ratings.csv --season=2024');
      console.log('  node power-ratings-importer.js --import --file=ratings.csv --season=2024 --clear');
      console.log('  node power-ratings-importer.js --import --file=ratings.csv --season=2024 --dry-run');
      console.log('');
      console.log('Custom column mapping:');
      console.log('  --team-col=school --rating-col=overall_rating --offense-col=off_rating --defense-col=def_rating');
      console.log('');
      console.log('View stats:');
      console.log('  node power-ratings-importer.js --stats');
      console.log('  node power-ratings-importer.js --stats --season=2024');
      return;
    }
    
    if (args.includes('--setup')) {
      await importer.createTableIfNotExists();
      return;
    }
    
    if (args.includes('--stats')) {
      const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]);
      await importer.showStats(season);
      return;
    }
    
    if (args.includes('--import')) {
      const filePath = args.find(arg => arg.startsWith('--file='))?.split('=')[1];
      const season = parseInt(args.find(arg => arg.startsWith('--season='))?.split('=')[1]);
      
      if (!filePath) {
        throw new Error('Missing --file parameter');
      }
      
      if (!season) {
        throw new Error('Missing --season parameter');
      }
      
      // Column mapping options
      const teamCol = args.find(arg => arg.startsWith('--team-col='))?.split('=')[1] || 'team_name';
      const ratingCol = args.find(arg => arg.startsWith('--rating-col='))?.split('=')[1] || 'power_rating';
      const offenseCol = args.find(arg => arg.startsWith('--offense-col='))?.split('=')[1] || 'offense_rating';
      const defenseCol = args.find(arg => arg.startsWith('--defense-col='))?.split('=')[1] || 'defense_rating';
      
      const options = {
        clearExisting: args.includes('--clear'),
        dryRun: args.includes('--dry-run'),
        teamNameColumn: teamCol,
        powerRatingColumn: ratingCol,
        offenseRatingColumn: offenseCol,
        defenseRatingColumn: defenseCol
      };
      
      // Ensure table exists first
      await importer.createTableIfNotExists();
      
      // Import the data
      await importer.importFromCSV(filePath, season, options);
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = PowerRatingsImporter;