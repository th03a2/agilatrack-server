export const apiRoutes = [
  { path: "/", description: "API health and endpoint summary" },
  { path: "/health", description: "Root health check" },
  { path: "/api/routes", description: "List available API route groups" },
  { path: "/api/auth/login", description: "Authenticate users with email and password" },
  { path: "/api/auth/me", description: "Validate the current session token" },
  { path: "/api/upload/profile-photo", description: "Upload user profile photos to Cloudinary" },
  { path: "/api/upload/valid-id", description: "Upload valid ID images to Cloudinary" },
  { path: "/api/upload/club-logo", description: "Upload club logos to Cloudinary" },
  { path: "/api/upload/bird-image", description: "Upload bird images to Cloudinary" },
  { path: "/api/upload/announcement-banner", description: "Upload announcement banners to Cloudinary" },
  { path: "/api/clubs", description: "Manage clubs, hierarchy, pyramid, children, and club details" },
  { path: "/api/crates", description: "Manage crate inventory, assignments, capacity, seals, and condition checks" },
  { path: "/api/lofts", description: "Manage lofts and loft location details" },
  { path: "/api/pigeons", description: "Manage pigeon profiles, ownership, pedigree, and health records" },
  { path: "/api/pegions", description: "Alias for /api/pigeons" },
  { path: "/api/users", description: "Manage users and user profiles" },
  { path: "/api/affiliations", description: "Manage user club memberships and racing profiles" },
  { path: "/api/officers", description: "Manage club officers and authorizations" },
  { path: "/api/orders", description: "Manage order records and race-entry transaction flows" },
  { path: "/api/payments", description: "Manage payment verification queues and finance records" },
  { path: "/api/payouts", description: "Manage payout records and result-based prize releases" },
  { path: "/api/products", description: "Manage product and inventory catalog records" },
  { path: "/api/races", description: "Manage race events, booking windows, and departure details" },
  { path: "/api/race-entries", description: "Manage race entry booking, check-in, boarding, departure, arrival, and ranking" },
  { path: "/api/sellers", description: "Manage seller directories and club commerce contacts" },
  { path: "/api/shipments", description: "Manage shipment and race-logistics records" },
  { path: "/api/support", description: "Manage support watchlists and operational tickets" },
];

export const logApiRoutes = () => {
  console.log("Available API routes:");
  console.table(apiRoutes.map(({ path, description }) => ({ path, description })));
};
