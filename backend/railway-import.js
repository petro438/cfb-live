// railway-import.js - Import CFB data to Railway PostgreSQL
const { Client } = require('pg');
require('dotenv').config({ path: './dataconfig.env' });

// Railway connection - CONFIGURED FOR YOUR DATABASE
const RAILWAY_CONFIG = {
    host: 'centerbeam.proxy.rlwy.net',
    database: 'railway',
    user: 'postgres',
    password: 'lChnKpnfIjAZGUErUNxxvYUnGtEvgIUz',
    port: 21065,
    ssl: {
        rejectUnauthorized: false     // Railway requires SSL
    }
};

// Local connection (your existing data)
const LOCAL_CONFIG = {
    host: 'localhost',
    database: 'ScheduleDB',
    user: 'postgres',
    password: 'lunch4kids',
    port: 5432
};

async function importToRailway() {
    const localClient = new Client(LOCAL_CONFIG);
    const railwayClient = new Client(RAILWAY_CONFIG);
    
    try {
        console.log('🔄 Connecting to databases...');
        await localClient.connect();
        await railwayClient.connect();
        
        console.log('✅ Connected to both databases');
        
        // 1. CREATE TABLES ON RAILWAY
        console.log('🏗️ Creating tables on Railway...');
        
        // Create teams table with flexible column sizes
        await railwayClient.query(`
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                school TEXT,
                mascot TEXT,
                abbreviation TEXT,
                conference TEXT,
                division TEXT,
                classification TEXT,
                color TEXT,
                alt_color TEXT,
                logo_url TEXT,
                twitter TEXT,
                location_name TEXT,
                location_city TEXT,
                location_state TEXT,
                location_zip TEXT,
                location_country TEXT,
                location_timezone TEXT,
                location_latitude DECIMAL(10,8),
                location_longitude DECIMAL(11,8),
                location_elevation INTEGER,
                location_capacity INTEGER,
                location_construction_year INTEGER,
                location_grass BOOLEAN,
                location_dome BOOLEAN
            )
        `);
        
        // Create team_power_ratings table with flexible sizing
        await railwayClient.query(`
            CREATE TABLE IF NOT EXISTS team_power_ratings (
                id SERIAL PRIMARY KEY,
                team_name TEXT,
                power_rating DECIMAL(8,4),
                offense_rating DECIMAL(8,4),
                defense_rating DECIMAL(8,4),
                strength_of_schedule DECIMAL(8,4),
                year INTEGER DEFAULT 2025
            )
        `);
        
        console.log('✅ Tables created successfully');
        
        // 2. EXPORT DATA FROM LOCAL
        console.log('📤 Exporting data from local database...');
        
        // Get teams data
        const teamsResult = await localClient.query('SELECT * FROM teams');
        const teams = teamsResult.rows;
        console.log(`📊 Found ${teams.length} teams to import`);
        
        // Get power ratings data
        const ratingsResult = await localClient.query('SELECT * FROM team_power_ratings');
        const ratings = ratingsResult.rows;
        console.log(`📊 Found ${ratings.length} power ratings to import`);
        
        // 3. IMPORT TEAMS TO RAILWAY
        console.log('📥 Importing teams to Railway...');
        
        for (let i = 0; i < teams.length; i++) {
            const team = teams[i];
            
            await railwayClient.query(`
                INSERT INTO teams (
                    school, mascot, abbreviation, conference, division, classification,
                    color, alt_color, logo_url, twitter, location_name, location_city,
                    location_state, location_zip, location_country, location_timezone,
                    location_latitude, location_longitude, location_elevation,
                    location_capacity, location_construction_year, location_grass, location_dome
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
                ON CONFLICT DO NOTHING
            `, [
                team.school, team.mascot, team.abbreviation, team.conference,
                team.division, team.classification, team.color, team.alt_color,
                team.logo_url, team.twitter, team.location_name, team.location_city,
                team.location_state, team.location_zip, team.location_country,
                team.location_timezone, team.location_latitude, team.location_longitude,
                team.location_elevation, team.location_capacity, team.location_construction_year,
                team.location_grass, team.location_dome
            ]);
            
            if (i % 50 === 0) {
                console.log(`   Imported ${i}/${teams.length} teams...`);
            }
        }
        
        console.log(`✅ Imported ${teams.length} teams`);
        
        // 4. IMPORT POWER RATINGS TO RAILWAY
        console.log('📥 Importing power ratings to Railway...');
        
        for (let i = 0; i < ratings.length; i++) {
            const rating = ratings[i];
            
            await railwayClient.query(`
                INSERT INTO team_power_ratings (
                    team_name, power_rating, offense_rating, defense_rating, 
                    strength_of_schedule, year
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
            `, [
                rating.team_name, rating.power_rating, rating.offense_rating,
                rating.defense_rating, rating.strength_of_schedule, rating.year || 2025
            ]);
            
            if (i % 10 === 0) {
                console.log(`   Imported ${i}/${ratings.length} power ratings...`);
            }
        }
        
        console.log(`✅ Imported ${ratings.length} power ratings`);
        
        // 5. VERIFY IMPORT
        console.log('🔍 Verifying import...');
        
        const railwayTeamsCount = await railwayClient.query('SELECT COUNT(*) FROM teams');
        const railwayRatingsCount = await railwayClient.query('SELECT COUNT(*) FROM team_power_ratings');
        
        console.log(`📊 Railway Database Status:`);
        console.log(`   Teams: ${railwayTeamsCount.rows[0].count}`);
        console.log(`   Power Ratings: ${railwayRatingsCount.rows[0].count}`);
        
        // Test a sample query
        const sampleTeam = await railwayClient.query(`
            SELECT t.school, t.conference, tpr.power_rating
            FROM teams t
            LEFT JOIN team_power_ratings tpr ON t.school = tpr.team_name
            WHERE t.classification = 'fbs'
            LIMIT 5
        `);
        
        console.log('\n🎯 Sample joined data:');
        sampleTeam.rows.forEach(row => {
            console.log(`   ${row.school} (${row.conference}) - Rating: ${row.power_rating || 'N/A'}`);
        });
        
        console.log('\n🎉 Import completed successfully!');
        console.log('Your Railway database now has all your CFB data.');
        console.log('Your website should work now!');
        
    } catch (error) {
        console.error('❌ Import failed:', error);
        console.error('\nTroubleshooting:');
        console.error('1. Check your Railway connection details');
        console.error('2. Make sure your local database is running');
        console.error('3. Verify your dataconfig.env file');
    } finally {
        await localClient.end();
        await railwayClient.end();
        console.log('🔌 Database connections closed');
    }
}

// Run the import
console.log('🚀 Starting CFB data import to Railway...');
console.log('');
console.log('⚠️  BEFORE RUNNING:');
console.log('1. Update RAILWAY_CONFIG with your Railway database details');
console.log('2. Get connection details from Railway dashboard → PostgreSQL → Connect');
console.log('');

importToRailway();