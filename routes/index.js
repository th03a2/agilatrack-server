const sharedRouteGroups = [
  { path: "/routes", description: "List available route groups exposed by the running server" },
  { path: "/health", description: "Return structured server and database health details" },
  { path: "/auth/login", description: "Authenticate users with email and password" },
  { path: "/auth/me", description: "Return the currently authenticated user" },
  {
    path: "/auth/send-verification-code",
    description: "Generate and deliver a guest registration email verification code",
  },
  {
    path: "/auth/verify-email-code",
    description: "Verify a guest registration email verification code",
  },
  { path: "/auth/register", description: "Create a guest user after email verification" },
  { path: "/auth/validateRefresh", description: "Validate an existing mobile or web auth session" },
  {
    path: "/commerce",
    description: "Dedicated commerce module for wallets, fees, receipts, and recharge approvals",
  },
  {
    path: "/commerce/shop/products",
    description: "Tenant-scoped club shop product catalog with role-based category visibility",
  },
  {
    path: "/commerce/shop/orders",
    description: "Tenant-scoped club shop order, checkout, payment, and fulfillment workflows",
  },
  {
    path: "/commerce/shop/fulfillment/scan",
    description: "Validate QR invoices before secretary fulfillment and pickup release",
  },
  {
    path: "/commerce/shop/analytics",
    description: "Owner and secretary e-commerce revenue, stock, and order analytics",
  },
  { path: "/clubs", description: "Manage clubs, hierarchy, pyramid, children, and club details" },
  { path: "/clubs/:clubId/applications", description: "Submit a guest application to join a club" },
  {
    path: "/club-applications",
    description: "Browse club applications with tenant-aware secretary access",
  },
  {
    path: "/club-applications/my",
    description: "Read the authenticated guest or member's club application status",
  },
  { path: "/club-applications/:id/approve", description: "Approve a pending club application" },
  { path: "/club-applications/:id/reject", description: "Reject a pending club application with a reason" },
  {
    path: "/club-management",
    description: "Manage club owners, secretaries, and club management records",
  },
  {
    path: "/owner-zone/:clubId/verify",
    description: "Re-authenticate a club owner before opening secure owner finance and store controls",
  },
  {
    path: "/owner-zone/:clubId/snapshot",
    description: "Fetch owner-only finance and e-commerce data filtered to one owned club",
  },
  {
    path: "/owner-zone/:clubId/audit-logs",
    description: "Read and record owner-zone audit events for one owned club",
  },
  {
    path: "/crates",
    description: "Manage crate inventory, assignments, capacity, seals, and condition checks",
  },
  { path: "/lofts", description: "Manage lofts and loft location details" },
  { path: "/birds", description: "Manage bird profiles, ownership, and pedigree details" },
  {
    path: "/birds/pending-approvals",
    description: "Review pending pigeon registration approvals by club scope",
  },
  {
    path: "/ahp",
    description: "Manage Avian Health Profile records, treatments, and health history",
  },
  { path: "/avian-health-profiles", description: "Alias for avian health profile management" },
  { path: "/pigeons", description: "Legacy alias for bird profile management" },
  { path: "/users", description: "Manage users and user profiles" },
  { path: "/affiliations", description: "Manage user club memberships and racing profiles" },
  {
    path: "/chatbot",
    description: "Deterministic chatbot endpoints for verified database-backed answers and suggestions",
  },
  {
    path: "/affiliations/club-dashboard/:clubId",
    description: "Fetch the live club membership dashboard for a specific club",
  },
  { path: "/affiliations/:id/approve", description: "Approve a pending club affiliation request" },
  { path: "/affiliations/:id/reject", description: "Reject a pending club affiliation request" },
  { path: "/affiliations/:id/assign-role", description: "Assign an initial club role to an affiliation" },
  { path: "/officers", description: "Legacy alias for club management officer records" },
  { path: "/races", description: "Manage race events, booking windows, and departure details" },
  { path: "/races/:raceId/book", description: "Book eligible pigeons into an open club race" },
  {
    path: "/races/:raceId/basketing/scan",
    description: "Scan or manually basket a booked bird with duplicate prevention",
  },
  {
    path: "/races/:raceId/liberate",
    description: "Record race liberation details and exact release time",
  },
  {
    path: "/races/:raceId/arrival",
    description: "Record or scan arrivals, compute velocity, and refresh rankings",
  },
  { path: "/races/:raceId/results", description: "Read computed race results and rankings" },
  { path: "/races/:raceId/results/publish", description: "Publish computed race results" },
  { path: "/races/:raceId/results/lock", description: "Lock finalized official race results" },
  {
    path: "/race-entries",
    description: "Manage race entry booking, check-in, boarding, departure, arrival, and ranking",
  },
  {
    path: "/wallets",
    description: "Manage coordinator and fancier wallets, load transfers, fees, and recharge requests",
  },
  {
    path: "/payments",
    description: "Read the live finance verification feed derived from wallet transactions",
  },
  {
    path: "/payouts",
    description: "Read live payout candidates derived from race results and rankings",
  },
  {
    path: "/products",
    description: "Read live inventory-like catalog records derived from crates and pigeon assets",
  },
  {
    path: "/orders",
    description: "Read live order-style transaction records derived from race entry bookings",
  },
  {
    path: "/sellers",
    description: "Read live seller directory records derived from club and contact data",
  },
  {
    path: "/shipments",
    description: "Read live shipment and race-logistics summaries derived from races and entries",
  },
  {
    path: "/support",
    description: "Read live technical and commerce watchlist items derived from current backend records",
  },
];

const prefixedRoutes = ["/api", "/nbi"].flatMap((prefix) =>
  sharedRouteGroups.map((route) => ({
    description: route.description,
    path: `${prefix}${route.path}`,
  })),
);

export const nbiRoutes = [
  { path: "/", description: "API health and endpoint summary" },
  { path: "/health", description: "Return structured server and database health details" },
  ...prefixedRoutes,
];

export const logNbiRoutes = () => {
  console.log("Available AgilaTrack routes:");
  console.table(nbiRoutes.map(({ path, description }) => ({ path, description })));
};
