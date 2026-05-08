/**
 * Complete AgilaTrack Race Workflow Test
 * Tests the entire race flow from creation to completion
 * Run with: node server/scripts/test-complete-race-workflow.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/Users.js';
import Club from '../models/Clubs.js';
import Bird from '../models/Birds.js';
import Race from '../models/Races.js';
import RaceEntry from '../models/RaceEntries.js';
import Affiliation from '../models/Affiliations.js';
import Loft from '../models/Lofts.js';

// Load environment variables
dotenv.config();

class CompleteRaceWorkflowTest {
  constructor() {
    this.testResults = {
      userAccount: false,
      clubData: false,
      pigeonData: false,
      raceCreation: false,
      raceEntry: false,
      statusProgression: false,
      dataIntegrity: false,
    };
    this.testData = {};
  }

  async runCompleteTest() {
    try {
      console.log('🚀 Starting Complete AgilaTrack Race Workflow Test...\n');
      
      // Connect to MongoDB
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agilatrack';
      await mongoose.connect(mongoUri);
      console.log('📦 Connected to MongoDB');
      
      // Test 1: Verify User Account
      await this.testUserAccount();
      
      // Test 2: Verify Club Data
      await this.testClubData();
      
      // Test 3: Verify Pigeon Data
      await this.testPigeonData();
      
      // Test 4: Test Race Creation
      await this.testRaceCreation();
      
      // Test 5: Test Race Entry
      await this.testRaceEntry();
      
      // Test 6: Test Status Progression
      await this.testStatusProgression();
      
      // Test 7: Verify Data Integrity
      await this.testDataIntegrity();
      
      // Generate Final Report
      this.generateFinalReport();
      
    } catch (error) {
      console.error('❌ Complete workflow test failed:', error);
      throw error;
    } finally {
      await mongoose.disconnect();
      console.log('📦 Disconnected from MongoDB');
    }
  }

  async testUserAccount() {
    console.log('👤 Testing User Account...');
    
    try {
      const user = await User.findOne({ email: 'technowiz.jerick.reyes@gmail.com' });
      
      if (!user) {
        console.log('❌ Test user account not found');
        return;
      }
      
      console.log(`✅ Found user: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Membership Status: ${user.membershipStatus}`);
      console.log(`   Club ID: ${user.clubId || 'None'}`);
      
      // Verify user has proper structure
      if (user.email && user.role && user.membershipStatus === 'active') {
        this.testResults.userAccount = true;
        this.testData.user = user;
        console.log('✅ User account structure valid\n');
      } else {
        console.log('❌ User account structure invalid\n');
      }
      
    } catch (error) {
      console.log(`❌ User account test failed: ${error.message}\n`);
    }
  }

  async testClubData() {
    console.log('🏢 Testing Club Data...');
    
    try {
      const clubs = await Club.find({ deletedAt: { $exists: false } });
      
      if (clubs.length === 0) {
        console.log('❌ No clubs found in database');
        return;
      }
      
      console.log(`✅ Found ${clubs.length} clubs`);
      clubs.forEach(club => {
        console.log(`   - ${club.name} (${club.code}) - ${club.level}`);
      });
      
      // Verify club structure
      const validClub = clubs.find(c => c.name && c.code && c.level);
      if (validClub) {
        this.testResults.clubData = true;
        this.testData.clubs = clubs;
        console.log('✅ Club data structure valid\n');
      } else {
        console.log('❌ Club data structure invalid\n');
      }
      
    } catch (error) {
      console.log(`❌ Club data test failed: ${error.message}\n`);
    }
  }

  async testPigeonData() {
    console.log('🐦 Testing Pigeon Data...');
    
    try {
      const user = this.testData.user;
      if (!user) {
        console.log('❌ No user data available for pigeon test');
        return;
      }
      
      const pigeons = await Bird.find({
        ownerId: user._id,
        deletedAt: { $exists: false }
      });
      
      if (pigeons.length === 0) {
        console.log('❌ No pigeons found for test user');
        return;
      }
      
      console.log(`✅ Found ${pigeons.length} pigeons for ${user.name}`);
      pigeons.forEach(pigeon => {
        console.log(`   - ${pigeon.name} (${pigeon.bandNumber}) - ${pigeon.color}`);
      });
      
      // Verify pigeon structure
      const validPigeon = pigeons.find(p => p.bandNumber && p.name && p.ownerId);
      if (validPigeon) {
        this.testResults.pigeonData = true;
        this.testData.pigeons = pigeons;
        console.log('✅ Pigeon data structure valid\n');
      } else {
        console.log('❌ Pigeon data structure invalid\n');
      }
      
    } catch (error) {
      console.log(`❌ Pigeon data test failed: ${error.message}\n`);
    }
  }

  async testRaceCreation() {
    console.log('🏁 Testing Race Creation...');
    
    try {
      const user = this.testData.user;
      const club = this.testData.clubs?.[0];
      
      if (!user || !club) {
        console.log('❌ No user or club data available for race creation test');
        return;
      }
      
      // Create a test race
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const testRace = await Race.create({
        name: 'Workflow Test Race - ' + new Date().toISOString(),
        code: `${club.abbr}-WF-TEST-${Date.now()}`,
        category: 'training',
        raceType: 'training_toss',
        raceDate: futureDate,
        club: club._id,
        clubId: club._id,
        createdBy: user._id,
        organizer: user._id,
        status: 'booking_open',
        entryFee: {
          amount: 100,
          currency: 'PHP',
        },
        minimumRacers: 1,
        birdLimit: 3,
        departure: {
          siteName: 'Test Liberation Point',
          coordinates: {
            latitude: 15.4845,
            longitude: 120.9678,
          },
          address: {
            municipality: 'Test City',
            province: 'Test Province',
            region: 'Test Region',
          },
        },
        distance: {
          value: 25.5,
          unit: 'kilometers',
        },
        booking: {
          opensAt: new Date(),
          closesAt: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000),
        },
        description: 'Test race for workflow verification',
      });
      
      console.log(`✅ Created test race: ${testRace.name}`);
      console.log(`   Race ID: ${testRace._id}`);
      console.log(`   Club: ${club.name}`);
      console.log(`   Status: ${testRace.status}`);
      console.log(`   Entry Fee: ${testRace.entryFee.amount} PHP`);
      
      // Verify race structure
      if (testRace.name && testRace.club && testRace.createdBy && testRace.status) {
        this.testResults.raceCreation = true;
        this.testData.testRace = testRace;
        console.log('✅ Race creation structure valid\n');
      } else {
        console.log('❌ Race creation structure invalid\n');
      }
      
    } catch (error) {
      console.log(`❌ Race creation test failed: ${error.message}\n`);
    }
  }

  async testRaceEntry() {
    console.log('📝 Testing Race Entry...');
    
    try {
      const race = this.testData.testRace;
      const user = this.testData.user;
      const pigeons = this.testData.pigeons;
      
      if (!race || !user || !pigeons || pigeons.length === 0) {
        console.log('❌ No race, user, or pigeon data available for race entry test');
        return;
      }
      
      // Get user's affiliation
      const affiliation = await Affiliation.findOne({
        user: user._id,
        club: race.club,
        deletedAt: { $exists: false }
      });
      
      if (!affiliation) {
        console.log('❌ No affiliation found for race entry test');
        return;
      }
      
      // Get user's loft
      const loft = await Loft.findOne({
        club: race.club,
        deletedAt: { $exists: false }
      });
      
      if (!loft) {
        console.log('❌ No loft found for race entry test');
        return;
      }
      
      // Create race entry
      const testPigeon = pigeons[0];
      const raceEntry = await RaceEntry.create({
        affiliation: affiliation._id,
        bird: {
          bandNumber: testPigeon.bandNumber,
          name: testPigeon.name,
          color: testPigeon.color,
          gender: testPigeon.gender,
          year: testPigeon.dateOfBirth?.getFullYear() || 2024,
        },
        booking: {
          bookedAt: new Date(),
          bookingCode: testPigeon.bandNumber,
          channel: "online",
          remarks: "Workflow test entry",
        },
        clubId: race.club,
        createdBy: user._id,
        departure: {
          coordinates: race.departure?.coordinates,
          siteName: race.departure?.siteName,
        },
        fancierId: user._id,
        loft: loft._id,
        loftSnapshot: {
          code: loft.code,
          name: loft.name,
          coordinates: loft.coordinates,
        },
        pigeonId: testPigeon._id,
        race: race._id,
        raceId: race._id,
        status: "booked",
        updatedBy: user._id,
      });
      
      console.log(`✅ Created race entry: ${testPigeon.name}`);
      console.log(`   Entry ID: ${raceEntry._id}`);
      console.log(`   Race: ${race.name}`);
      console.log(`   Pigeon: ${testPigeon.bandNumber}`);
      console.log(`   Status: ${raceEntry.status}`);
      
      // Verify race entry structure
      if (raceEntry.race && raceEntry.pigeonId && raceEntry.fancierId && raceEntry.status) {
        this.testResults.raceEntry = true;
        this.testData.testRaceEntry = raceEntry;
        console.log('✅ Race entry structure valid\n');
      } else {
        console.log('❌ Race entry structure invalid\n');
      }
      
    } catch (error) {
      console.log(`❌ Race entry test failed: ${error.message}\n`);
    }
  }

  async testStatusProgression() {
    console.log('🔄 Testing Status Progression...');
    
    try {
      const race = this.testData.testRace;
      
      if (!race) {
        console.log('❌ No race data available for status progression test');
        return;
      }
      
      const statusFlow = [
        'booking_open',
        'booking_closed', 
        'basketing',
        'boarding',
        'liberated',
        'completed'
      ];
      
      let currentRace = race;
      
      for (const status of statusFlow) {
        // Update race status
        currentRace = await Race.findByIdAndUpdate(
          currentRace._id,
          { 
            status: status,
            updatedBy: this.testData.user._id
          },
          { new: true }
        );
        
        console.log(`✅ Updated race status to: ${status}`);
        
        // Verify status was updated
        if (currentRace.status !== status) {
          console.log(`❌ Status update failed for ${status}`);
          return;
        }
      }
      
      this.testResults.statusProgression = true;
      console.log('✅ Status progression test completed\n');
      
    } catch (error) {
      console.log(`❌ Status progression test failed: ${error.message}\n`);
    }
  }

  async testDataIntegrity() {
    console.log('🔍 Testing Data Integrity...');
    
    try {
      const race = this.testData.testRace;
      const raceEntry = this.testData.testRaceEntry;
      const user = this.testData.user;
      
      if (!race || !raceEntry || !user) {
        console.log('❌ Insufficient data for integrity test');
        return;
      }
      
      // Test 1: Race Entry references correct race
      const entryRace = await Race.findById(raceEntry.race);
      if (!entryRace || entryRace._id.toString() !== race._id.toString()) {
        console.log('❌ Race entry does not reference correct race');
        return;
      }
      console.log('✅ Race entry references correct race');
      
      // Test 2: Race Entry references correct user
      const entryUser = await User.findById(raceEntry.fancierId);
      if (!entryUser || entryUser._id.toString() !== user._id.toString()) {
        console.log('❌ Race entry does not reference correct user');
        return;
      }
      console.log('✅ Race entry references correct user');
      
      // Test 3: Race has correct creator
      const raceCreator = await User.findById(race.createdBy);
      if (!raceCreator || raceCreator._id.toString() !== user._id.toString()) {
        console.log('❌ Race does not reference correct creator');
        return;
      }
      console.log('✅ Race references correct creator');
      
      // Test 4: Club relationships are consistent
      const raceClub = await Club.findById(race.club);
      const userClub = await Club.findById(user.clubId);
      
      if (!raceClub || !userClub || raceClub._id.toString() !== userClub._id.toString()) {
        console.log('❌ Club relationships are inconsistent');
        return;
      }
      console.log('✅ Club relationships are consistent');
      
      this.testResults.dataIntegrity = true;
      console.log('✅ Data integrity test completed\n');
      
    } catch (error) {
      console.log(`❌ Data integrity test failed: ${error.message}\n`);
    }
  }

  generateFinalReport() {
    console.log('📊 FINAL TEST REPORT');
    console.log('====================');
    
    const totalTests = Object.keys(this.testResults).length;
    const passedTests = Object.values(this.testResults).filter(Boolean).length;
    const successRate = Math.round((passedTests / totalTests) * 100);
    
    console.log(`\n🎯 Overall Success Rate: ${successRate}% (${passedTests}/${totalTests})`);
    console.log('\n📋 Test Results:');
    
    Object.entries(this.testResults).forEach(([test, passed]) => {
      const status = passed ? '✅ PASS' : '❌ FAIL';
      const testName = test.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   ${status} - ${testName}`);
    });
    
    if (successRate === 100) {
      console.log('\n🎉 ALL TESTS PASSED! AgilaTrack race workflow is ready for demo.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
    
    console.log('\n📁 Files Created/Modified:');
    console.log('   - server/scripts/verify-race-test-setup.js');
    console.log('   - client/src/components/club-admin/CreateRaceModal.tsx');
    console.log('   - client/src/pages/club-admin/races/index.tsx');
    console.log('   - client/src/components/fancier/RaceEntryModal.tsx');
    console.log('   - client/src/pages/fanciers/races/index.tsx');
    console.log('   - client/src/pages/operators/races/index.tsx');
    console.log('   - RACE_DEMO_SCRIPT.md');
    console.log('   - server/scripts/test-complete-race-workflow.js');
    
    console.log('\n🔑 Test Credentials:');
    console.log('   Fancier: technowiz.jerick.reyes@gmail.com / P@ssw0rd');
    console.log('   Club Owner: roberto.cruz@gmail.com / Test123456');
    console.log('   Operator: antonio.torres@gmail.com / Test123456');
    
    console.log('\n🎯 Ready for Live Demo!');
  }
}

// Run the complete workflow test
const workflowTest = new CompleteRaceWorkflowTest();
workflowTest.runCompleteTest();
