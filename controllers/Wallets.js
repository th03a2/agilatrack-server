import mongoose from "mongoose";
import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";
import Wallets from "../models/Wallets.js";
import {
  canAccessTenantClub,
  canManageTenantClub,
  denyTenantAccess,
  getPrimaryTenantClubId,
  normalizeTenantId,
  scopeQueryToTenant,
} from "../middleware/tenantIsolation.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateWallet = (query) =>
  query
    .populate("user", "fullName email mobile pid")
    .populate("club", "name code abbr level location")
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles user club primaryLoft",
      populate: [
        { path: "user", select: "fullName email mobile pid" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("transactions.initiatedBy", "fullName email mobile pid")
    .populate("transactions.counterpartyWallet", "user ownerType balance status")
    .populate("transactions.bird", "bandNumber name sex color strain status")
    .populate("transactions.race", "name code category raceDate status");

const buildWalletQuery = (query = {}) => {
  const { user, club, affiliation, ownerType, status } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (user) dbQuery.user = user;
  if (club) dbQuery.club = club;
  if (affiliation) dbQuery.affiliation = affiliation;
  if (ownerType) dbQuery.ownerType = ownerType;
  if (status) dbQuery.status = status;

  return dbQuery;
};

const ensureObjectId = (value, label) => {
  if (value && !mongoose.Types.ObjectId.isValid(value)) {
    throw new Error(`${label} is invalid.`);
  }
};

const ensurePositiveAmount = (value, label = "Amount") => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return amount;
};

const ensureWallet = async (walletId) => {
  ensureObjectId(walletId, "Wallet");

  const wallet = await Wallets.findById(walletId);
  if (!wallet || wallet.deletedAt) {
    throw new Error("Wallet not found.");
  }

  if (wallet.status !== "active") {
    throw new Error("Wallet is not active.");
  }

  return wallet;
};

const ensureUser = async (userId) => {
  ensureObjectId(userId, "User");

  const user = await Users.findById(userId);
  if (!user || !user.isActive) {
    throw new Error("User not found.");
  }

  return user;
};

const ensureAffiliation = async (affiliationId) => {
  if (!affiliationId) return null;

  ensureObjectId(affiliationId, "Affiliation");
  const affiliation = await Affiliations.findById(affiliationId);

  if (!affiliation || affiliation.deletedAt) {
    throw new Error("Affiliation not found.");
  }

  return affiliation;
};

const ensureRace = async (raceId) => {
  if (!raceId) return null;

  ensureObjectId(raceId, "Race");
  const race = await Races.findById(raceId);

  if (!race || race.deletedAt) {
    throw new Error("Race not found.");
  }

  return race;
};

const ensureBird = async (birdId) => {
  if (!birdId) return null;

  ensureObjectId(birdId, "Bird");
  const bird = await Birds.findById(birdId);

  if (!bird || bird.deletedAt) {
    throw new Error("Bird not found.");
  }

  return bird;
};

const saveWalletAndRespond = async (walletId) =>
  populateWallet(Wallets.findById(walletId)).lean({ virtuals: true });

const assertWalletTenantAccess = async (req, res, wallet, { manage = false } = {}) => {
  const clubId = normalizeTenantId(wallet?.club);
  const isOwnWallet = normalizeTenantId(wallet?.user) === normalizeTenantId(req.auth?.userId);
  const allowed = manage
    ? canManageTenantClub(req.auth, clubId)
    : isOwnWallet || canAccessTenantClub(req.auth, clubId);

  if (!allowed) {
    await denyTenantAccess(req, res, {
      attemptedClubId: clubId,
      reason: manage
        ? "Wallet action attempted outside the authenticated user's managed club."
        : "Wallet request targeted another club.",
    });
    return false;
  }

  return true;
};

export const findAll = async (req, res) => {
  try {
    const dbQuery = buildWalletQuery(req.query);
    const allowed = await scopeQueryToTenant(req, res, dbQuery, {
      field: "club",
      requestedClubId: req.query?.club || req.query?.clubId,
    });

    if (!allowed) {
      return null;
    }

    const payload = await populateWallet(Wallets.find(dbQuery))
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Wallets fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateWallet(Wallets.findById(req.params.id)).lean({
      virtuals: true,
    });

    if (!payload || payload.deletedAt) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    if (!canAccessTenantClub(req.auth, normalizeTenantId(payload.club))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: normalizeTenantId(payload.club),
        reason: "Wallet detail request targeted another club.",
      });
    }

    res.json({ success: "Wallet fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createWallet = async (req, res) => {
  try {
    const {
      user,
      ownerType,
      club,
      affiliation,
      openingBalance,
      initiatedBy,
      ...rest
    } = req.body;

    await ensureUser(user);
    const linkedAffiliation = await ensureAffiliation(affiliation);
    const targetClubId =
      normalizeTenantId(club) ||
      normalizeTenantId(linkedAffiliation?.club) ||
      getPrimaryTenantClubId(req.auth);
    ensureObjectId(targetClubId, "Club");
    ensureObjectId(initiatedBy, "Initiated by");

    if (
      linkedAffiliation?.club &&
      normalizeTenantId(linkedAffiliation.club) !== targetClubId
    ) {
      throw new Error("Wallet affiliation club must match the wallet club.");
    }

    const isSelfWallet = normalizeTenantId(user) === normalizeTenantId(req.auth?.userId);

    if (!canManageTenantClub(req.auth, targetClubId) && !(isSelfWallet && canAccessTenantClub(req.auth, targetClubId))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: targetClubId,
        reason: "Wallet creation attempted outside the authenticated user's tenant.",
      });
    }

    const wallet = new Wallets({
      user,
      ownerType,
      club: targetClubId,
      affiliation,
      ...rest,
    });

    const initialAmount = Number(openingBalance || 0);
    if (initialAmount > 0) {
      wallet.addTransaction({
        type: "opening_balance",
        direction: "credit",
        amount: initialAmount,
        description:
          req.body.description || "Initial wallet funding for operational use.",
        initiatedBy,
        club: wallet.club,
        affiliation: wallet.affiliation,
      });
    }

    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.status(201).json({ success: "Wallet created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const preloadWallet = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.id);
    const allowed = await assertWalletTenantAccess(req, res, wallet, { manage: true });

    if (!allowed) {
      return null;
    }

    const amount = ensurePositiveAmount(req.body.amount, "Preload amount");

    wallet.addTransaction({
      type: "preload",
      direction: "credit",
      amount,
      description:
        req.body.description || "Coordinator wallet preload / recharge.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      gcashReference: req.body.gcashReference,
      meta: req.body.meta,
    });

    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.json({ success: "Wallet preloaded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const transferLoad = async (req, res) => {
  try {
    const sourceWallet = await ensureWallet(req.params.id);
    const targetWallet = await ensureWallet(req.body.targetWalletId);
    const amount = ensurePositiveAmount(req.body.amount, "Transfer amount");

    const canUseSource = await assertWalletTenantAccess(req, res, sourceWallet, { manage: true });
    const canUseTarget = canUseSource
      ? await assertWalletTenantAccess(req, res, targetWallet, { manage: true })
      : false;

    if (!canUseSource || !canUseTarget) {
      return null;
    }

    if (String(sourceWallet._id) === String(targetWallet._id)) {
      throw new Error("Source and target wallet must be different.");
    }

    if (!sourceWallet.settings?.allowTransfers) {
      throw new Error("Source wallet is not allowed to transfer load.");
    }

    if (sourceWallet.club && targetWallet.club) {
      if (String(sourceWallet.club) !== String(targetWallet.club)) {
        throw new Error("Wallet transfers are only allowed within the same club.");
      }
    }

    sourceWallet.addTransaction({
      type: "load_transfer",
      direction: "debit",
      amount,
      description:
        req.body.description ||
        "Load transfer sent to fancier wallet after GCash confirmation.",
      initiatedBy: req.body.initiatedBy,
      counterpartyWallet: targetWallet._id,
      club: sourceWallet.club,
      affiliation: sourceWallet.affiliation,
      gcashReference: req.body.gcashReference,
      meta: {
        paymentChannel: req.body.paymentChannel || "gcash",
        ...req.body.meta,
      },
    });

    targetWallet.addTransaction({
      type: "load_transfer",
      direction: "credit",
      amount,
      description:
        req.body.targetDescription ||
        "Load received from coordinator wallet.",
      initiatedBy: req.body.initiatedBy,
      counterpartyWallet: sourceWallet._id,
      club: targetWallet.club,
      affiliation: targetWallet.affiliation,
      gcashReference: req.body.gcashReference,
      meta: {
        paymentChannel: req.body.paymentChannel || "gcash",
        ...req.body.meta,
      },
    });

    await Promise.all([sourceWallet.save(), targetWallet.save()]);

    const payload = {
      sourceWallet: await saveWalletAndRespond(sourceWallet._id),
      targetWallet: await saveWalletAndRespond(targetWallet._id),
    };

    res.json({ success: "Load transferred successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const chargeBirdRegistrationFee = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.id);
    const allowed = await assertWalletTenantAccess(req, res, wallet);

    if (!allowed) {
      return null;
    }

    const amount = ensurePositiveAmount(
      req.body.amount || wallet.settings?.defaultBirdRegistrationFee,
      "Bird registration fee",
    );
    const bird = await ensureBird(req.body.pigeon || req.body.bird);

    if (bird && normalizeTenantId(bird.club || bird.clubId) !== normalizeTenantId(wallet.club)) {
      throw new Error("Bird registration fee must stay within the wallet club.");
    }

    wallet.addTransaction({
      type: "bird_registration_fee",
      direction: "debit",
      amount,
      description:
        req.body.description ||
        "Bird registration fee charged to wallet balance.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      bird: bird?._id,
      classification: req.body.classification,
      meta: {
        registrationType: req.body.registrationType,
        ...req.body.meta,
      },
    });

    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.json({
      success: "Bird registration fee charged successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const chargeRaceFee = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.id);
    const allowed = await assertWalletTenantAccess(req, res, wallet);

    if (!allowed) {
      return null;
    }

    const amount = ensurePositiveAmount(req.body.amount, "Race fee");
    const race = await ensureRace(req.body.race);

    if (race && normalizeTenantId(race.club) !== normalizeTenantId(wallet.club)) {
      throw new Error("Race fee must stay within the wallet club.");
    }

    wallet.addTransaction({
      type: "race_fee",
      direction: "debit",
      amount,
      description:
        req.body.description || "Race fee charged to wallet balance.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      race: race?._id,
      classification: req.body.classification,
      meta: {
        entryCount: req.body.entryCount,
        ...req.body.meta,
      },
    });

    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.json({ success: "Race fee charged successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const requestRecharge = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.id);
    const allowed = await assertWalletTenantAccess(req, res, wallet);

    if (!allowed) {
      return null;
    }

    const amount = ensurePositiveAmount(req.body.amount, "Recharge amount");

    wallet.transactions.push({
      type: "recharge_request",
      direction: "credit",
      amount,
      status: "pending",
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      description:
        req.body.description ||
        "Recharge requested. Coordinator must call admin before approval.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      gcashReference: req.body.gcashReference,
      requiresCall: true,
      meta: {
        contactNumber: req.body.contactNumber,
        ...req.body.meta,
      },
    });

    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.json({ success: "Recharge request recorded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateWallet = async (req, res) => {
  try {
    const wallet = await Wallets.findById(req.params.id);
    if (!wallet || wallet.deletedAt) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const allowed = await assertWalletTenantAccess(req, res, wallet);

    if (!allowed) {
      return null;
    }

    wallet.set({
      ...req.body,
      club: wallet.club,
    });
    await wallet.save();

    const payload = await saveWalletAndRespond(wallet._id);
    res.json({ success: "Wallet updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteWallet = async (req, res) => {
  try {
    const wallet = await Wallets.findById(req.params.id).select("club user").lean();

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    const allowed = await assertWalletTenantAccess(req, res, wallet, { manage: true });

    if (!allowed) {
      return null;
    }

    const payload = await populateWallet(
      Wallets.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "closed" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json({ success: "Wallet closed successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
