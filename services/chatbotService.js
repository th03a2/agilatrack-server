import crypto from "node:crypto";
import mongoose from "mongoose";
import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
import Races from "../models/Races.js";

const ACTIVE_RACE_STATUSES = [
  "booking_open",
  "booking_closed",
  "check_in",
  "boarding",
  "departed",
];

const MAX_SUGGESTIONS = 6;

const normalizeText = (value = "") => String(value || "").trim();
const normalizeFlag = (value = "") => normalizeText(value).toLowerCase();
const isObjectId = (value = "") =>
  mongoose.Types.ObjectId.isValid(String(value || "").trim());
const localize = (language, english, filipino) =>
  language === "fil" ? filipino : english;
const escapeRegex = (value = "") =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cleanupSearchTerm = (value = "") =>
  normalizeText(value)
    .replace(/^[,.:;!?-]+/, "")
    .replace(/[.?!,:;]+$/g, "")
    .replace(/^(ang|si|sa|yung|iyong)\s+/i, "")
    .trim();
const formatWords = (value = "") =>
  normalizeText(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "Unknown";
const formatClubLocation = (club = {}) =>
  [
    club?.location?.municipality,
    club?.location?.province,
    club?.location?.region,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(", ") || "Location not set";
const formatRaceLocation = (race = {}) =>
  [
    race?.departure?.siteName,
    race?.departure?.address?.municipality,
    race?.departure?.address?.province,
    race?.departure?.address?.region,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(", ") || "Departure site not set";
const formatDisplayName = (user = {}) =>
  [
    user?.fullName?.fname,
    user?.fullName?.mname,
    user?.fullName?.lname,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() || normalizeText(user?.name) || normalizeText(user?.email) || "Unknown User";

const getDateLocale = (language) => (language === "fil" ? "fil-PH" : "en-PH");
const formatDateLabel = (value, language) => {
  const parsed = new Date(value || "");

  if (Number.isNaN(parsed.getTime())) {
    return localize(language, "Not set", "Walang petsa");
  }

  try {
    return new Intl.DateTimeFormat(getDateLocale(language), {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsed);
  } catch {
    return parsed.toISOString().slice(0, 10);
  }
};

const getAuthTokenSecret = () =>
  normalizeText(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET) ||
  "agilatrack-dev-secret";
const signTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(payload)
    .digest("base64url");
const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");
const getTokenFromRequest = (req) => {
  const rawHeader = normalizeText(req.headers.authorization);

  if (!rawHeader) return "";
  if (/^QTracy\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^QTracy\s+/i, "").trim();
  }
  if (/^Bearer\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return rawHeader;
};
const verifySessionToken = (token) => {
  const [encodedPayload = "", signature = ""] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (signTokenPayload(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const issuedAt = Number(payload?.issuedAt || 0);
    const thirtyDays = 1000 * 60 * 60 * 24 * 30;

    if (!payload?.userId || !issuedAt || Date.now() - issuedAt > thirtyDays) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};
const resolveSessionUserId = (req) => {
  const session = verifySessionToken(getTokenFromRequest(req));
  return session?.userId ? String(session.userId) : "";
};

const FILIPINO_HINTS = [
  "filipino",
  "tagalog",
  "salamat",
  "kamusta",
  "kumusta",
  "ano",
  "ilan",
  "saan",
  "paano",
  "pwede",
  "maaari",
  "mga",
  "ang",
  "ng",
  "sa",
  "po",
  "ba",
  "lang",
  "kasapi",
  "ibon",
  "karera",
];

const detectLanguage = ({ explicitLanguage = "", message = "" }) => {
  const normalizedLanguage = normalizeFlag(explicitLanguage);
  const normalizedMessage = normalizeFlag(message);

  if (normalizedLanguage === "fil" || normalizedLanguage === "en") {
    return normalizedLanguage;
  }

  if (/\b(filipino|tagalog|pilipino)\b/.test(normalizedMessage)) {
    return "fil";
  }

  const hitCount = FILIPINO_HINTS.filter((hint) =>
    new RegExp(`(^|\\b)${escapeRegex(hint)}(\\b|$)`, "i").test(normalizedMessage),
  ).length;

  return hitCount >= 2 ? "fil" : "en";
};

const CLUB_LEVEL_TRANSLATIONS = {
  municipality: "municipal",
  provincial: "probinsyal",
  regional: "rehiyonal",
  national: "pambansa",
};

const STATUS_TRANSLATIONS = {
  active: "aktibo",
  approved: "approved",
  boarding: "boarding",
  booking_closed: "sarado ang booking",
  booking_open: "bukas ang booking",
  cancelled: "cancelled",
  check_in: "check-in",
  completed: "tapos",
  declined: "declined",
  deactivated: "deactivated",
  departed: "umalis na",
  draft: "draft",
  pending: "pending",
  rejected: "rejected",
  suspended: "suspendido",
};

const formatClubLevelLabel = (level, language) =>
  localize(language, formatWords(level), CLUB_LEVEL_TRANSLATIONS[normalizeFlag(level)] || formatWords(level));
const formatStatusLabel = (status, language) =>
  localize(
    language,
    formatWords(status),
    STATUS_TRANSLATIONS[normalizeFlag(status)] || formatWords(status),
  );
const formatRoleLabel = (roles = [], membershipType = "", language = "en") => {
  const rawRole = Array.isArray(roles) ? roles[0] || membershipType : roles || membershipType;
  const normalizedRole = normalizeFlag(rawRole);
  const englishLabel =
    {
      owner: "Owner",
      "assistant-admin": "Assistant Admin",
      "club-officer": "Club Officer",
      "club-staff": "Club Staff",
      "race-participant": "Race Participant",
      "regular-member": "Regular Member",
      racer: "Race Participant",
    }[normalizedRole] || formatWords(rawRole || "member");

  return localize(
    language,
    englishLabel,
    {
      Owner: "May-ari",
      "Assistant Admin": "Assistant Admin",
      "Club Officer": "Opisyal ng Club",
      "Club Staff": "Staff ng Club",
      "Race Participant": "Kalahok sa Race",
      "Regular Member": "Regular na Miyembro",
    }[englishLabel] || englishLabel,
  );
};

const normalizeScope = (value = "") =>
  ["landing", "platform"].includes(normalizeFlag(value))
    ? normalizeFlag(value)
    : "landing";
const canViewProtectedData = ({ scope, sessionUserId }) =>
  scope === "platform" && Boolean(sessionUserId);
const buildClubFilter = (clubId) =>
  isObjectId(clubId) ? { club: clubId } : {};

const makeSuggestion = ({ id, label, query, type }) => ({
  id,
  label,
  query,
  type,
});

const dedupeSuggestions = (suggestions = []) => {
  const seen = new Set();

  return suggestions.filter((suggestion) => {
    const key = normalizeFlag(suggestion?.query || suggestion?.label || "");

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const buildStaticSuggestions = ({
  clubId,
  language,
  protectedDataAllowed,
}) => {
  const items = [
    makeSuggestion({
      id: "clubs-active",
      label: localize(
        language,
        "How many active clubs are there?",
        "Ilang active clubs ang meron?",
      ),
      query: localize(
        language,
        "How many active clubs are there?",
        "Ilang active clubs ang meron?",
      ),
      type: "suggestion",
    }),
    makeSuggestion({
      id: "races-latest",
      label: localize(
        language,
        clubId ? "Show the latest races in this club" : "Show the latest races",
        clubId
          ? "Ipakita ang pinakabagong races sa club na ito"
          : "Ipakita ang pinakabagong races",
      ),
      query: localize(
        language,
        clubId ? "Show the latest races in this club" : "Show the latest races",
        clubId
          ? "Ipakita ang pinakabagong races sa club na ito"
          : "Ipakita ang pinakabagong races",
      ),
      type: "suggestion",
    }),
    makeSuggestion({
      id: "races-active",
      label: localize(
        language,
        clubId ? "What active races are in this club?" : "What active races are there?",
        clubId
          ? "Anong active races ang nasa club na ito?"
          : "Anong active races ang meron?",
      ),
      query: localize(
        language,
        clubId ? "What active races are in this club?" : "What active races are there?",
        clubId
          ? "Anong active races ang nasa club na ito?"
          : "Anong active races ang meron?",
      ),
      type: "suggestion",
    }),
  ];

  if (protectedDataAllowed) {
    items.push(
      makeSuggestion({
        id: "members-approved",
        label: localize(
          language,
          clubId
            ? "How many approved members are in this club?"
            : "How many approved members are there?",
          clubId
            ? "Ilang approved members ang nasa club na ito?"
            : "Ilang approved members ang meron?",
        ),
        query: localize(
          language,
          clubId
            ? "How many approved members are in this club?"
            : "How many approved members are there?",
          clubId
            ? "Ilang approved members ang nasa club na ito?"
            : "Ilang approved members ang meron?",
        ),
        type: "suggestion",
      }),
      makeSuggestion({
        id: "members-pending",
        label: localize(
          language,
          clubId
            ? "Show pending members in this club"
            : "Show pending members",
          clubId
            ? "Ipakita ang pending members sa club na ito"
            : "Ipakita ang pending members",
        ),
        query: localize(
          language,
          clubId
            ? "Show pending members in this club"
            : "Show pending members",
          clubId
            ? "Ipakita ang pending members sa club na ito"
            : "Ipakita ang pending members",
        ),
        type: "suggestion",
      }),
      makeSuggestion({
        id: "birds-count",
        label: localize(
          language,
          clubId
            ? "How many birds are registered in this club?"
            : "How many birds are registered?",
          clubId
            ? "Ilang ibon ang naka-register sa club na ito?"
            : "Ilang ibon ang naka-register?",
        ),
        query: localize(
          language,
          clubId
            ? "How many birds are registered in this club?"
            : "How many birds are registered?",
          clubId
            ? "Ilang ibon ang naka-register sa club na ito?"
            : "Ilang ibon ang naka-register?",
        ),
        type: "suggestion",
      }),
    );
  }

  return items;
};

const buildClubSuggestionQuery = (club, language) =>
  localize(
    language,
    `Show club ${club.code || club.name}`,
    `Ipakita ang club ${club.code || club.name}`,
  );
const buildRaceSuggestionQuery = (race, language) =>
  localize(
    language,
    `Show race ${race.code || race.name}`,
    `Ipakita ang race ${race.code || race.name}`,
  );
const buildBirdSuggestionQuery = (bird, language) =>
  localize(
    language,
    `Show bird ${bird.bandNumber || bird.name}`,
    `Ipakita ang ibon ${bird.bandNumber || bird.name}`,
  );
const buildMemberSuggestionQuery = (affiliation, language) =>
  localize(
    language,
    `Show member code ${affiliation.memberCode}`,
    `Ipakita ang member code ${affiliation.memberCode}`,
  );

const findClubSuggestions = async ({ query, language }) => {
  const search = cleanupSearchTerm(query);
  const filter = {
    deletedAt: { $exists: false },
  };

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { code: regex }, { abbr: regex }];
  }

  const clubs = await Clubs.find(filter)
    .select("name code abbr")
    .sort(search ? { name: 1 } : { createdAt: -1 })
    .limit(2)
    .lean();

  return clubs.map((club) =>
    makeSuggestion({
      id: `club:${club._id}`,
      label: localize(
        language,
        `Club: ${club.name} (${club.code})`,
        `Club: ${club.name} (${club.code})`,
      ),
      query: buildClubSuggestionQuery(club, language),
      type: "club",
    }),
  );
};

const findRaceSuggestions = async ({ clubId, query, language }) => {
  const search = cleanupSearchTerm(query);
  const filter = {
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  };

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { code: regex }];
  }

  const races = await Races.find(filter)
    .select("name code status raceDate")
    .sort(search ? { raceDate: -1, name: 1 } : { raceDate: -1, createdAt: -1 })
    .limit(2)
    .lean();

  return races.map((race) =>
    makeSuggestion({
      id: `race:${race._id}`,
      label: localize(
        language,
        `Race: ${race.name} (${race.code})`,
        `Race: ${race.name} (${race.code})`,
      ),
      query: buildRaceSuggestionQuery(race, language),
      type: "race",
    }),
  );
};

const findBirdSuggestions = async ({ clubId, query, language }) => {
  const search = cleanupSearchTerm(query);
  const filter = {
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  };

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ bandNumber: regex }, { name: regex }];
  }

  const birds = await Birds.find(filter)
    .select("bandNumber name")
    .sort(search ? { bandNumber: 1 } : { createdAt: -1 })
    .limit(2)
    .lean();

  return birds.map((bird) =>
    makeSuggestion({
      id: `bird:${bird._id}`,
      label: localize(
        language,
        `Bird: ${bird.bandNumber}${bird.name ? ` - ${bird.name}` : ""}`,
        `Ibon: ${bird.bandNumber}${bird.name ? ` - ${bird.name}` : ""}`,
      ),
      query: buildBirdSuggestionQuery(bird, language),
      type: "bird",
    }),
  );
};

const findMemberSuggestions = async ({ clubId, query, language }) => {
  const search = cleanupSearchTerm(query);
  const filter = {
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  };

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.memberCode = regex;
  } else {
    filter.status = "pending";
  }

  const affiliations = await Affiliations.find(filter)
    .select("memberCode")
    .sort({ createdAt: -1 })
    .limit(2)
    .lean();

  return affiliations
    .filter((affiliation) => normalizeText(affiliation?.memberCode))
    .map((affiliation) =>
      makeSuggestion({
        id: `member:${affiliation._id}`,
        label: localize(
          language,
          `Member Code: ${affiliation.memberCode}`,
          `Member Code: ${affiliation.memberCode}`,
        ),
        query: buildMemberSuggestionQuery(affiliation, language),
        type: "member",
      }),
    );
};

const buildSuggestions = async ({
  clubId,
  language,
  protectedDataAllowed,
  query,
}) => {
  const dynamicLists = await Promise.all([
    findClubSuggestions({ language, query }),
    findRaceSuggestions({ clubId, language, query }),
    ...(protectedDataAllowed
      ? [
          findBirdSuggestions({ clubId, language, query }),
          findMemberSuggestions({ clubId, language, query }),
        ]
      : []),
  ]);

  return dedupeSuggestions([
    ...buildStaticSuggestions({ clubId, language, protectedDataAllowed }),
    ...dynamicLists.flat(),
  ]).slice(0, MAX_SUGGESTIONS);
};

const buildReply = ({
  answer,
  language,
  suggestions = [],
  verified = true,
}) => ({
  answer,
  language,
  suggestions,
  verified,
});

const extractMatch = (message, patterns = []) => {
  for (const pattern of patterns) {
    const matched = String(message || "").match(pattern);

    if (matched?.[1]) {
      return cleanupSearchTerm(matched[1]);
    }
  }

  return "";
};

const shouldCountActiveClubs = (message) =>
  /\b(how many active clubs|active club count|ilang active clubs|ilang club ang active)\b/i.test(
    message,
  );
const shouldListClubs = (message) =>
  /\b(show clubs|list clubs|club list|mga club|ipakita ang mga club)\b/i.test(message);
const shouldCountRaces = (message) =>
  /\b(how many races|race count|ilang race|ilang karera)\b/i.test(message);
const shouldShowLatestRaces = (message) =>
  /\b(show the latest races|show latest races|latest races|recent races|pinakabagong races|pinakabagong race)\b/i.test(
    message,
  );
const shouldShowActiveRaces = (message) =>
  /\b(active races|ongoing races|current races|anong active races|mga active race)\b/i.test(
    message,
  );
const shouldCountBirds = (message) =>
  /\b(how many birds|how many pigeons|bird count|pigeon count|ilang ibon)\b/i.test(
    message,
  );
const shouldCountApprovedMembers = (message) =>
  /\b(how many approved members|how many members|member count|approved member count|ilang approved members|ilang members)\b/i.test(
    message,
  );
const shouldShowPendingMembers = (message) =>
  /\b(show pending members|pending members|pending join requests|mga pending members|ipakita ang pending members)\b/i.test(
    message,
  );
const needsProtectedData = (message) =>
  /\b(member code|member|members|kasapi|ibon|bird|birds|pigeon|pigeons)\b/i.test(message);

const extractClubQuery = (message) =>
  extractMatch(message, [
    /\b(?:show|find|about|lookup|details for)\s+club\s+(.+)$/i,
    /\b(?:ipakita|hanapin|detalye ng)\s+(?:ang\s+)?club\s+(.+)$/i,
    /\bclub\s+(.+)$/i,
  ]);
const extractRaceQuery = (message) =>
  extractMatch(message, [
    /\b(?:show|find|about|lookup|details for)\s+race\s+(.+)$/i,
    /\b(?:ipakita|hanapin|detalye ng)\s+(?:ang\s+)?race\s+(.+)$/i,
    /\brace\s+(.+)$/i,
  ]);
const extractBirdQuery = (message) =>
  extractMatch(message, [
    /\b(?:show|find|about|lookup|details for)\s+(?:bird|pigeon)\s+(.+)$/i,
    /\b(?:ipakita|hanapin|detalye ng)\s+(?:ang\s+)?(?:ibon|bird|pigeon)\s+(.+)$/i,
    /\b(?:bird|pigeon|ibon)\s+(.+)$/i,
  ]);
const extractMemberQuery = (message) =>
  extractMatch(message, [
    /\b(?:show|find|about|lookup|details for)\s+member code\s+(.+)$/i,
    /\b(?:show|find|about|lookup|details for)\s+member\s+(.+)$/i,
    /\b(?:ipakita|hanapin|detalye ng)\s+(?:ang\s+)?member code\s+(.+)$/i,
    /\bmember code\s+(.+)$/i,
    /\bmember\s+(.+)$/i,
    /\bkasapi\s+(.+)$/i,
  ]);

const findClubMatches = async (query) => {
  const search = cleanupSearchTerm(query);

  if (!search) {
    return [];
  }

  const exact = new RegExp(`^${escapeRegex(search)}$`, "i");
  const partial = new RegExp(escapeRegex(search), "i");

  return Clubs.find({
    deletedAt: { $exists: false },
    $or: [{ name: exact }, { code: exact }, { abbr: exact }],
  })
    .select("name code abbr level type location status isActive")
    .limit(5)
    .lean()
    .then((exactMatches) => {
      if (exactMatches.length > 0) {
        return exactMatches;
      }

      return Clubs.find({
        deletedAt: { $exists: false },
        $or: [{ name: partial }, { code: partial }, { abbr: partial }],
      })
        .select("name code abbr level type location status isActive")
        .sort({ name: 1 })
        .limit(5)
        .lean();
    });
};

const findRaceMatches = async ({ clubId, query }) => {
  const search = cleanupSearchTerm(query);

  if (!search) {
    return [];
  }

  const exact = new RegExp(`^${escapeRegex(search)}$`, "i");
  const partial = new RegExp(escapeRegex(search), "i");
  const clubFilter = buildClubFilter(clubId);

  const exactMatches = await Races.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    $or: [{ name: exact }, { code: exact }],
  })
    .select("name code status raceDate departure club")
    .populate("club", "name code abbr")
    .limit(5)
    .lean();

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return Races.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    $or: [{ name: partial }, { code: partial }],
  })
    .select("name code status raceDate departure club")
    .populate("club", "name code abbr")
    .sort({ raceDate: -1, name: 1 })
    .limit(5)
    .lean();
};

const findBirdMatches = async ({ clubId, query }) => {
  const search = cleanupSearchTerm(query);

  if (!search) {
    return [];
  }

  const exact = new RegExp(`^${escapeRegex(search)}$`, "i");
  const partial = new RegExp(escapeRegex(search), "i");
  const clubFilter = buildClubFilter(clubId);

  const exactMatches = await Birds.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    $or: [{ bandNumber: exact }, { name: exact }],
  })
    .select("bandNumber name status club")
    .populate("club", "name code abbr")
    .limit(5)
    .lean();

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return Birds.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    $or: [{ bandNumber: partial }, { name: partial }],
  })
    .select("bandNumber name status club")
    .populate("club", "name code abbr")
    .sort({ bandNumber: 1 })
    .limit(5)
    .lean();
};

const findMemberMatches = async ({ clubId, query }) => {
  const search = cleanupSearchTerm(query);

  if (!search) {
    return [];
  }

  const exact = new RegExp(`^${escapeRegex(search)}$`, "i");
  const partial = new RegExp(escapeRegex(search), "i");
  const clubFilter = buildClubFilter(clubId);

  const exactMatches = await Affiliations.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    memberCode: exact,
  })
    .select("memberCode status membershipType roles user club")
    .populate("user", "fullName name email")
    .populate("club", "name code abbr")
    .limit(5)
    .lean();

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return Affiliations.find({
    deletedAt: { $exists: false },
    ...clubFilter,
    memberCode: partial,
  })
    .select("memberCode status membershipType roles user club")
    .populate("user", "fullName name email")
    .populate("club", "name code abbr")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
};

const buildNoVerifiedAnswer = (language) =>
  localize(
    language,
    "I can only answer verified database questions right now. Try a club, race, bird, or member code question from the suggestions.",
    "Mga verified na tanong mula sa database lang ang masasagot ko ngayon. Subukan ang tanong tungkol sa club, race, ibon, o member code mula sa suggestions.",
  );

const buildProtectedAnswer = (language) =>
  localize(
    language,
    "Please sign in to view verified bird and member records.",
    "Mag-sign in muna para makita ang verified na bird at member records.",
  );

const buildClubCountAnswer = async (language) => {
  const count = await Clubs.countDocuments({
    deletedAt: { $exists: false },
    isActive: true,
  });

  return localize(
    language,
    `There are ${count} active clubs in the database.`,
    `May ${count} active clubs sa database.`,
  );
};

const buildClubListAnswer = async (language) => {
  const clubs = await Clubs.find({
    deletedAt: { $exists: false },
    isActive: true,
  })
    .select("name code")
    .sort({ name: 1 })
    .limit(5)
    .lean();

  if (!clubs.length) {
    return localize(
      language,
      "No verified club records were found.",
      "Walang nahanap na verified na club records.",
    );
  }

  const list = clubs.map((club) => `${club.name} (${club.code})`).join("; ");

  return localize(
    language,
    `I found ${clubs.length} verified clubs: ${list}.`,
    `May ${clubs.length} verified na clubs: ${list}.`,
  );
};

const buildClubDetailAnswer = async ({ language, query }) => {
  const matches = await findClubMatches(query);

  if (!matches.length) {
    return localize(
      language,
      "No verified club matched that search.",
      "Walang verified na club na tumugma sa hanap na iyon.",
    );
  }

  if (matches.length === 1) {
    const club = matches[0];
    const location = formatClubLocation(club);

    return localize(
      language,
      `${club.name} (${club.code}) is a ${formatWords(club.level)} ${formatWords(club.type)} club in ${location}. Status: ${formatWords(club.status)}. Active: ${club.isActive ? "Yes" : "No"}.`,
      `${club.name} (${club.code}) ay isang ${formatClubLevelLabel(club.level, language)} ${formatWords(club.type)} club sa ${location}. Status: ${formatStatusLabel(club.status, language)}. Active: ${club.isActive ? "Oo" : "Hindi"}.`,
    );
  }

  const list = matches.map((club) => `${club.name} (${club.code})`).join("; ");

  return localize(
    language,
    `I found ${matches.length} verified club matches: ${list}.`,
    `May ${matches.length} verified na tugma sa club: ${list}.`,
  );
};

const buildRaceCountAnswer = async ({ clubId, language }) => {
  const count = await Races.countDocuments({
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  });

  return localize(
    language,
    `There are ${count} verified races in the database${isObjectId(clubId) ? " for this club" : ""}.`,
    `May ${count} verified na races sa database${isObjectId(clubId) ? " para sa club na ito" : ""}.`,
  );
};

const buildLatestRacesAnswer = async ({ clubId, language }) => {
  const races = await Races.find({
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  })
    .select("name code status raceDate club")
    .populate("club", "name code abbr")
    .sort({ raceDate: -1, createdAt: -1 })
    .limit(5)
    .lean();

  if (!races.length) {
    return localize(
      language,
      "No verified races were found.",
      "Walang nahanap na verified na races.",
    );
  }

  const list = races
    .map(
      (race) =>
        `${race.name} (${race.code}) - ${formatStatusLabel(race.status, language)}, ${formatDateLabel(race.raceDate, language)}`,
    )
    .join("; ");

  return localize(
    language,
    `Here are the latest verified races: ${list}.`,
    `Narito ang pinakabagong verified na races: ${list}.`,
  );
};

const buildActiveRacesAnswer = async ({ clubId, language }) => {
  const races = await Races.find({
    deletedAt: { $exists: false },
    status: { $in: ACTIVE_RACE_STATUSES },
    ...buildClubFilter(clubId),
  })
    .select("name code status raceDate")
    .sort({ raceDate: -1, createdAt: -1 })
    .limit(5)
    .lean();

  if (!races.length) {
    return localize(
      language,
      "No active verified races were found.",
      "Walang active verified races na nahanap.",
    );
  }

  const list = races
    .map(
      (race) =>
        `${race.name} (${race.code}) - ${formatStatusLabel(race.status, language)}, ${formatDateLabel(race.raceDate, language)}`,
    )
    .join("; ");

  return localize(
    language,
    `I found ${races.length} active verified races: ${list}.`,
    `May ${races.length} active verified races: ${list}.`,
  );
};

const buildRaceDetailAnswer = async ({ clubId, language, query }) => {
  const matches = await findRaceMatches({ clubId, query });

  if (!matches.length) {
    return localize(
      language,
      "No verified race matched that search.",
      "Walang verified na race na tumugma sa hanap na iyon.",
    );
  }

  if (matches.length === 1) {
    const race = matches[0];

    return localize(
      language,
      `${race.name} (${race.code}) is ${formatStatusLabel(race.status, language)}. Race date: ${formatDateLabel(race.raceDate, language)}. Club: ${normalizeText(race?.club?.name || race?.club?.abbr || race?.club?.code)}. Departure: ${formatRaceLocation(race)}.`,
      `${race.name} (${race.code}) ay ${formatStatusLabel(race.status, language)}. Petsa ng race: ${formatDateLabel(race.raceDate, language)}. Club: ${normalizeText(race?.club?.name || race?.club?.abbr || race?.club?.code)}. Departure: ${formatRaceLocation(race)}.`,
    );
  }

  const list = matches.map((race) => `${race.name} (${race.code})`).join("; ");

  return localize(
    language,
    `I found ${matches.length} verified race matches: ${list}.`,
    `May ${matches.length} verified na tugma sa race: ${list}.`,
  );
};

const buildBirdCountAnswer = async ({ clubId, language }) => {
  const count = await Birds.countDocuments({
    deletedAt: { $exists: false },
    ...buildClubFilter(clubId),
  });

  return localize(
    language,
    `There are ${count} verified bird records${isObjectId(clubId) ? " in this club" : ""}.`,
    `May ${count} verified na bird records${isObjectId(clubId) ? " sa club na ito" : ""}.`,
  );
};

const buildBirdDetailAnswer = async ({ clubId, language, query }) => {
  const matches = await findBirdMatches({ clubId, query });

  if (!matches.length) {
    return localize(
      language,
      "No verified bird matched that search.",
      "Walang verified na ibon na tumugma sa hanap na iyon.",
    );
  }

  if (matches.length === 1) {
    const bird = matches[0];

    return localize(
      language,
      `${bird.bandNumber}${bird.name ? ` (${bird.name})` : ""} has status ${formatStatusLabel(bird.status, language)}. Club: ${normalizeText(bird?.club?.name || bird?.club?.abbr || bird?.club?.code) || "Not set"}.`,
      `${bird.bandNumber}${bird.name ? ` (${bird.name})` : ""} ay may status na ${formatStatusLabel(bird.status, language)}. Club: ${normalizeText(bird?.club?.name || bird?.club?.abbr || bird?.club?.code) || "Walang club"}.`,
    );
  }

  const list = matches
    .map((bird) => `${bird.bandNumber}${bird.name ? ` - ${bird.name}` : ""}`)
    .join("; ");

  return localize(
    language,
    `I found ${matches.length} verified bird matches: ${list}.`,
    `May ${matches.length} verified na tugma sa ibon: ${list}.`,
  );
};

const buildApprovedMembersAnswer = async ({ clubId, language }) => {
  const count = await Affiliations.countDocuments({
    deletedAt: { $exists: false },
    status: "approved",
    ...buildClubFilter(clubId),
  });

  return localize(
    language,
    `There are ${count} approved member records${isObjectId(clubId) ? " in this club" : ""}.`,
    `May ${count} approved member records${isObjectId(clubId) ? " sa club na ito" : ""}.`,
  );
};

const buildPendingMembersAnswer = async ({ clubId, language }) => {
  const pending = await Affiliations.find({
    deletedAt: { $exists: false },
    status: "pending",
    ...buildClubFilter(clubId),
  })
    .select("memberCode status user club")
    .populate("user", "fullName name email")
    .populate("club", "name code abbr")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  if (!pending.length) {
    return localize(
      language,
      "There are no pending verified member records right now.",
      "Walang pending verified member records ngayon.",
    );
  }

  const list = pending
    .map((record) => {
      const memberCode = normalizeText(record.memberCode) || "No member code";
      const fullName = formatDisplayName(record.user);
      return `${memberCode} - ${fullName}`;
    })
    .join("; ");

  return localize(
    language,
    `I found ${pending.length} pending verified member records: ${list}.`,
    `May ${pending.length} pending verified member records: ${list}.`,
  );
};

const buildMemberDetailAnswer = async ({ clubId, language, query }) => {
  const matches = await findMemberMatches({ clubId, query });

  if (!matches.length) {
    return localize(
      language,
      "No verified member record matched that search.",
      "Walang verified na member record na tumugma sa hanap na iyon.",
    );
  }

  if (matches.length === 1) {
    const affiliation = matches[0];

    return localize(
      language,
      `Member code ${affiliation.memberCode} belongs to ${formatDisplayName(affiliation.user)}. Club: ${normalizeText(affiliation?.club?.name || affiliation?.club?.abbr || affiliation?.club?.code)}. Status: ${formatStatusLabel(affiliation.status, language)}. Role: ${formatRoleLabel(affiliation.roles, affiliation.membershipType, language)}.`,
      `Ang member code na ${affiliation.memberCode} ay para kay ${formatDisplayName(affiliation.user)}. Club: ${normalizeText(affiliation?.club?.name || affiliation?.club?.abbr || affiliation?.club?.code)}. Status: ${formatStatusLabel(affiliation.status, language)}. Role: ${formatRoleLabel(affiliation.roles, affiliation.membershipType, language)}.`,
    );
  }

  const list = matches.map((affiliation) => affiliation.memberCode).join("; ");

  return localize(
    language,
    `I found ${matches.length} verified member matches: ${list}.`,
    `May ${matches.length} verified na tugma sa member: ${list}.`,
  );
};

const buildLanguageSwitchReply = (message, language) => {
  if (/\b(english)\b/i.test(message)) {
    return buildReply({
      answer: "English replies are enabled for this chat.",
      language: "en",
      verified: true,
    });
  }

  return buildReply({
    answer: localize(
      language,
      "Filipino replies are enabled for this chat.",
      "Filipino na ang replies sa chat na ito.",
    ),
    language,
    verified: true,
  });
};

const isLanguageSwitchCommand = (message) =>
  /\b(filipino|tagalog|pilipino)\b.*\b(lang|only|sagot|reply)\b/i.test(message) ||
  /\benglish\b.*\b(lang|only|reply)\b/i.test(message);

const sendError = (res, error, status = 500) =>
  res.status(status).json({ error: error.message || "Chatbot request failed." });

export const getSuggestions = async (req, res) => {
  try {
    const query = normalizeText(req.query?.q);
    const clubId = normalizeText(req.query?.clubId);
    const scope = normalizeScope(req.query?.scope);
    const sessionUserId = resolveSessionUserId(req);
    const language = detectLanguage({
      explicitLanguage: req.query?.language,
      message: query,
    });
    const payload = await buildSuggestions({
      clubId,
      language,
      protectedDataAllowed: canViewProtectedData({ scope, sessionUserId }),
      query,
    });

    return res.json({
      success: "Chatbot suggestions fetched successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error);
  }
};

export const queryChatbot = async (req, res) => {
  try {
    const message = normalizeText(req.body?.message);

    if (!message) {
      return res.status(400).json({ error: "Chat message is required." });
    }

    const clubId = normalizeText(req.body?.clubId);
    const scope = normalizeScope(req.body?.scope);
    const sessionUserId = resolveSessionUserId(req);
    const language = detectLanguage({
      explicitLanguage: req.body?.language,
      message,
    });
    const protectedDataAllowed = canViewProtectedData({ scope, sessionUserId });

    if (isLanguageSwitchCommand(message)) {
      const payload = buildLanguageSwitchReply(message, language);
      payload.suggestions = await buildSuggestions({
        clubId,
        language: payload.language,
        protectedDataAllowed,
        query: "",
      });

      return res.json({
        success: "Chatbot response generated successfully",
        payload,
      });
    }

    if (!protectedDataAllowed && needsProtectedData(message)) {
      const payload = buildReply({
        answer: buildProtectedAnswer(language),
        language,
        suggestions: await buildSuggestions({
          clubId,
          language,
          protectedDataAllowed,
          query: "",
        }),
        verified: true,
      });

      return res.json({
        success: "Chatbot response generated successfully",
        payload,
      });
    }

    let answer = "";

    // Only supported intents return database-backed answers.
    if (shouldCountActiveClubs(message)) {
      answer = await buildClubCountAnswer(language);
    } else if (shouldListClubs(message)) {
      answer = await buildClubListAnswer(language);
    } else if (shouldCountRaces(message)) {
      answer = await buildRaceCountAnswer({ clubId, language });
    } else if (shouldShowLatestRaces(message)) {
      answer = await buildLatestRacesAnswer({ clubId, language });
    } else if (shouldShowActiveRaces(message)) {
      answer = await buildActiveRacesAnswer({ clubId, language });
    } else if (protectedDataAllowed && shouldCountBirds(message)) {
      answer = await buildBirdCountAnswer({ clubId, language });
    } else if (protectedDataAllowed && shouldCountApprovedMembers(message)) {
      answer = await buildApprovedMembersAnswer({ clubId, language });
    } else if (protectedDataAllowed && shouldShowPendingMembers(message)) {
      answer = await buildPendingMembersAnswer({ clubId, language });
    } else {
      const clubQuery = extractClubQuery(message);
      const raceQuery = extractRaceQuery(message);
      const birdQuery = extractBirdQuery(message);
      const memberQuery = extractMemberQuery(message);

      if (clubQuery && !shouldCountActiveClubs(message) && !shouldListClubs(message)) {
        answer = await buildClubDetailAnswer({ language, query: clubQuery });
      } else if (
        raceQuery &&
        !shouldCountRaces(message) &&
        !shouldShowLatestRaces(message) &&
        !shouldShowActiveRaces(message)
      ) {
        answer = await buildRaceDetailAnswer({ clubId, language, query: raceQuery });
      } else if (protectedDataAllowed && birdQuery && !shouldCountBirds(message)) {
        answer = await buildBirdDetailAnswer({ clubId, language, query: birdQuery });
      } else if (
        protectedDataAllowed &&
        memberQuery &&
        !shouldCountApprovedMembers(message) &&
        !shouldShowPendingMembers(message)
      ) {
        answer = await buildMemberDetailAnswer({ clubId, language, query: memberQuery });
      } else {
        answer = buildNoVerifiedAnswer(language);
      }
    }

    const payload = buildReply({
      answer,
      language,
      suggestions: await buildSuggestions({
        clubId,
        language,
        protectedDataAllowed,
        query: "",
      }),
      verified: true,
    });

    return res.json({
      success: "Chatbot response generated successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error);
  }
};
