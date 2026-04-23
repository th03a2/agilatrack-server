import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import dns from "node:dns";
import { fileURLToPath } from "node:url";
import Affiliations from "../models/Affiliations.js";
import Clubs from "../models/Clubs.js";
import Lofts from "../models/Lofts.js";
import Officers from "../models/Officers.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MONGO_URI = process.env.MONGO_URI;
const shouldReset = process.argv.includes("--reset");
const defaultPassword = "Password123!";

const places = {
  indang: {
    region: "CALABARZON",
    regionCode: "R4A",
    province: "Cavite",
    provinceCode: "CAV",
    municipality: "Indang",
    municipalityCode: "IND",
    barangay: "Poblacion IV",
    barangayCode: "1023",
    zip: "4122",
  },
  silang: {
    region: "CALABARZON",
    regionCode: "R4A",
    province: "Cavite",
    provinceCode: "CAV",
    municipality: "Silang",
    municipalityCode: "SIL",
    barangay: "Biga I",
    barangayCode: "1031",
    zip: "4118",
  },
  calamba: {
    region: "CALABARZON",
    regionCode: "R4A",
    province: "Laguna",
    provinceCode: "LAG",
    municipality: "Calamba",
    municipalityCode: "CAL",
    barangay: "Real",
    barangayCode: "1104",
    zip: "4027",
  },
  tarlacCity: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Tarlac",
    provinceCode: "TAR",
    municipality: "Tarlac City",
    municipalityCode: "TAC",
    barangay: "San Roque",
    barangayCode: "0301",
    zip: "2300",
  },
};

const addressFromPlace = (place, street) => ({
  street,
  barangay: place.barangay,
  barangayCode: place.barangayCode,
  municipality: place.municipality,
  municipalityCode: place.municipalityCode,
  province: place.province,
  provinceCode: place.provinceCode,
  region: place.region,
  regionCode: place.regionCode,
  zip: place.zip,
});

const clubSeeds = [
  {
    key: "national",
    parentKey: null,
    name: "Philippine Homing Pigeon Racing Federation",
    code: "PHPRF",
    abbr: "PHPRF",
    level: "national",
    status: "approved",
    tagline: "Verified clubs, trusted lofts, fair racing.",
    history:
      "National sample federation for AgilaTrack development and QA workflows.",
  },
  {
    key: "calabarzon",
    parentKey: "national",
    name: "CALABARZON Racing Pigeon Council",
    code: "PH-R4A",
    abbr: "CRPC",
    level: "regional",
    location: {
      region: places.indang.region,
      regionCode: places.indang.regionCode,
    },
    status: "approved",
  },
  {
    key: "centralLuzon",
    parentKey: "national",
    name: "Central Luzon Racing Pigeon Council",
    code: "PH-R3",
    abbr: "CLRPC",
    level: "regional",
    location: {
      region: places.tarlacCity.region,
      regionCode: places.tarlacCity.regionCode,
    },
    status: "approved",
  },
  {
    key: "cavite",
    parentKey: "calabarzon",
    name: "Cavite Racing Pigeon Association",
    code: "PH-CAV",
    abbr: "CRPA",
    level: "provincial",
    location: {
      region: places.indang.region,
      regionCode: places.indang.regionCode,
      province: places.indang.province,
      provinceCode: places.indang.provinceCode,
    },
    status: "approved",
  },
  {
    key: "laguna",
    parentKey: "calabarzon",
    name: "Laguna Racing Pigeon Association",
    code: "PH-LAG",
    abbr: "LRPA",
    level: "provincial",
    location: {
      region: places.calamba.region,
      regionCode: places.calamba.regionCode,
      province: places.calamba.province,
      provinceCode: places.calamba.provinceCode,
    },
    status: "approved",
  },
  {
    key: "tarlac",
    parentKey: "centralLuzon",
    name: "Tarlac Racing Pigeon Association",
    code: "PH-TAR",
    abbr: "TRPA",
    level: "provincial",
    location: {
      region: places.tarlacCity.region,
      regionCode: places.tarlacCity.regionCode,
      province: places.tarlacCity.province,
      provinceCode: places.tarlacCity.provinceCode,
    },
    status: "approved",
  },
  {
    key: "indang",
    parentKey: "cavite",
    name: "Indang Flyers Club",
    code: "PH-CAV-IND",
    abbr: "IFC",
    level: "municipality",
    location: {
      region: places.indang.region,
      regionCode: places.indang.regionCode,
      province: places.indang.province,
      provinceCode: places.indang.provinceCode,
      municipality: places.indang.municipality,
      municipalityCode: places.indang.municipalityCode,
      barangayCode: places.indang.barangayCode,
    },
    status: "approved",
    population: 4,
    social: {
      fb: "https://facebook.com/indangflyers",
    },
  },
  {
    key: "silang",
    parentKey: "cavite",
    name: "Silang High Flyers Club",
    code: "PH-CAV-SIL",
    abbr: "SHFC",
    level: "municipality",
    location: {
      region: places.silang.region,
      regionCode: places.silang.regionCode,
      province: places.silang.province,
      provinceCode: places.silang.provinceCode,
      municipality: places.silang.municipality,
      municipalityCode: places.silang.municipalityCode,
      barangayCode: places.silang.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "calamba",
    parentKey: "laguna",
    name: "Calamba Loft Masters Club",
    code: "PH-LAG-CAL",
    abbr: "CLMC",
    level: "municipality",
    location: {
      region: places.calamba.region,
      regionCode: places.calamba.regionCode,
      province: places.calamba.province,
      provinceCode: places.calamba.provinceCode,
      municipality: places.calamba.municipality,
      municipalityCode: places.calamba.municipalityCode,
      barangayCode: places.calamba.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "tarlacCity",
    parentKey: "tarlac",
    name: "Tarlac City Racing Flyers",
    code: "PH-TAR-TAC",
    abbr: "TCRF",
    level: "municipality",
    location: {
      region: places.tarlacCity.region,
      regionCode: places.tarlacCity.regionCode,
      province: places.tarlacCity.province,
      provinceCode: places.tarlacCity.provinceCode,
      municipality: places.tarlacCity.municipality,
      municipalityCode: places.tarlacCity.municipalityCode,
      barangayCode: places.tarlacCity.barangayCode,
    },
    status: "approved",
    population: 1,
  },
];

const userSeeds = [
  {
    key: "juan",
    clubKey: "indang",
    loftKey: "lopezSky",
    officer: "President",
    email: "juan.delacruz@agilatrack.test",
    fullName: {
      fname: "Juan",
      mname: "Santos",
      lname: "Dela Cruz",
      title: "Mr.",
      nickname: "Juan",
    },
    mobile: "09170000001",
    isMale: true,
    placeKey: "indang",
  },
  {
    key: "maria",
    clubKey: "indang",
    loftKey: "delaCruzNorth",
    officer: "Secretary",
    email: "maria.santos@agilatrack.test",
    fullName: {
      fname: "Maria",
      mname: "Reyes",
      lname: "Santos",
      title: "Ms.",
      nickname: "Mia",
    },
    mobile: "09170000002",
    isMale: false,
    placeKey: "indang",
  },
  {
    key: "pedro",
    clubKey: "indang",
    loftKey: "ramosRidge",
    officer: "Treasurer",
    email: "pedro.ramos@agilatrack.test",
    fullName: {
      fname: "Pedro",
      mname: "Garcia",
      lname: "Ramos",
      title: "Mr.",
      nickname: "Peds",
    },
    mobile: "09170000003",
    isMale: true,
    placeKey: "indang",
  },
  {
    key: "ana",
    clubKey: "indang",
    loftKey: "lopezSky",
    officer: "Race Secretary",
    email: "ana.lopez@agilatrack.test",
    fullName: {
      fname: "Ana",
      mname: "Villanueva",
      lname: "Lopez",
      title: "Ms.",
      nickname: "Ana",
    },
    mobile: "09170000004",
    isMale: false,
    placeKey: "indang",
  },
  {
    key: "carlo",
    clubKey: "silang",
    loftKey: "carloBiga",
    officer: "President",
    email: "carlo.mendoza@agilatrack.test",
    fullName: {
      fname: "Carlo",
      mname: "Bautista",
      lname: "Mendoza",
      title: "Mr.",
      nickname: "Carlo",
    },
    mobile: "09170000005",
    isMale: true,
    placeKey: "silang",
  },
  {
    key: "liza",
    clubKey: "calamba",
    loftKey: "lizaReal",
    officer: "President",
    email: "liza.cruz@agilatrack.test",
    fullName: {
      fname: "Liza",
      mname: "Mercado",
      lname: "Cruz",
      title: "Ms.",
      nickname: "Liza",
    },
    mobile: "09170000006",
    isMale: false,
    placeKey: "calamba",
  },
  {
    key: "roberto",
    clubKey: "tarlacCity",
    loftKey: "robertoSanRoque",
    officer: "President",
    email: "roberto.galang@agilatrack.test",
    fullName: {
      fname: "Roberto",
      mname: "Aquino",
      lname: "Galang",
      title: "Mr.",
      nickname: "Bert",
    },
    mobile: "09170000007",
    isMale: true,
    placeKey: "tarlacCity",
  },
];

const loftSeeds = [
  {
    key: "lopezSky",
    managerKey: "ana",
    clubKey: "indang",
    code: "LOFT-IND-001",
    name: "Lopez Sky Loft",
    coordinates: { latitude: 14.1951, longitude: 120.8761 },
    address: addressFromPlace(places.indang, "Mabini Street"),
    capacity: 120,
    notes: "Primary Indang sample loft near the municipal proper.",
  },
  {
    key: "delaCruzNorth",
    managerKey: "juan",
    clubKey: "indang",
    code: "LOFT-IND-002",
    name: "Dela Cruz North Loft",
    coordinates: { latitude: 14.1974, longitude: 120.8792 },
    address: addressFromPlace(places.indang, "Rizal Avenue"),
    capacity: 80,
    notes: "Secondary Indang loft for race timing tests.",
  },
  {
    key: "ramosRidge",
    managerKey: "pedro",
    clubKey: "indang",
    code: "LOFT-IND-003",
    name: "Ramos Ridge Loft",
    coordinates: { latitude: 14.1906, longitude: 120.8697 },
    address: addressFromPlace(places.indang, "Daang Hari Road"),
    capacity: 95,
    notes: "Treasurer managed loft with ridge-side test coordinates.",
  },
  {
    key: "carloBiga",
    managerKey: "carlo",
    clubKey: "silang",
    code: "LOFT-SIL-001",
    name: "Mendoza Biga Loft",
    coordinates: { latitude: 14.2305, longitude: 120.9747 },
    address: addressFromPlace(places.silang, "Biga Road"),
    capacity: 100,
    notes: "Silang sample loft for cross-club testing.",
  },
  {
    key: "lizaReal",
    managerKey: "liza",
    clubKey: "calamba",
    code: "LOFT-CAL-001",
    name: "Cruz Real Loft",
    coordinates: { latitude: 14.2118, longitude: 121.1653 },
    address: addressFromPlace(places.calamba, "Real Road"),
    capacity: 90,
    notes: "Calamba sample loft in Laguna.",
  },
  {
    key: "robertoSanRoque",
    managerKey: "roberto",
    clubKey: "tarlacCity",
    code: "LOFT-TAC-001",
    name: "Galang San Roque Loft",
    coordinates: { latitude: 15.4867, longitude: 120.5989 },
    address: addressFromPlace(places.tarlacCity, "F. Tanedo Street"),
    capacity: 110,
    notes: "Tarlac City sample loft for northern route tests.",
  },
];

const raceSeeds = [
  {
    key: "indangTarlac100",
    clubKey: "indang",
    organizerKey: "ana",
    code: "IFC-2026-TAR-100",
    name: "Indang Flyers Tarlac 100KM Training Race",
    category: "old bird",
    raceDate: new Date("2026-05-03T06:00:00+08:00"),
    booking: {
      opensAt: new Date("2026-04-20T08:00:00+08:00"),
      closesAt: new Date("2026-05-02T17:00:00+08:00"),
    },
    checkIn: {
      startsAt: new Date("2026-05-02T18:00:00+08:00"),
      endsAt: new Date("2026-05-02T21:00:00+08:00"),
      location: "Indang Flyers Clubhouse, Poblacion IV, Indang, Cavite",
    },
    boarding: {
      startsAt: new Date("2026-05-02T19:00:00+08:00"),
      endsAt: new Date("2026-05-02T22:00:00+08:00"),
      location: "Indang Flyers Clubhouse Crate Area",
    },
    transport: {
      handlerKey: "ana",
      transporterKey: "pedro",
      driver: {
        name: "Pedro Ramos",
        mobile: "09170000003",
        licenseNumber: "N01-23-456789",
      },
      vehicle: {
        type: "closed van",
        plateNumber: "CAV-4821",
        description: "White ventilated race crate van",
      },
      origin: {
        name: "Indang Flyers Clubhouse",
        departedAt: new Date("2026-05-03T02:00:00+08:00"),
      },
      releaseSiteArrival: {
        arrivedAt: new Date("2026-05-03T05:25:00+08:00"),
        receivedByKey: "roberto",
        remarks: "Crates received sealed and intact at the release site.",
      },
      notes: "Sample transport chain of custody for the training race.",
    },
    departure: {
      siteName: "Tarlac City Release Site",
      departedAt: new Date("2026-05-03T06:00:00+08:00"),
      coordinates: { latitude: 15.4867, longitude: 120.5989 },
      address: {
        municipality: "Tarlac City",
        province: "Tarlac",
        region: "Central Luzon",
      },
    },
    liberation: {
      liberatorKey: "roberto",
      releasedByName: "Roberto Galang",
      witnesses: [
        { userKey: "ana", role: "Race Secretary" },
        { userKey: "pedro", role: "Transporter" },
      ],
      verifiedAt: new Date("2026-05-03T06:03:00+08:00"),
      remarks: "Released after weather and seal checks.",
    },
    weather: {
      condition: "Clear morning",
      wind: "Light northeast wind",
      temperatureC: 27,
      notes: "Sample liberation weather for development data.",
    },
    status: "departed",
  },
  {
    key: "indangSubic150",
    clubKey: "indang",
    organizerKey: "juan",
    code: "IFC-2026-SBC-150",
    name: "Indang Flyers Subic 150KM Futurity",
    category: "young bird",
    raceDate: new Date("2026-05-17T06:15:00+08:00"),
    booking: {
      opensAt: new Date("2026-05-04T08:00:00+08:00"),
      closesAt: new Date("2026-05-16T17:00:00+08:00"),
    },
    checkIn: {
      startsAt: new Date("2026-05-16T18:00:00+08:00"),
      endsAt: new Date("2026-05-16T21:00:00+08:00"),
      location: "Indang Flyers Clubhouse, Poblacion IV, Indang, Cavite",
    },
    boarding: {
      startsAt: new Date("2026-05-16T19:00:00+08:00"),
      endsAt: new Date("2026-05-16T22:00:00+08:00"),
      location: "Indang Flyers Clubhouse Crate Area",
    },
    transport: {
      handlerKey: "maria",
      transporterKey: "juan",
      driver: {
        name: "Juan Dela Cruz",
        mobile: "09170000001",
      },
      vehicle: {
        type: "utility van",
        plateNumber: "CAV-1501",
      },
      origin: {
        name: "Indang Flyers Clubhouse",
      },
    },
    departure: {
      siteName: "Subic Bay Release Site",
      coordinates: { latitude: 14.8232, longitude: 120.2783 },
      address: {
        municipality: "Subic",
        province: "Zambales",
        region: "Central Luzon",
      },
    },
    liberation: {
      liberatorKey: "juan",
      releasedByName: "Juan Dela Cruz",
      witnesses: [{ userKey: "maria", role: "Secretary" }],
    },
    weather: {
      condition: "Pending race-day check",
      notes: "Upcoming sample race for booking workflow tests.",
    },
    status: "booking_open",
  },
];

const raceEntrySeeds = [
  {
    raceKey: "indangTarlac100",
    userKey: "juan",
    loftKey: "delaCruzNorth",
    bird: {
      bandNumber: "IFC-2024-0001",
      name: "North Arrow",
      sex: "cock",
      color: "Blue Bar",
      strain: "Janssen",
      hatchYear: 2024,
    },
    booking: {
      bookingCode: "BK-IFC-0001",
      bookedAt: new Date("2026-04-22T09:10:00+08:00"),
      remarks: "Seed booked online.",
    },
    checkIn: {
      status: "checked_in",
      checkedInAt: new Date("2026-05-02T18:12:00+08:00"),
      station: {
        code: "IFC-CHK",
        name: "Indang Flyers Clubhouse Check-in",
        coordinates: { latitude: 14.1955, longitude: 120.8767 },
        address: {
          street: "Mabini Street",
          barangay: places.indang.barangay,
          municipality: places.indang.municipality,
          province: places.indang.province,
          region: places.indang.region,
        },
      },
    },
    boarding: {
      boardingPassNumber: "BP-IFC-0001",
      crateNumber: "CRATE-A",
      compartmentNumber: "A1",
      sequenceNumber: 1,
      sealNumber: "SEAL-1001",
    },
    arrival: {
      arrivedAt: new Date("2026-05-03T08:08:00+08:00"),
      source: "manual",
      remarks: "Clocked at home loft.",
    },
    status: "arrived",
  },
  {
    raceKey: "indangTarlac100",
    userKey: "maria",
    loftKey: "delaCruzNorth",
    bird: {
      bandNumber: "IFC-2024-0002",
      name: "Mabini Line",
      sex: "hen",
      color: "Checker",
      strain: "Van Loon",
      hatchYear: 2024,
    },
    booking: {
      bookingCode: "BK-IFC-0002",
      bookedAt: new Date("2026-04-22T10:15:00+08:00"),
    },
    checkIn: {
      status: "checked_in",
      checkedInAt: new Date("2026-05-02T18:25:00+08:00"),
      station: {
        code: "IFC-CHK",
        name: "Indang Flyers Clubhouse Check-in",
        coordinates: { latitude: 14.1955, longitude: 120.8767 },
      },
    },
    boarding: {
      boardingPassNumber: "BP-IFC-0002",
      crateNumber: "CRATE-A",
      compartmentNumber: "A2",
      sequenceNumber: 2,
      sealNumber: "SEAL-1001",
    },
    arrival: {
      arrivedAt: new Date("2026-05-03T08:17:00+08:00"),
      source: "manual",
    },
    status: "arrived",
  },
  {
    raceKey: "indangTarlac100",
    userKey: "pedro",
    loftKey: "ramosRidge",
    bird: {
      bandNumber: "IFC-2024-0003",
      name: "Ridge Runner",
      sex: "cock",
      color: "Red Check",
      strain: "Hofkens",
      hatchYear: 2024,
    },
    booking: {
      bookingCode: "BK-IFC-0003",
      bookedAt: new Date("2026-04-22T11:30:00+08:00"),
    },
    checkIn: {
      status: "checked_in",
      checkedInAt: new Date("2026-05-02T18:45:00+08:00"),
      station: {
        code: "IFC-CHK",
        name: "Indang Flyers Clubhouse Check-in",
      },
    },
    boarding: {
      boardingPassNumber: "BP-IFC-0003",
      crateNumber: "CRATE-B",
      compartmentNumber: "B1",
      sequenceNumber: 3,
      sealNumber: "SEAL-1002",
    },
    status: "departed",
  },
  {
    raceKey: "indangSubic150",
    userKey: "ana",
    loftKey: "lopezSky",
    bird: {
      bandNumber: "IFC-2025-0101",
      name: "Sky Note",
      sex: "hen",
      color: "Blue Pied",
      strain: "Heremans",
      hatchYear: 2025,
    },
    booking: {
      bookingCode: "BK-IFC-0101",
      bookedAt: new Date("2026-05-05T09:00:00+08:00"),
    },
    status: "booked",
  },
];

const racingMemberRole = 2;
const roleByOfficer = {
  President: 10,
  Secretary: 12,
  Treasurer: 13,
  "Race Secretary": 21,
};

const memberCodeByUserKey = {
  juan: "IFC-0001",
  maria: "IFC-0002",
  pedro: "IFC-0003",
  ana: "IFC-0004",
  carlo: "SHFC-0001",
  liza: "CLMC-0001",
  roberto: "TCRF-0001",
};

const resetSeedData = async () => {
  const seedEmails = userSeeds.map((user) => user.email);
  const seedClubCodes = clubSeeds.map((club) => club.code);
  const seedLoftCodes = loftSeeds.map((loft) => loft.code);
  const seedRaceCodes = raceSeeds.map((race) => race.code);

  const [users, clubs, races] = await Promise.all([
    Users.find({ email: { $in: seedEmails } }).select("_id"),
    Clubs.find({ code: { $in: seedClubCodes } }).select("_id"),
    Races.find({ code: { $in: seedRaceCodes } }).select("_id"),
  ]);

  await Promise.all([
    RaceEntries.deleteMany({ race: { $in: races.map((race) => race._id) } }),
    Races.deleteMany({ code: { $in: seedRaceCodes } }),
    Officers.deleteMany({
      $or: [
        { user: { $in: users.map((user) => user._id) } },
        { club: { $in: clubs.map((club) => club._id) } },
      ],
    }),
    Affiliations.deleteMany({
      $or: [
        { user: { $in: users.map((user) => user._id) } },
        { club: { $in: clubs.map((club) => club._id) } },
      ],
    }),
    Lofts.deleteMany({ code: { $in: seedLoftCodes } }),
    Users.deleteMany({ email: { $in: seedEmails } }),
    Clubs.deleteMany({ code: { $in: seedClubCodes } }),
  ]);
};

const upsertUser = async (seed) => {
  const place = places[seed.placeKey];
  const user = (await Users.findOne({ email: seed.email })) || new Users();

  user.set({
    email: seed.email,
    password: defaultPassword,
    fullName: seed.fullName,
    mobile: seed.mobile,
    membership: "regular",
    state: ["patron"],
    isMale: seed.isMale,
    profile: {
      status: "approved",
      at: new Date(),
    },
    address: {
      street: "Sample Street",
      barangay: place.barangay,
      city: place.municipality,
      province: place.province,
      region: place.region,
      zip: place.zip,
    },
    work: {
      title: seed.officer || "Racer",
      company: `${seed.clubKey} racing club`,
      province: place.province,
      createdAt: new Date(),
    },
    isActive: true,
  });

  await user.save();
  return user;
};

const upsertClub = async (seed, clubsByKey) => {
  const club = (await Clubs.findOne({ code: seed.code })) || new Clubs();
  const parent = seed.parentKey ? clubsByKey[seed.parentKey]._id : null;

  club.set({
    ...seed,
    parent,
    isActive: true,
  });

  await club.save();
  return club;
};

const upsertLoft = async (seed, usersByKey, clubsByKey) => {
  const loft = (await Lofts.findOne({ code: seed.code })) || new Lofts();

  loft.set({
    ...seed,
    club: clubsByKey[seed.clubKey]._id,
    manager: usersByKey[seed.managerKey]._id,
    status: "active",
  });

  await loft.save();
  return loft;
};

const upsertAffiliation = async ({ userSeed, usersByKey, clubsByKey, loftsByKey }) => {
  const user = usersByKey[userSeed.key];
  const club = clubsByKey[userSeed.clubKey];
  const loft = loftsByKey[userSeed.loftKey];
  const officerRole = roleByOfficer[userSeed.officer] || racingMemberRole;

  const affiliation =
    (await Affiliations.findOne({ user: user._id, club: club._id })) ||
    new Affiliations();

  affiliation.set({
    user: user._id,
    club: club._id,
    memberCode: memberCodeByUserKey[userSeed.key],
    membershipType: "racer",
    roles: [racingMemberRole],
    mobile: user.mobile,
    primaryLoft: loft._id,
    lofts: [loft._id],
    status: "approved",
    racing: {
      licenseNumber: memberCodeByUserKey[userSeed.key],
      bandPrefix: club.abbr,
      clockSystem: "Manual",
    },
    tagline: `${club.abbr} member`,
    remarks: ["Seeded by seedAgilaTrack.js"],
  });

  await affiliation.save();

  user.activePlatform = {
    _id: affiliation._id,
    club: club._id,
    role: officerRole,
    portal: "club",
    access: [String(officerRole)],
  };
  await user.save();

  return affiliation;
};

const upsertOfficer = async ({ userSeed, usersByKey, clubsByKey }) => {
  const user = usersByKey[userSeed.key];
  const club = clubsByKey[userSeed.clubKey];
  const officer =
    (await Officers.findOne({
      user: user._id,
      club: club._id,
      authorization: userSeed.officer,
    })) || new Officers();

  officer.set({
    user: user._id,
    club: club._id,
    authorization: userSeed.officer,
  });

  await officer.save();
  return officer;
};

const upsertRace = async ({ seed, usersByKey, clubsByKey }) => {
  const race = (await Races.findOne({ code: seed.code })) || new Races();
  const { transport, liberation, ...raceSeed } = seed;

  race.set({
    ...raceSeed,
    club: clubsByKey[seed.clubKey]._id,
    organizer: usersByKey[seed.organizerKey]._id,
  });

  await race.save();
  return race;
};

const buildEntryTransport = (transport, usersByKey) => {
  if (!transport) return undefined;

  return {
    driver: transport.driver,
    vehicle: transport.vehicle,
    origin: transport.origin,
    notes: transport.notes,
    handler: transport.handlerKey
      ? usersByKey[transport.handlerKey]._id
      : undefined,
    transporter: transport.transporterKey
      ? usersByKey[transport.transporterKey]._id
      : undefined,
    releaseSiteArrival: transport.releaseSiteArrival
      ? {
          arrivedAt: transport.releaseSiteArrival.arrivedAt,
          remarks: transport.releaseSiteArrival.remarks,
          receivedBy: transport.releaseSiteArrival.receivedByKey
            ? usersByKey[transport.releaseSiteArrival.receivedByKey]._id
            : undefined,
        }
      : undefined,
  };
};

const buildEntryLiberation = (liberation, usersByKey) => {
  if (!liberation) return undefined;

  return {
    releasedByName: liberation.releasedByName,
    verifiedAt: liberation.verifiedAt,
    remarks: liberation.remarks,
    liberator: liberation.liberatorKey
      ? usersByKey[liberation.liberatorKey]._id
      : undefined,
    witnesses: liberation.witnesses?.map((witness) => ({
      user: witness.userKey ? usersByKey[witness.userKey]._id : undefined,
      name: witness.name,
      role: witness.role,
    })),
  };
};

const upsertRaceEntry = async ({
  seed,
  racesByKey,
  raceSeedsByKey,
  affiliationsByUserKey,
  loftsByKey,
  usersByKey,
}) => {
  const race = racesByKey[seed.raceKey];
  const raceSeed = raceSeedsByKey[seed.raceKey];
  const affiliation = affiliationsByUserKey[seed.userKey];
  const loft = loftsByKey[seed.loftKey];
  const entry =
    (await RaceEntries.findOne({
      race: race._id,
      "bird.bandNumber": seed.bird.bandNumber,
    })) || new RaceEntries();

  const departure =
    seed.status === "booked"
      ? {
          siteName: race.departure.siteName,
          coordinates: race.departure.coordinates,
        }
      : {
          siteName: race.departure.siteName,
          departedAt: race.departure.departedAt,
          coordinates: race.departure.coordinates,
          station: {
            code: "REL-TAR",
            name: race.departure.siteName,
            coordinates: race.departure.coordinates,
            address: race.departure.address,
          },
        };

  entry.set({
    race: race._id,
    affiliation: affiliation._id,
    loft: loft._id,
    loftSnapshot: {
      code: loft.code,
      name: loft.name,
      coordinates: loft.coordinates,
    },
    bird: seed.bird,
    booking: {
      channel: "online",
      ...seed.booking,
    },
    checkIn: seed.checkIn || undefined,
    boarding: seed.boarding || undefined,
    departure,
    transport: seed.transport || buildEntryTransport(raceSeed.transport, usersByKey),
    liberation:
      seed.liberation || buildEntryLiberation(raceSeed.liberation, usersByKey),
    arrival: seed.arrival || undefined,
    status: seed.status,
  });

  await entry.save();
  return entry;
};

const seed = async () => {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env.");
  }

  await mongoose.connect(MONGO_URI);

  if (shouldReset) {
    await resetSeedData();
  }

  const usersByKey = {};
  for (const userSeed of userSeeds) {
    usersByKey[userSeed.key] = await upsertUser(userSeed);
  }

  const clubsByKey = {};
  for (const clubSeed of clubSeeds) {
    clubsByKey[clubSeed.key] = await upsertClub(clubSeed, clubsByKey);
  }

  const loftsByKey = {};
  for (const loftSeed of loftSeeds) {
    loftsByKey[loftSeed.key] = await upsertLoft(
      loftSeed,
      usersByKey,
      clubsByKey,
    );
  }

  const affiliations = [];
  const affiliationsByUserKey = {};
  for (const userSeed of userSeeds) {
    const affiliation = await upsertAffiliation({
      userSeed,
      usersByKey,
      clubsByKey,
      loftsByKey,
    });

    affiliations.push(affiliation);
    affiliationsByUserKey[userSeed.key] = affiliation;
  }

  const officers = [];
  for (const userSeed of userSeeds.filter((seed) => seed.officer)) {
    officers.push(await upsertOfficer({ userSeed, usersByKey, clubsByKey }));
  }

  const indangClub = clubsByKey.indang;
  indangClub.leadership = {
    president: { user: usersByKey.juan._id },
    secretary: { user: usersByKey.maria._id },
    treasurer: { user: usersByKey.pedro._id },
    officers: [{ position: "Race Secretary", user: usersByKey.ana._id }],
  };
  indangClub.contacts = usersByKey.maria._id;
  await indangClub.save();

  const racesByKey = {};
  const raceSeedsByKey = {};
  for (const raceSeed of raceSeeds) {
    raceSeedsByKey[raceSeed.key] = raceSeed;
    racesByKey[raceSeed.key] = await upsertRace({
      seed: raceSeed,
      usersByKey,
      clubsByKey,
    });
  }

  const raceEntries = [];
  for (const raceEntrySeed of raceEntrySeeds) {
    raceEntries.push(
      await upsertRaceEntry({
        seed: raceEntrySeed,
        racesByKey,
        raceSeedsByKey,
        affiliationsByUserKey,
        loftsByKey,
        usersByKey,
      }),
    );
  }

  await RaceEntries.recalculateRanks(racesByKey.indangTarlac100._id);

  console.log("Seed complete:");
  console.table({
    users: Object.keys(usersByKey).length,
    clubs: Object.keys(clubsByKey).length,
    lofts: Object.keys(loftsByKey).length,
    affiliations: affiliations.length,
    officers: officers.length,
    races: Object.keys(racesByKey).length,
    raceEntries: raceEntries.length,
  });
  console.log(`Default password for seeded users: ${defaultPassword}`);
};

seed()
  .catch((error) => {
    console.error("Seed failed:", error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
