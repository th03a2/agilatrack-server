/**
 * AgilaTrack Realistic Race Testing Scenario Seeder
 * 
 * This seeder creates:
 * - Realistic Philippine clubs with unique logos
 * - Test accounts for all roles (Guest, Fancier, Club Owner, Operator)
 * - Sample pigeons and race data
 * - Proper role-based permissions and relationships
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Club from '../models/Clubs.js';
import User from '../models/Users.js';
import Bird from '../models/Birds.js';
import Race from '../models/Races.js';
import RaceEntry from '../models/RaceEntries.js';
import Affiliation from '../models/Affiliations.js';

// Realistic Philippine club data
const PHILIPPINE_CLUBS = [
  {
    name: 'Philippine National Racing Pigeon Federation',
    code: 'PNRPF-NAT',
    abbr: 'PNRPF',
    level: 'national',
    type: 'operator',
    location: {
      region: 'National',
      regionCode: 'PH',
      provinceCode: 'PH',
      province: 'Philippines',
      municipality: null,
      city: null,
      barangay: null,
    },
    address: {
      hn: '100',
      street: 'National Highway',
      barangay: 'Poblacion',
      city: 'Quezon City',
      province: 'Metro Manila',
      region: 'National Capital Region',
      zip: '1100',
    },
    contact: {
      phone: '+63212345678',
      email: 'admin@pnrpf.org.ph',
    },
    description: 'National governing body for pigeon racing in the Philippines',
  },
  {
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
  },
  {
    name: 'Cabanatuan Flyers Club',
    code: 'CFC-NE',
    abbr: 'CFC',
    level: 'municipality',
    type: 'club',
    location: {
      region: 'Central Luzon',
      regionCode: '03',
      provinceCode: 'NE',
      province: 'Nueva Ecija',
      municipality: 'Cabanatuan City',
      municipalityCode: 'CBN',
      city: 'Cabanatuan City',
      barangay: null,
    },
    address: {
      hn: '456',
      street: 'M. Delgado Street',
      barangay: 'Bangad',
      city: 'Cabanatuan City',
      province: 'Nueva Ecija',
      region: 'Central Luzon',
      zip: '3100',
    },
    contact: {
      phone: '+639234567890',
      email: 'info@cabanatuanflyers.com',
    },
    description: 'Leading racing pigeon organization in Cabanatuan City',
  },
  {
    name: 'Nueva Ecija Racing Pigeon Club',
    code: 'NERPC-NE',
    abbr: 'NERPC',
    level: 'provincial',
    type: 'operator',
    location: {
      region: 'Central Luzon',
      regionCode: '03',
      provinceCode: 'NE',
      province: 'Nueva Ecija',
      municipality: null,
      city: null,
      barangay: null,
    },
    address: {
      hn: '789',
      street: 'Maharlika Highway',
      barangay: 'Caalibangbangan',
      city: 'Cabanatuan City',
      province: 'Nueva Ecija',
      region: 'Central Luzon',
      zip: '3100',
    },
    contact: {
      phone: '+639345678901',
      email: 'admin@nerpc.org',
    },
    description: 'Provincial governing body for pigeon racing in Nueva Ecija',
  },
  {
    name: 'San Jose Flyers Association',
    code: 'SJFA-NE',
    abbr: 'SJFA',
    level: 'municipality',
    type: 'club',
    location: {
      region: 'Central Luzon',
      regionCode: '03',
      provinceCode: 'NE',
      province: 'Nueva Ecija',
      municipality: 'San Jose City',
      municipalityCode: 'SJN',
      city: 'San Jose City',
      barangay: null,
    },
    address: {
      hn: '321',
      street: 'Rizal Street',
      barangay: 'Abar 1st',
      city: 'San Jose City',
      province: 'Nueva Ecija',
      region: 'Central Luzon',
      zip: '3121',
    },
    contact: {
      phone: '+639456789012',
      email: 'sanjoseflyers@gmail.com',
    },
    description: 'Dedicated pigeon racing community in San Jose City',
  },
  {
    name: 'Gapan Pigeon Racing Club',
    code: 'GPRC-NE',
    abbr: 'GPRC',
    level: 'municipality',
    type: 'club',
    location: {
      region: 'Central Luzon',
      regionCode: '03',
      provinceCode: 'NE',
      province: 'Nueva Ecija',
      municipality: 'Gapan City',
      municipalityCode: 'GPN',
      city: 'Gapan City',
      barangay: null,
    },
    address: {
      hn: '654',
      street: 'J. P. Rizal Street',
      barangay: 'Poblacion',
      city: 'Gapan City',
      province: 'Nueva Ecija',
      region: 'Central Luzon',
      zip: '3105',
    },
    contact: {
      phone: '+639567890123',
      email: 'gapanracing@gmail.com',
    },
    description: 'Professional pigeon racing club in Gapan City',
  },
];

// Test user accounts
const TEST_USERS = [
  {
    name: 'Juan Santos',
    email: 'juan.santos@gmail.com',
    password: 'Test123456',
    role: 'guest',
    membershipStatus: 'guest',
    description: 'Test Guest account for browsing clubs and applying',
  },
  {
    name: 'Carlos Reyes',
    email: 'carlos.reyes@gmail.com',
    password: 'Test123456',
    role: 'member',
    membershipStatus: 'active',
    clubCode: 'AFC-NE',
    description: 'Test Fancier/Member account',
  },
  {
    name: 'Roberto Cruz',
    email: 'roberto.cruz@gmail.com',
    password: 'Test123456',
    role: 'owner',
    membershipStatus: 'active',
    clubCode: 'AFC-NE',
    description: 'Test Club Owner account for Aliaga Flyers Club',
  },
  {
    name: 'Maria Santos',
    email: 'maria.santos@gmail.com',
    password: 'Test123456',
    role: 'secretary',
    membershipStatus: 'active',
    clubCode: 'AFC-NE',
    description: 'Test Club Secretary account for Aliaga Flyers Club',
  },
  {
    name: 'Antonio Torres',
    email: 'antonio.torres@gmail.com',
    password: 'Test123456',
    role: 'operator',
    membershipStatus: 'active',
    clubCode: 'NERPC-NE',
    description: 'Test Operator account for provincial operations',
  },
  {
    name: 'Elena Rodriguez',
    email: 'elena.rodriguez@gmail.com',
    password: 'Test123456',
    role: 'member',
    membershipStatus: 'active',
    clubCode: 'CFC-NE',
    description: 'Test Fancier account for Cabanatuan Flyers Club',
  },
];

// Sample pigeons
const SAMPLE_PIGEONS = [
  {
    name: 'Thunder Bolt',
    bandNumber: 'AFC-2024-001',
    color: 'Blue Bar',
    gender: 'cock',
    dateOfBirth: new Date('2024-01-15'),
    description: 'Fast racing pigeon with strong bloodline',
  },
  {
    name: 'Lightning Strike',
    bandNumber: 'AFC-2024-002',
    color: 'Red Check',
    gender: 'hen',
    dateOfBirth: new Date('2024-02-20'),
    description: 'Agile flyer with excellent homing instinct',
  },
  {
    name: 'Sky Rocket',
    bandNumber: 'CFC-2024-001',
    color: 'Black',
    gender: 'cock',
    dateOfBirth: new Date('2024-01-10'),
    description: 'Powerful flyer with proven race record',
  },
];

// Sample race data
const SAMPLE_RACE = {
  name: 'Aliaga to Cabanatuan Training Race',
  code: 'AFC-CFC-TR-2024-001',
  category: 'training',
  raceDate: new Date('2024-12-15T06:00:00Z'),
  departure: {
    siteName: 'Aliaga Liberation Point',
    coordinates: {
      latitude: 15.4645,
      longitude: 120.8545,
    },
  },
  destination: {
    siteName: 'Cabanatuan City Loft',
    coordinates: {
      latitude: 15.4845,
      longitude: 120.9678,
    },
  },
  distance: 25.5, // km
  status: 'open',
  entryFee: 500,
  maxEntries: 100,
  description: 'Training race from Aliaga to Cabanatuan City for young birds',
};

class AgilaTrackTestSeeder {
  constructor() {
    this.createdClubs = [];
    this.createdUsers = [];
    this.createdBirds = [];
    this.createdRace = null;
    this.createdRaceEntries = [];
  }

  async hashPassword(password) {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }

  async createClubs() {
    console.log('🏢 Creating realistic Philippine clubs...');
    
    // Create clubs in hierarchy order: national → provincial → municipal
    let createdNationalClub = null;
    let createdProvincialClub = null;
    
    // 1. Create national club (no parent required)
    const nationalClubData = PHILIPPINE_CLUBS.find(c => c.level === 'national');
    if (nationalClubData) {
      createdNationalClub = await Club.create({
        ...nationalClubData,
        logo: {
          url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/pnrpf-logo.png',
          publicId: 'pnrpf-logo',
          version: '1',
          updatedAt: new Date(),
        },
      });
      this.createdClubs.push(createdNationalClub);
      console.log(`✅ Created national club: ${createdNationalClub.name}`);
    }

    // 2. Create provincial club (parent is national club)
    const provincialClubData = PHILIPPINE_CLUBS.find(c => c.level === 'provincial');
    if (provincialClubData && createdNationalClub) {
      createdProvincialClub = await Club.create({
        ...provincialClubData,
        parent: createdNationalClub._id,
        logo: {
          url: 'https://res.cloudinary.com/demo/image/upload/v1234567890/nerpc-logo.png',
          publicId: 'nerpc-logo',
          version: '1',
          updatedAt: new Date(),
        },
      });
      this.createdClubs.push(createdProvincialClub);
      console.log(`✅ Created provincial club: ${createdProvincialClub.name}`);
    }

    // 3. Create municipal clubs (parent is provincial club)
    const municipalClubs = PHILIPPINE_CLUBS.filter(c => c.level === 'municipality');
    for (const clubData of municipalClubs) {
      const club = await Club.create({
        ...clubData,
        parent: createdProvincialClub._id,
        logo: {
          url: `https://res.cloudinary.com/demo/image/upload/v1234567890/${clubData.code.toLowerCase()}-logo.png`,
          publicId: `${clubData.code.toLowerCase()}-logo`,
          version: '1',
          updatedAt: new Date(),
        },
      });
      
      this.createdClubs.push(club);
      console.log(`✅ Created club: ${club.name}`);
    }

    return this.createdClubs;
  }

  async createUsers() {
    console.log('👥 Creating test user accounts...');
    
    for (const userData of TEST_USERS) {
      const club = this.createdClubs.find(c => c.code === userData.clubCode);
      
      const user = await User.create({
        ...userData,
        password: await this.hashPassword(userData.password),
        clubId: club?._id || null,
        activePlatform: {
          club: club?._id || null,
          role: userData.role,
          portal: userData.role === 'operator' ? 'operator' : 'member',
          access: [userData.role],
        },
        profile: {
          status: userData.role === 'guest' ? 'pending' : 'approved',
          at: new Date(),
          by: null,
        },
        profileCompleted: true,
      });

      // Create affiliation if user is not a guest
      if (userData.role !== 'guest' && club) {
        await Affiliation.create({
          user: user._id,
          club: club._id,
          role: userData.role,
          status: 'approved',
          appliedAt: new Date(),
          approvedAt: new Date(),
          approvedBy: club._id,
        });
      }

      this.createdUsers.push(user);
      console.log(`✅ Created user: ${user.name} (${user.role})`);
    }

    return this.createdUsers;
  }

  async createBirds() {
    console.log('🐦 Creating sample pigeons...');
    
    const memberUsers = this.createdUsers.filter(u => u.role === 'member');
    
    for (let i = 0; i < SAMPLE_PIGEONS.length; i++) {
      const birdData = SAMPLE_PIGEONS[i];
      const owner = memberUsers[i % memberUsers.length];
      const club = this.createdClubs.find(c => c._id.toString() === owner.clubId.toString());
      
      const bird = await Bird.create({
        ...birdData,
        ownerId: owner._id,
        clubId: club._id,
        bandNumber: `${club.abbr}-${new Date().getFullYear()}-${String(i + 1).padStart(3, '0')}`,
        ringNumber: birdData.bandNumber,
        status: 'active',
        registeredAt: new Date(),
      });

      this.createdBirds.push(bird);
      console.log(`✅ Created bird: ${bird.name} (${bird.bandNumber})`);
    }

    return this.createdBirds;
  }

  async createRace() {
    console.log('🏁 Creating sample race...');
    
    const organizerClub = this.createdClubs.find(c => c.code === 'AFC-NE');
    const ownerUser = this.createdUsers.find(u => u.role === 'owner' && u.clubId.toString() === organizerClub._id.toString());
    
    const race = await Race.create({
      ...SAMPLE_RACE,
      club: organizerClub._id,
      organizerClubId: organizerClub._id,
      createdBy: ownerUser._id,
      createdAt: new Date(),
      entries: [],
    });

    this.createdRace = race;
    console.log(`✅ Created race: ${race.name}`);
    return race;
  }

  async createRaceEntries() {
    console.log('📝 Creating race entries...');
    
    if (!this.createdRace) {
      console.log('❌ No race found to create entries for');
      return;
    }

    const memberUsers = this.createdUsers.filter(u => u.role === 'member');
    
    for (let i = 0; i < Math.min(3, this.createdBirds.length); i++) {
      const bird = this.createdBirds[i];
      const owner = memberUsers.find(u => u._id.toString() === bird.ownerId.toString());
      const club = this.createdClubs.find(c => c._id.toString() === bird.clubId.toString());
      
      // Find affiliation for this user and club
      const affiliation = await Affiliation.findOne({
        user: owner._id,
        club: club._id
      });

      // Create a basic loft entry (simplified for testing)
      const loftId = new mongoose.Types.ObjectId();
      
      const entry = await RaceEntry.create({
        race: this.createdRace._id,
        raceId: this.createdRace._id,
        clubId: club._id,
        affiliation: affiliation?._id,
        fancierId: owner._id,
        pigeonId: bird._id,
        loft: loftId,
        loftSnapshot: {
          code: `${club.abbr}-LOFT-${String(i + 1).padStart(2, '0')}`,
          name: `${owner.name}'s Loft`,
          coordinates: {
            latitude: 15.4845 + (i * 0.01),
            longitude: 120.9678 + (i * 0.01),
          },
        },
        bird: {
          bandNumber: bird.bandNumber,
          name: bird.name,
          color: bird.color,
          gender: bird.gender,
          year: bird.dateOfBirth ? bird.dateOfBirth.getFullYear() : 2024,
        },
        entryDate: new Date(),
        status: 'booked',
        paymentStatus: 'paid',
        entryFee: this.createdRace.entryFee,
      });

      this.createdRaceEntries.push(entry);
      console.log(`✅ Created race entry: ${bird.name} -> ${this.createdRace.name}`);
    }

    // Update race with entries
    await Race.findByIdAndUpdate(this.createdRace._id, {
      $push: { entries: { $each: this.createdRaceEntries.map(e => e._id) } },
    });

    return this.createdRaceEntries;
  }

  async seed() {
    try {
      console.log('🚀 Starting AgilaTrack Test Scenario Seeding...\n');

      // Clean existing data (optional - comment out if you want to preserve existing data)
      console.log('🧹 Cleaning existing test data...');
      await RaceEntry.deleteMany({});
      await Race.deleteMany({});
      await Bird.deleteMany({});
      await Affiliation.deleteMany({});
      await User.deleteMany({ email: { $in: TEST_USERS.map(u => u.email) } });
      await Club.deleteMany({ code: { $in: PHILIPPINE_CLUBS.map(c => c.code) } });

      // Create data in order
      await this.createClubs();
      await this.createUsers();
      await this.createBirds();
      await this.createRace();
      await this.createRaceEntries();

      console.log('\n✨ AgilaTrack Test Scenario Seeding Complete! ✨');
      this.printSummary();

    } catch (error) {
      console.error('❌ Seeding failed:', error);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📊 SEEDING SUMMARY:');
    console.log('==================');
    console.log(`🏢 Clubs Created: ${this.createdClubs.length}`);
    this.createdClubs.forEach(club => {
      console.log(`   - ${club.name} (${club.code}) - ${club.level}`);
    });
    
    console.log(`\n👥 Users Created: ${this.createdUsers.length}`);
    this.createdUsers.forEach(user => {
      console.log(`   - ${user.name} (${user.email}) - ${user.role}`);
    });
    
    console.log(`\n🐦 Birds Created: ${this.createdBirds.length}`);
    this.createdBirds.forEach(bird => {
      console.log(`   - ${bird.name} (${bird.bandNumber})`);
    });
    
    console.log(`\n🏁 Race Created: ${this.createdRace?.name || 'None'}`);
    console.log(`\n📝 Race Entries Created: ${this.createdRaceEntries.length}`);

    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('=====================');
    TEST_USERS.forEach(user => {
      console.log(`${user.name} (${user.role}):`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: ${user.password}`);
      console.log('');
    });

    console.log('🎯 TESTING WORKFLOW:');
    console.log('==================');
    console.log('1. Guest Flow: Juan Santos → Browse clubs → Apply to Aliaga Flyers Club');
    console.log('2. Club Owner Flow: Roberto Cruz → Manage club logo → Approve applications');
    console.log('3. Fancier Flow: Carlos Reyes → Register pigeons → Join races');
    console.log('4. Operator Flow: Antonio Torres → Provincial race oversight');
    console.log('5. Race Flow: Aliaga to Cabanatuan Training Race → Entries → Results');
  }
}

// Run seeder if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const seeder = new AgilaTrackTestSeeder();
  
  // Connect to MongoDB
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/agilatrack')
    .then(() => {
      console.log('📦 Connected to MongoDB');
      return seeder.seed();
    })
    .then(() => {
      console.log('\n🎉 Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    });
}

export default AgilaTrackTestSeeder;
