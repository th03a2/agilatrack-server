import crypto from "node:crypto";
import Users from "../models/Users.js";
import Affiliations from "../models/Affiliations.js";

const USER_SELECT =
  "_id email fullName activePlatform membership state mobile isActive createdAt updatedAt";

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await Users.findByEmail(email);

    if (!user || user.isActive === false) {
      return sendInvalidCredentials(res);
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendInvalidCredentials(res);
    }

    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });
    const affiliations = await Affiliations.find({
      user: user._id,
      deletedAt: { $exists: false },
      status: "approved",
    })
      .populate("club", "name code abbr level location")
      .select("_id club memberCode membershipType roles status")
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true });

    res.json({
      success: "Login successful",
      payload: {
        user: payload,
        affiliations,
        token: crypto.randomBytes(32).toString("hex"),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};
