// clear-railway-tables.js - Clear existing tables and start fresh
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

async function clearTables() {
    const client = new Client(RAILWAY_CONFIG);
    
    try {
        await client.connect();
        console.log('🔄 Connected to Railway database');
        
        // Drop existing tables if they exist
        console.log('🗑️ Dropping existing tables...');
        await client.query('DROP TABLE IF EXISTS teams CASCADE');
        await client.query('DROP TABLE IF EXISTS team_power_ratings CASCADE');
        
        console.log('✅ Tables cleared successfully');
        console.log('Now run: node railway-import.js');
        
    } catch (error) {
        console.error('❌ Error clearing tables:', error.message);
    } finally {
        await client.end();
    }
}

clearTables();