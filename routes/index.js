export const nbiRoutes = [
  { path: "/", description: "API health and endpoint summary" },
  { path: "/nbi/routes", description: "List available NBI route groups" },
  { path: "/nbi/auth/login", description: "Authenticate users with email and password" },
  { path: "/nbi/commerce", description: "Dedicated commerce module for wallets, fees, receipts, and recharge approvals" },
  { path: "/nbi/clubs", description: "Manage clubs, hierarchy, pyramid, children, and club details" },
  { path: "/nbi/club-management", description: "Manage club owners, secretaries, and club management records" },
  { path: "/nbi/crates", description: "Manage crate inventory, assignments, capacity, seals, and condition checks" },
  { path: "/nbi/lofts", description: "Manage lofts and loft location details" },
  { path: "/nbi/birds", description: "Manage bird profiles, ownership, pedigree, and health records" },
  { path: "/nbi/pigeons", description: "Legacy alias for /nbi/birds" },
  { path: "/nbi/pegions", description: "Legacy alias for /nbi/birds" },
  { path: "/nbi/users", description: "Manage users and user profiles" },
  { path: "/nbi/affiliations", description: "Manage user club memberships and racing profiles" },
  { path: "/nbi/officers", description: "Legacy alias for /nbi/club-management" },
  { path: "/nbi/races", description: "Manage race events, booking windows, and departure details" },
  { path: "/nbi/race-entries", description: "Manage race entry booking, check-in, boarding, departure, arrival, and ranking" },
  { path: "/nbi/wallets", description: "Manage coordinator and fancier wallets, load transfers, fees, and recharge requests" },
];

export const logNbiRoutes = () => {
  console.log("Available NBI routes:");
  console.table(nbiRoutes.map(({ path, description }) => ({ path, description })));
};
