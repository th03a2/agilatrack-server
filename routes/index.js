export const apiRoutes = [
  { path: "/", description: "API health and endpoint summary" },
  { path: "/api/routes", description: "List available API route groups" },
  { path: "/api/auth/login", description: "Authenticate users with email and password" },
  { path: "/api/upload/profile-photo", description: "Upload user profile photos to Cloudinary" },
  { path: "/api/upload/valid-id", description: "Upload valid ID images to Cloudinary" },
  { path: "/api/upload/club-logo", description: "Upload club logos to Cloudinary" },
  { path: "/api/upload/bird-image", description: "Upload bird images to Cloudinary" },
  { path: "/api/clubs", description: "Manage clubs, hierarchy, pyramid, children, and club details" },
  { path: "/api/crates", description: "Manage crate inventory, assignments, capacity, seals, and condition checks" },
  { path: "/api/lofts", description: "Manage lofts and loft location details" },
  { path: "/api/pigeons", description: "Manage pigeon profiles, ownership, pedigree, and health records" },
  { path: "/api/pegions", description: "Alias for /api/pigeons" },
  { path: "/api/users", description: "Manage users and user profiles" },
  { path: "/api/affiliations", description: "Manage user club memberships and racing profiles" },
  { path: "/api/officers", description: "Manage club officers and authorizations" },
  { path: "/api/races", description: "Manage race events, booking windows, and departure details" },
  { path: "/api/race-entries", description: "Manage race entry booking, check-in, boarding, departure, arrival, and ranking" },
];

export const logApiRoutes = () => {
  console.log("Available API routes:");
  console.table(apiRoutes.map(({ path, description }) => ({ path, description })));
};
