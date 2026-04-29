import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import ClubManagement from "../models/ClubManagement.js";
import Clubs from "../models/Clubs.js";
import Lofts from "../models/Lofts.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const MONGO_URI = process.env.MONGO_URI;
const shouldReset = process.argv.includes("--reset");
const defaultPassword = "Password123!";

const places = {
  cabanatuan: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "Cabanatuan City",
    municipalityCode: "CAB",
    barangay: "Sangitan East",
    barangayCode: "1001",
    zip: "3100",
  },
  gapan: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "Gapan City",
    municipalityCode: "GAP",
    barangay: "San Vicente",
    barangayCode: "1002",
    zip: "3105",
  },
  sanJose: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "San Jose City",
    municipalityCode: "SJC",
    barangay: "Abar 1st",
    barangayCode: "1003",
    zip: "3121",
  },
  talavera: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "Talavera",
    municipalityCode: "TAL",
    barangay: "Sampaloc",
    barangayCode: "1004",
    zip: "3114",
  },
  guimba: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "Guimba",
    municipalityCode: "GUI",
    barangay: "Saranay District",
    barangayCode: "1005",
    zip: "3115",
  },
  cabiao: {
    region: "Central Luzon",
    regionCode: "R3",
    province: "Nueva Ecija",
    provinceCode: "NUE",
    municipality: "Cabiao",
    municipalityCode: "CBI",
    barangay: "Bagong Sikat",
    barangayCode: "1006",
    zip: "3107",
  },
};

const addressFromPlace = (place, street) => ({
  street,
  barangay: place.barangay,
  city: place.municipality,
  province: place.province,
  region: place.region,
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
    key: "centralLuzon",
    parentKey: "national",
    name: "Central Luzon Racing Pigeon Council",
    code: "PH-R3",
    abbr: "CLRPC",
    level: "regional",
    location: {
      region: places.talavera.region,
      regionCode: places.talavera.regionCode,
    },
    status: "approved",
  },
  {
    key: "nuevaEcija",
    parentKey: "centralLuzon",
    name: "Nueva Ecija Racing Pigeon Association",
    code: "PH-NUE",
    abbr: "NERPA",
    level: "provincial",
    location: {
      region: places.cabanatuan.region,
      regionCode: places.cabanatuan.regionCode,
      province: places.cabanatuan.province,
      provinceCode: places.cabanatuan.provinceCode,
    },
    status: "approved",
  },
  {
    key: "cabanatuan",
    parentKey: "nuevaEcija",
    name: "Cabanatuan Flyers Club",
    code: "PH-NUE-CAB",
    abbr: "CFC",
    level: "municipality",
    location: {
      region: places.cabanatuan.region,
      regionCode: places.cabanatuan.regionCode,
      province: places.cabanatuan.province,
      provinceCode: places.cabanatuan.provinceCode,
      municipality: places.cabanatuan.municipality,
      municipalityCode: places.cabanatuan.municipalityCode,
      barangayCode: places.cabanatuan.barangayCode,
    },
    status: "approved",
    population: 4,
    social: {
      fb: "https://facebook.com/cabanatuanflyers",
    },
  },
  {
    key: "gapan",
    parentKey: "nuevaEcija",
    name: "Gapan High Flyers Club",
    code: "PH-NUE-GAP",
    abbr: "GHFC",
    level: "municipality",
    location: {
      region: places.gapan.region,
      regionCode: places.gapan.regionCode,
      province: places.gapan.province,
      provinceCode: places.gapan.provinceCode,
      municipality: places.gapan.municipality,
      municipalityCode: places.gapan.municipalityCode,
      barangayCode: places.gapan.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "sanJose",
    parentKey: "nuevaEcija",
    name: "San Jose Loft Masters Club",
    code: "PH-NUE-SJC",
    abbr: "SJLMC",
    level: "municipality",
    location: {
      region: places.sanJose.region,
      regionCode: places.sanJose.regionCode,
      province: places.sanJose.province,
      provinceCode: places.sanJose.provinceCode,
      municipality: places.sanJose.municipality,
      municipalityCode: places.sanJose.municipalityCode,
      barangayCode: places.sanJose.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "talavera",
    parentKey: "nuevaEcija",
    name: "Talavera Racing Flyers",
    code: "PH-NUE-TAL",
    abbr: "TRF",
    level: "municipality",
    location: {
      region: places.talavera.region,
      regionCode: places.talavera.regionCode,
      province: places.talavera.province,
      provinceCode: places.talavera.provinceCode,
      municipality: places.talavera.municipality,
      municipalityCode: places.talavera.municipalityCode,
      barangayCode: places.talavera.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "guimba",
    parentKey: "nuevaEcija",
    name: "Guimba Racing Club",
    code: "PH-NUE-GUI",
    abbr: "GRC",
    level: "municipality",
    location: {
      region: places.guimba.region,
      regionCode: places.guimba.regionCode,
      province: places.guimba.province,
      provinceCode: places.guimba.provinceCode,
      municipality: places.guimba.municipality,
      municipalityCode: places.guimba.municipalityCode,
      barangayCode: places.guimba.barangayCode,
    },
    status: "approved",
    population: 1,
  },
  {
    key: "cabiao",
    parentKey: "nuevaEcija",
    name: "Cabiao Flyers Guild",
    code: "PH-NUE-CBI",
    abbr: "CFG",
    level: "municipality",
    location: {
      region: places.cabiao.region,
      regionCode: places.cabiao.regionCode,
      province: places.cabiao.province,
      provinceCode: places.cabiao.provinceCode,
      municipality: places.cabiao.municipality,
      municipalityCode: places.cabiao.municipalityCode,
      barangayCode: places.cabiao.barangayCode,
    },
    status: "approved",
    population: 1,
  },
];

const userSeeds = [
  {
    key: "juan",
    clubKey: "cabanatuan",
    loftKey: "lopezSky",
    managementTitle: "Owner",
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
    placeKey: "cabanatuan",
  },
  {
    key: "maria",
    clubKey: "cabanatuan",
    loftKey: "delaCruzNorth",
    managementTitle: "Secretary",
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
    placeKey: "cabanatuan",
  },
  {
    key: "pedro",
    clubKey: "cabanatuan",
    loftKey: "ramosRidge",
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
    placeKey: "cabanatuan",
  },
  {
    key: "ana",
    clubKey: "cabanatuan",
    loftKey: "lopezSky",
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
    placeKey: "cabanatuan",
  },
  {
    key: "carlo",
    clubKey: "gapan",
    loftKey: "carloBiga",
    managementTitle: "Owner",
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
    placeKey: "gapan",
  },
  {
    key: "liza",
    clubKey: "sanJose",
    loftKey: "lizaReal",
    managementTitle: "Owner",
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
    placeKey: "sanJose",
  },
  {
    key: "roberto",
    clubKey: "talavera",
    loftKey: "robertoSanRoque",
    managementTitle: "Owner",
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
    placeKey: "talavera",
  },
];

const loftSeeds = [
  {
    key: "lopezSky",
    managerKey: "ana",
    clubKey: "cabanatuan",
    code: "LOFT-CAB-001",
    name: "Lopez Sky Loft",
    coordinates: { latitude: 15.4859, longitude: 120.9667 },
    address: addressFromPlace(places.cabanatuan, "Mabini Street"),
    capacity: 120,
    notes: "Primary Cabanatuan sample loft near the city proper.",
  },
  {
    key: "delaCruzNorth",
    managerKey: "juan",
    clubKey: "cabanatuan",
    code: "LOFT-CAB-002",
    name: "Dela Cruz North Loft",
    coordinates: { latitude: 15.4882, longitude: 120.9713 },
    address: addressFromPlace(places.cabanatuan, "Rizal Avenue"),
    capacity: 80,
    notes: "Secondary Cabanatuan loft for race timing tests.",
  },
  {
    key: "ramosRidge",
    managerKey: "pedro",
    clubKey: "cabanatuan",
    code: "LOFT-CAB-003",
    name: "Ramos Ridge Loft",
    coordinates: { latitude: 15.4788, longitude: 120.9615 },
    address: addressFromPlace(places.cabanatuan, "Daang Hari Road"),
    capacity: 95,
    notes: "Treasurer-managed loft with ridge-side test coordinates.",
  },
  {
    key: "carloBiga",
    managerKey: "carlo",
    clubKey: "gapan",
    code: "LOFT-GAP-001",
    name: "Mendoza San Vicente Loft",
    coordinates: { latitude: 15.3074, longitude: 120.9466 },
    address: addressFromPlace(places.gapan, "San Vicente Road"),
    capacity: 100,
    notes: "Gapan sample loft for cross-club testing.",
  },
  {
    key: "lizaReal",
    managerKey: "liza",
    clubKey: "sanJose",
    code: "LOFT-SJC-001",
    name: "Cruz Real Loft",
    coordinates: { latitude: 15.7914, longitude: 120.9902 },
    address: addressFromPlace(places.sanJose, "Real Road"),
    capacity: 90,
    notes: "San Jose City sample loft in Nueva Ecija.",
  },
  {
    key: "robertoSanRoque",
    managerKey: "roberto",
    clubKey: "talavera",
    code: "LOFT-TAL-001",
    name: "Galang San Roque Loft",
    coordinates: { latitude: 15.5889, longitude: 120.9236 },
    address: addressFromPlace(places.talavera, "Sampaloc Road"),
    capacity: 110,
    notes: "Talavera sample loft for northern route tests.",
  },
];

const raceSeeds = [
  {
    key: "cabanatuanTalavera100",
    clubKey: "cabanatuan",
    organizerKey: "ana",
    code: "CFC-2026-TAL-100",
    name: "Cabanatuan Flyers Talavera 100KM Training Race",
    category: "training",
    raceDate: new Date("2026-05-03T06:00:00+08:00"),
    booking: {
      opensAt: new Date("2026-04-20T08:00:00+08:00"),
      closesAt: new Date("2026-05-02T17:00:00+08:00"),
    },
    checkIn: {
      startsAt: new Date("2026-05-02T18:00:00+08:00"),
      endsAt: new Date("2026-05-02T21:00:00+08:00"),
      location: "Cabanatuan Flyers Clubhouse, Sangitan East, Cabanatuan City, Nueva Ecija",
    },
    boarding: {
      startsAt: new Date("2026-05-02T19:00:00+08:00"),
      endsAt: new Date("2026-05-02T22:00:00+08:00"),
      location: "Cabanatuan Flyers Clubhouse Crate Area",
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
        plateNumber: "NUE-4821",
        description: "White ventilated race crate van",
      },
      origin: {
        name: "Cabanatuan Flyers Clubhouse",
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
      siteName: "Talavera Release Site",
      departedAt: new Date("2026-05-03T06:00:00+08:00"),
      coordinates: { latitude: 15.5889, longitude: 120.9236 },
      address: {
        municipality: "Talavera",
        province: "Nueva Ecija",
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
    key: "cabanatuanGuimba150",
    clubKey: "cabanatuan",
    organizerKey: "juan",
    code: "CFC-2026-GUI-150",
    name: "Cabanatuan Flyers Guimba 150KM Futurity",
    category: "derby",
    raceDate: new Date("2026-05-17T06:15:00+08:00"),
    booking: {
      opensAt: new Date("2026-05-04T08:00:00+08:00"),
      closesAt: new Date("2026-05-16T17:00:00+08:00"),
    },
    checkIn: {
      startsAt: new Date("2026-05-16T18:00:00+08:00"),
      endsAt: new Date("2026-05-16T21:00:00+08:00"),
      location: "Cabanatuan Flyers Clubhouse, Sangitan East, Cabanatuan City, Nueva Ecija",
    },
    boarding: {
      startsAt: new Date("2026-05-16T19:00:00+08:00"),
      endsAt: new Date("2026-05-16T22:00:00+08:00"),
      location: "Cabanatuan Flyers Clubhouse Crate Area",
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
        plateNumber: "NUE-1501",
      },
      origin: {
        name: "Cabanatuan Flyers Clubhouse",
      },
    },
    departure: {
      siteName: "Guimba Release Site",
      coordinates: { latitude: 15.6606, longitude: 120.7683 },
      address: {
        municipality: "Guimba",
        province: "Nueva Ecija",
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
    raceKey: "cabanatuanTalavera100",
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
        name: "Cabanatuan Flyers Clubhouse Check-in",
        coordinates: { latitude: 15.4862, longitude: 120.9684 },
        address: {
          street: "Mabini Street",
          barangay: places.cabanatuan.barangay,
          city: places.cabanatuan.municipality,
          province: places.cabanatuan.province,
          region: places.cabanatuan.region,
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
    raceKey: "cabanatuanTalavera100",
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
        name: "Cabanatuan Flyers Clubhouse Check-in",
        coordinates: { latitude: 15.4862, longitude: 120.9684 },
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
    raceKey: "cabanatuanTalavera100",
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
        name: "Cabanatuan Flyers Clubhouse Check-in",
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
    raceKey: "cabanatuanGuimba150",
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

const accessRoleByManagementTitle = {
  Owner: 1,
  Secretary: 2,
};

const memberCodeByUserKey = {
  juan: "CFC-0001",
  maria: "CFC-0002",
  pedro: "CFC-0003",
  ana: "CFC-0004",
  carlo: "GHFC-0001",
  liza: "SJLMC-0001",
  roberto: "TRF-0001",
};

const resetSeedData = async () => {
  const seedEmails = userSeeds.map((user) => user.email);
  const seedClubCodes = clubSeeds.map((club) => club.code);
  const seedLoftCodes = loftSeeds.map((loft) => loft.code);
  const seedRaceCodes = raceSeeds.map((race) => race.code);
  const seedBirdBandNumbers = [
    ...new Set(raceEntrySeeds.map((entry) => entry.bird.bandNumber)),
  ];

  const [users, clubs, races] = await Promise.all([
    Users.find({ email: { $in: seedEmails } }).select("_id"),
    Clubs.find({ code: { $in: seedClubCodes } }).select("_id"),
    Races.find({ code: { $in: seedRaceCodes } }).select("_id"),
  ]);

  await Promise.all([
    Birds.deleteMany({ bandNumber: { $in: seedBirdBandNumbers } }),
    RaceEntries.deleteMany({ race: { $in: races.map((race) => race._id) } }),
    Races.deleteMany({ code: { $in: seedRaceCodes } }),
    ClubManagement.deleteMany({
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
    state: ["guest"],
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
      title: seed.managementTitle || "Racer",
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
    address: seed.location
      ? {
          street: `${seed.location.municipality || seed.location.province || "Club"} Clubhouse`,
          barangay:
            Object.values(places).find(
              (place) =>
                place.region === seed.location.region &&
                place.province === seed.location.province &&
                place.municipality === seed.location.municipality,
            )?.barangay || "",
          city: seed.location.municipality || "",
          province: seed.location.province || "",
          region: seed.location.region || "",
          zip:
            Object.values(places).find(
              (place) =>
                place.region === seed.location.region &&
                place.province === seed.location.province &&
                place.municipality === seed.location.municipality,
            )?.zip || "",
        }
      : undefined,
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
  const accessRole = accessRoleByManagementTitle[userSeed.managementTitle] || 1;

  const affiliation =
    (await Affiliations.findOne({ user: user._id, club: club._id })) ||
    new Affiliations();

  affiliation.set({
    user: user._id,
    club: club._id,
    memberCode: memberCodeByUserKey[userSeed.key],
    membershipType: "racer",
    roles: ["racer"],
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
    role: accessRole,
    portal: "club",
    access: [String(accessRole)],
  };
  await user.save();

  return affiliation;
};

const upsertManagementMember = async ({ userSeed, usersByKey, clubsByKey }) => {
  const user = usersByKey[userSeed.key];
  const club = clubsByKey[userSeed.clubKey];
  const managementMember =
    (await ClubManagement.findOne({
      user: user._id,
      club: club._id,
      title: userSeed.managementTitle,
    })) || new ClubManagement();

  managementMember.set({
    user: user._id,
    club: club._id,
    title: userSeed.managementTitle,
  });

  await managementMember.save();
  return managementMember;
};

const upsertBird = async ({
  seed,
  usersByKey,
  clubsByKey,
  loftsByKey,
  affiliationsByUserKey,
}) => {
  const user = usersByKey[seed.userKey];
  const affiliation = affiliationsByUserKey[seed.userKey];
  const club = clubsByKey[userSeeds.find((userSeed) => userSeed.key === seed.userKey)?.clubKey];
  const loft = loftsByKey[seed.loftKey];
  const bird = (await Birds.findOne({ bandNumber: seed.bird.bandNumber })) || new Birds();

  bird.set({
    ...seed.bird,
    owner: user._id,
    breeder: user._id,
    affiliation: affiliation._id,
    club: club._id,
    loft: loft._id,
    remarks: ["Seeded by seedAgilaTrack.js"],
    status: "active",
  });

  await bird.save();
  return bird;
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

  const managementMembers = [];
  for (const userSeed of userSeeds.filter((seed) => seed.managementTitle)) {
    managementMembers.push(
      await upsertManagementMember({ userSeed, usersByKey, clubsByKey }),
    );
  }

  const cabanatuanClub = clubsByKey.cabanatuan;
  cabanatuanClub.management = {
    owner: { user: usersByKey.juan._id },
    secretary: { user: usersByKey.maria._id },
  };
  cabanatuanClub.contacts = usersByKey.maria._id;
  await cabanatuanClub.save();

  const birdsByBandNumber = {};
  for (const raceEntrySeed of raceEntrySeeds) {
    if (!birdsByBandNumber[raceEntrySeed.bird.bandNumber]) {
      const bird = await upsertBird({
        seed: raceEntrySeed,
        usersByKey,
        clubsByKey,
        loftsByKey,
        affiliationsByUserKey,
      });

      birdsByBandNumber[raceEntrySeed.bird.bandNumber] = bird;
    }
  }

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

  await RaceEntries.recalculateRanks(racesByKey.cabanatuanTalavera100._id);

  console.log("Seed complete:");
  console.table({
    users: Object.keys(usersByKey).length,
    clubs: Object.keys(clubsByKey).length,
    lofts: Object.keys(loftsByKey).length,
    birds: Object.keys(birdsByBandNumber).length,
    affiliations: affiliations.length,
    managementMembers: managementMembers.length,
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
