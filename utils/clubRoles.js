import { normalizeFlag, normalizeText } from "./auth.js";

const ROLE_PRIORITY = [
  "owner",
  "secretary",
  "operator",
  "assistant-admin",
  "club-officer",
  "club-staff",
  "race-participant",
  "regular-member",
  "fancier",
  "member",
  "guest",
];

const MANAGEMENT_TITLE_ALIASES = {
  "assistant admin": "assistant-admin",
  "assistant-admin": "assistant-admin",
  "club officer": "club-officer",
  "club owner": "owner",
  "club secretary": "secretary",
  "club staff": "club-staff",
  coordinator: "operator",
  convoyer: "operator",
  fancier: "fancier",
  guest: "guest",
  member: "member",
  operator: "operator",
  organizer: "operator",
  owner: "owner",
  racer: "race-participant",
  "race operator": "operator",
  "race participant": "race-participant",
  "regular member": "regular-member",
  secretary: "secretary",
};

const CLUB_MANAGEMENT_ROLE_BY_PATH = {
  coordinator: "operator",
  owner: "owner",
  secretary: "secretary",
};

export const normalizeClubRoleLabel = (value = "") => {
  const normalizedValue = normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  return MANAGEMENT_TITLE_ALIASES[normalizedValue] || normalizedValue;
};

const sortRolesByPriority = (roles = []) =>
  [...roles].sort((left, right) => {
    const leftPriority = ROLE_PRIORITY.indexOf(left);
    const rightPriority = ROLE_PRIORITY.indexOf(right);
    const leftRank = leftPriority === -1 ? ROLE_PRIORITY.length : leftPriority;
    const rightRank = rightPriority === -1 ? ROLE_PRIORITY.length : rightPriority;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.localeCompare(right);
  });

const resolveClubId = (club = null) =>
  club && typeof club === "object" ? String(club?._id || "") : String(club || "");

const buildClubManagementTitlesByClubId = (records = []) =>
  records.reduce((map, record) => {
    const clubId = resolveClubId(record?.club);
    const nextRole = normalizeClubRoleLabel(record?.title || record?.authorization);

    if (!clubId || !nextRole) {
      return map;
    }

    const existingRoles = map.get(clubId) || [];
    map.set(clubId, [...existingRoles, nextRole]);
    return map;
  }, new Map());

const deriveClubStructureRoles = ({ affiliation = {}, userId = "" } = {}) => {
  const clubManagement = affiliation?.club?.management;

  if (!clubManagement || !userId) {
    return [];
  }

  return Object.entries(CLUB_MANAGEMENT_ROLE_BY_PATH).flatMap(([pathKey, role]) => {
    const relatedUser =
      clubManagement?.[pathKey]?.user && typeof clubManagement[pathKey].user === "object"
        ? clubManagement[pathKey].user?._id
        : clubManagement?.[pathKey]?.user;

    return String(relatedUser || "") === String(userId) ? [role] : [];
  });
};

export const resolveAffiliationRoles = ({
  affiliation = {},
  clubManagementRecords = [],
  userId = "",
} = {}) => {
  const clubId = resolveClubId(affiliation?.club);
  const clubManagementTitlesByClubId = buildClubManagementTitlesByClubId(clubManagementRecords);
  const explicitRoles = [
    ...(Array.isArray(affiliation?.roles) ? affiliation.roles : []),
    affiliation?.membershipType,
  ]
    .map((role) => normalizeClubRoleLabel(role))
    .filter(Boolean);
  const derivedRoles = [
    ...deriveClubStructureRoles({ affiliation, userId }),
    ...((clubId && clubManagementTitlesByClubId.get(clubId)) || []),
  ]
    .map((role) => normalizeClubRoleLabel(role))
    .filter(Boolean);

  const roles = sortRolesByPriority(
    Array.from(new Set([...explicitRoles, ...derivedRoles].filter(Boolean))),
  );

  if (roles.length > 0) {
    return roles;
  }

  return [normalizeClubRoleLabel(affiliation?.membershipType || "guest") || "guest"];
};

export const resolvePrimaryAffiliationRole = ({
  affiliation = {},
  clubManagementRecords = [],
  userId = "",
} = {}) =>
  resolveAffiliationRoles({
    affiliation,
    clubManagementRecords,
    userId,
  })[0] || "guest";

export const hydrateAffiliationsWithDerivedRoles = ({
  affiliations = [],
  clubManagementRecords = [],
  userId = "",
} = {}) =>
  affiliations.map((affiliation) => ({
    ...affiliation,
    roles: resolveAffiliationRoles({
      affiliation,
      clubManagementRecords,
      userId,
    }),
  }));

export const isApprovedOrPendingClubState = (status = "") =>
  ["approved", "pending"].includes(normalizeFlag(status));
