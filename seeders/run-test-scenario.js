/**
 * Simple runner for AgilaTrack Test Scenario
 * Run with: node server/seeders/run-test-scenario.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import AgilaTrackTestSeeder from './agilatrack-test-scenario.js';

// Load environment variables
dotenv.config();

async function runSeeder() {
  try {
    console.log('🚀 Starting AgilaTrack Test Scenario...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agilatrack';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');
    
    // Run the seeder
    const seeder = new AgilaTrackTestSeeder();
    await seeder.seed();
    
    console.log('\n🎉 Test scenario created successfully!');
    
  } catch (error) {
    console.error('❌ Error running test scenario:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

runSeeder();
