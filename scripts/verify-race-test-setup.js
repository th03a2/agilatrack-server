/**
 * Verify existing user account and prepare race test data
 * Run with: node server/scripts/verify-race-test-setup.js
 */

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/Users.js';
import Club from '../models/Clubs.js';
import Bird from '../models/Birds.js';
import Race from '../models/Races.js';
import Affiliation from '../models/Affiliations.js';
import Loft from '../models/Lofts.js';

// Load environment variables
dotenv.config();

async function verifyRaceTestSetup() {
  try {
    console.log('🔍 Verifying AgilaTrack Race Test Setup...\n');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/agilatrack';
    await mongoose.connect(mongoUri);
    console.log('📦 Connected to MongoDB');
    
    // 1. Verify existing user account
    console.log('👤 Checking existing user account...');
    let existingUser = await User.findOne({ email: 'technowiz.jerick.reyes@gmail.com' });
    
    if (!existingUser) {
      console.log('❌ User technowiz.jerick.reyes@gmail.com not found');
      console.log('Creating test user account...');
      
      const hashedPassword = await bcrypt.hash('P@ssw0rd', 12);
      const testUser = await User.create({
        email: 'technowiz.jerick.reyes@gmail.com',
        password: hashedPassword,
        name: 'Jerick Reyes',
        role: 'member',
        membershipStatus: 'active',
        profileCompleted: true,
        profile: {
          status: 'approved',
          at: new Date(),
        },
      });
      
      console.log(`✅ Created test user: ${testUser.name} (${testUser.email})`);
      existingUser = testUser;
    } else {
      console.log(`✅ Found existing user: ${existingUser.name} (${existingUser.email})`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Membership Status: ${existingUser.membershipStatus}`);
      console.log(`   Club ID: ${existingUser.clubId || 'None'}`);
    }
    
    // 2. Check for existing clubs
    console.log('\n🏢 Checking existing clubs...');
    const clubs = await Club.find({ deletedAt: { $exists: false } }).limit(5);
    
    if (clubs.length === 0) {
      console.log('❌ No clubs found. Creating test clubs...');
      
      // Create Aliaga Flyers Club
      const aliagaClub = await Club.create({
        name: 'Aliaga Flyers Club',
        code: 'AFC-NE',
        abbr: 'AFC',
        level: 'municipality',
        type: 'club',
        location: {
          region: 'Central Luzon',
          regionCode: '03',
          provinceCode: 'NE',
          province: 'Nueva Ecija',
          municipality: 'Aliaga',
          municipalityCode: 'ALG',
          city: null,
          barangay: null,
        },
        address: {
          hn: '123',
          street: 'P. Burgos Street',
          barangay: 'Poblacion',
          city: 'Aliaga',
          province: 'Nueva Ecija',
          region: 'Central Luzon',
          zip: '3106',
        },
        contact: {
          phone: '+639123456789',
          email: 'contact@aliagaflyers.com',
        },
        description: 'Premier pigeon racing club in Aliaga, Nueva Ecija',
        logo: {
          url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/afc-logo.png',
          publicId: 'afc-logo',
          version: '1',
          updatedAt: new Date(),
        },
      });
      
      console.log(`✅ Created club: ${aliagaClub.name}`);
      clubs.push(aliagaClub);
    } else {
      clubs.forEach(club => {
        console.log(`✅ Found club: ${club.name} (${club.code}) - ${club.level}`);
      });
    }
    
    // 3. Check user affiliation with club
    console.log('\n🔗 Checking user affiliation...');
    const userClub = clubs[0]; // Use first available club
    let affiliation = await Affiliation.findOne({
      user: existingUser._id,
      club: userClub._id,
      deletedAt: { $exists: false }
    });
    
    if (!affiliation) {
      console.log('❌ No affiliation found. Creating affiliation...');
      affiliation = await Affiliation.create({
        user: existingUser._id,
        club: userClub._id,
        role: 'member',
        status: 'approved',
        appliedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: existingUser._id,
        memberCode: `${userClub.abbr}-${String(existingUser._id).slice(-6).toUpperCase()}`,
      });
      
      // Update user with club assignment
      await User.findByIdAndUpdate(existingUser._id, {
        clubId: userClub._id,
        membershipStatus: 'active',
      });
      
      console.log(`✅ Created affiliation: ${existingUser.name} -> ${userClub.name}`);
    } else {
      console.log(`✅ Found affiliation: ${affiliation.status} - ${userClub.name}`);
    }
    
    // 4. Check for existing pigeons
    console.log('\n🐦 Checking existing pigeons...');
    const pigeons = await Bird.find({
      ownerId: existingUser._id,
      deletedAt: { $exists: false }
    });
    
    if (pigeons.length === 0) {
      console.log('❌ No pigeons found. Creating test pigeons...');
      
      const testPigeons = [
        {
          name: 'Thunder Bolt',
          bandNumber: `${userClub.abbr}-2024-001`,
          ringNumber: `${userClub.abbr}-2024-001`,
          color: 'Blue Bar',
          gender: 'cock',
          dateOfBirth: new Date('2024-01-15'),
          ownerId: existingUser._id,
          clubId: userClub._id,
          affiliation: affiliation._id,
          status: 'active',
          registeredAt: new Date(),
        },
        {
          name: 'Lightning Strike',
          bandNumber: `${userClub.abbr}-2024-002`,
          ringNumber: `${userClub.abbr}-2024-002`,
          color: 'Red Check',
          gender: 'hen',
          dateOfBirth: new Date('2024-02-20'),
          ownerId: existingUser._id,
          clubId: userClub._id,
          affiliation: affiliation._id,
          status: 'active',
          registeredAt: new Date(),
        },
      ];
      
      for (const pigeonData of testPigeons) {
        const pigeon = await Bird.create(pigeonData);
        pigeons.push(pigeon);
        console.log(`✅ Created pigeon: ${pigeon.name} (${pigeon.bandNumber})`);
      }
    } else {
      pigeons.forEach(pigeon => {
        console.log(`✅ Found pigeon: ${pigeon.name} (${pigeon.bandNumber})`);
      });
    }
    
    // 5. Check for existing lofts
    console.log('\n🏠 Checking existing lofts...');
    const loft = await Loft.findOne({
      club: userClub._id,
      deletedAt: { $exists: false }
    });
    
    if (!loft) {
      console.log('❌ No loft found. Creating test loft...');
      const testLoft = await Loft.create({
        name: `${existingUser.name}'s Loft`,
        code: `${userClub.abbr}-LOFT-01`,
        club: userClub._id,
        coordinates: {
          latitude: 15.4645,
          longitude: 120.8545,
        },
        address: {
          hn: '123',
          street: 'P. Burgos Street',
          barangay: 'Poblacion',
          city: 'Aliaga',
          province: 'Nueva Ecija',
          region: 'Central Luzon',
          regionCode: '03',
          provinceCode: 'NE',
          municipalityCode: 'ALG',
          zip: '3106',
        },
        status: 'active',
        createdBy: existingUser._id,
      });
      
      console.log(`✅ Created loft: ${testLoft.name}`);
      
      // Update affiliation with primary loft
      await Affiliation.findByIdAndUpdate(affiliation._id, {
        primaryLoft: testLoft._id,
      });
      
      // Update pigeons with loft assignment
      await Bird.updateMany(
        { ownerId: existingUser._id },
        { loft: testLoft._id }
      );
      
    } else {
      console.log(`✅ Found loft: ${loft.name}`);
    }
    
    // 6. Check for existing races
    console.log('\n🏁 Checking existing races...');
    const races = await Race.find({
      club: userClub._id,
      deletedAt: { $exists: false }
    });
    
    if (races.length === 0) {
      console.log('❌ No races found. Creating test race...');
      
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // 7 days from now
      
      const testRace = await Race.create({
        name: 'Aliaga to Cabanatuan Training Race',
        code: `${userClub.abbr}-CBN-TR-2024-001`,
        category: 'training',
        raceType: 'training_toss',
        raceDate: futureDate,
        club: userClub._id,
        clubId: userClub._id,
        createdBy: existingUser._id,
        organizer: existingUser._id,
        status: 'booking_open',
        entryFee: {
          amount: 500,
          currency: 'PHP',
        },
        minimumRacers: 5,
        birdLimit: 50,
        departure: {
          siteName: 'Cabanatuan City Liberation Point',
          coordinates: {
            latitude: 15.4845,
            longitude: 120.9678,
          },
          address: {
            municipality: 'Cabanatuan City',
            province: 'Nueva Ecija',
            region: 'Central Luzon',
          },
        },
        distance: {
          value: 25.5,
          unit: 'kilometers',
        },
        booking: {
          opensAt: new Date(),
          closesAt: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before race
        },
        description: 'Training race from Aliaga to Cabanatuan City for young birds',
      });
      
      console.log(`✅ Created race: ${testRace.name}`);
      races.push(testRace);
    } else {
      races.forEach(race => {
        console.log(`✅ Found race: ${race.name} (${race.status})`);
      });
    }
    
    // Summary
    console.log('\n📊 SETUP SUMMARY:');
    console.log('==================');
    console.log(`👤 User: ${existingUser.name} (${existingUser.email})`);
    console.log(`   Role: ${existingUser.role}`);
    console.log(`   Club: ${userClub.name}`);
    console.log(`🏢 Club: ${userClub.name} (${userClub.code})`);
    console.log(`🔗 Affiliation: ${affiliation.status}`);
    console.log(`🐦 Pigeons: ${pigeons.length} owned`);
    console.log(`🏠 Loft: ${loft ? loft.name : 'None'}`);
    console.log(`🏁 Races: ${races.length} available`);
    
    console.log('\n🎯 READY FOR RACE TEST!');
    console.log('=====================');
    console.log('1. Login as: technowiz.jerick.reyes@gmail.com / P@ssw0rd');
    console.log('2. Navigate to Races section');
    console.log('3. View available races');
    console.log('4. Select pigeons for race entry');
    console.log('5. Submit race entry');
    
  } catch (error) {
    console.error('❌ Setup verification failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected from MongoDB');
  }
}

// Import bcrypt for password hashing
import bcrypt from 'bcryptjs';

// Run verification
verifyRaceTestSetup();
