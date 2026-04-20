export const apiRoutes = [
  { method: "GET", path: "/", description: "API health and endpoint summary" },

  { method: "GET", path: "/api/routes", description: "List available API routes" },

  { method: "GET", path: "/api/clubs", description: "List clubs" },
  { method: "GET", path: "/api/clubs/meta/levels", description: "List club hierarchy levels" },
  { method: "GET", path: "/api/clubs/pyramid", description: "Fetch full club pyramid" },
  { method: "GET", path: "/api/clubs/:id/tree", description: "Fetch club subtree" },
  { method: "GET", path: "/api/clubs/:id/children", description: "Fetch direct child clubs" },
  { method: "GET", path: "/api/clubs/:id", description: "Fetch one club" },
  { method: "POST", path: "/api/clubs", description: "Create club" },
  { method: "PUT", path: "/api/clubs/:id", description: "Update club" },
  { method: "DELETE", path: "/api/clubs/:id", description: "Archive club" },

  { method: "GET", path: "/api/lofts", description: "List lofts" },
  { method: "GET", path: "/api/lofts/:id", description: "Fetch one loft" },
  { method: "POST", path: "/api/lofts", description: "Create loft" },
  { method: "PUT", path: "/api/lofts/:id", description: "Update loft" },
  { method: "DELETE", path: "/api/lofts/:id", description: "Archive loft" },

  { method: "GET", path: "/api/users", description: "List users" },
  { method: "GET", path: "/api/users/:id", description: "Fetch one user" },
  { method: "POST", path: "/api/users", description: "Create user" },
  { method: "PUT", path: "/api/users/:id", description: "Update user" },
  { method: "DELETE", path: "/api/users/:id", description: "Deactivate user" },

  { method: "GET", path: "/api/affiliations", description: "List affiliations" },
  { method: "GET", path: "/api/affiliations/:id", description: "Fetch one affiliation" },
  { method: "POST", path: "/api/affiliations", description: "Create affiliation" },
  { method: "PUT", path: "/api/affiliations/:id", description: "Update affiliation" },
  { method: "DELETE", path: "/api/affiliations/:id", description: "Archive affiliation" },

  { method: "GET", path: "/api/officers", description: "List officers" },
  { method: "GET", path: "/api/officers/:id", description: "Fetch one officer" },
  { method: "POST", path: "/api/officers", description: "Create officer" },
  { method: "PUT", path: "/api/officers/:id", description: "Update officer" },
  { method: "DELETE", path: "/api/officers/:id", description: "Archive officer" },
];

export const logApiRoutes = () => {
  console.log("Available API routes:");
  console.table(apiRoutes);
};
