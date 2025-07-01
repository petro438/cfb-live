// check-railway-data.js - Verify what's actually in Railway database
const { Client } = require('pg');

const RAILWAY_CONFIG = {
    host: 'centerbeam.proxy.rlwy.net',
    database: 'railway',
    user: 'postgres',
    password: 'lChnKpnfIjAZGUErUNxxvYUnGtEvgIUz',
    port: 21065,
    ssl: {
        rejectUnauthorized: false
    }
};

async function checkRailwayData() {
    const client = new Client(RAILWAY_CONFIG);
    
    try {
        await client.connect();
        console.log('✅ Connected to Railway database');
        
        // Check what tables exist
        console.log('\n📊 CHECKING TABLES:');
        const tables = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        
        console.log(`Found ${tables.rows.length} tables:`);
        tables.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Check teams table
        if (tables.rows.some(row => row.table_name === 'teams')) {
            console.log('\n📊 TEAMS TABLE:');
            const teamsCount = await client.query('SELECT COUNT(*) FROM teams');
            console.log(`   Total teams: ${teamsCount.rows[0].count}`);
            
            if (teamsCount.rows[0].count > 0) {
                const sampleTeams = await client.query('SELECT school, conference, classification FROM teams LIMIT 5');
                console.log('   Sample teams:');
                sampleTeams.rows.forEach(team => {
                    console.log(`     - ${team.school} (${team.conference}) [${team.classification}]`);
                });
            }
        } else {
            console.log('❌ teams table does not exist');
        }
        
        // Check power ratings table
        if (tables.rows.some(row => row.table_name === 'team_power_ratings')) {
            console.log('\n📊 POWER RATINGS TABLE:');
            const ratingsCount = await client.query('SELECT COUNT(*) FROM team_power_ratings');
            console.log(`   Total ratings: ${ratingsCount.rows[0].count}`);
            
            if (ratingsCount.rows[0].count > 0) {
                const sampleRatings = await client.query('SELECT team_name, power_rating FROM team_power_ratings LIMIT 5');
                console.log('   Sample ratings:');
                sampleRatings.rows.forEach(rating => {
                    console.log(`     - ${rating.team_name}: ${rating.power_rating}`);
                });
            }
        } else {
            console.log('❌ team_power_ratings table does not exist');
        }
        
        // Test the actual query your API uses
        console.log('\n🔍 TESTING API QUERY:');
        try {
            const apiQuery = await client.query(`
                SELECT DISTINCT 
                    t.school, 
                    t.conference, 
                    t.classification,
                    tpr.power_rating
                FROM teams t
                LEFT JOIN team_power_ratings tpr ON t.school = tpr.team_name
                WHERE t.classification = 'fbs'
                LIMIT 5
            `);
            
            console.log(`✅ API query works! Found ${apiQuery.rows.length} FBS teams:`);
            apiQuery.rows.forEach(team => {
                console.log(`     - ${team.school}: Rating ${team.power_rating || 'N/A'}`);
            });
            
        } catch (queryError) {
            console.log('❌ API query failed:', queryError.message);
        }
        
    } catch (error) {
        console.error('❌ Database check failed:', error.message);
    } finally {
        await client.end();
    }
}

checkRailwayData();