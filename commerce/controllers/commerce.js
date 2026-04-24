import mongoose from "mongoose";
import Affiliations from "../../models/Affiliations.js";
import Clubs from "../../models/Clubs.js";
import Birds from "../../models/Birds.js";
import Races from "../../models/Races.js";
import Users from "../../models/Users.js";
import CommerceFeeProfiles from "../models/CommerceFeeProfiles.js";
import CommerceReceipts from "../models/CommerceReceipts.js";
import CommerceWallets from "../models/CommerceWallets.js";

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
    .populate("transactions.approvedBy", "fullName email mobile pid")
    .populate("transactions.counterpartyWallet", "user ownerType balance status")
    .populate("transactions.receipt", "receiptNumber amount status type createdAt")
    .populate("transactions.pigeon", "bandNumber name sex color strain status")
    .populate("transactions.race", "name code category raceDate status");

const populateReceipt = (query) =>
  query
    .populate("wallet", "user ownerType balance status")
    .populate("user", "fullName email mobile pid")
    .populate("club", "name code abbr level location")
    .populate("issuedBy", "fullName email mobile pid");

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

const buildReceiptQuery = (query = {}) => {
  const { wallet, club, user, type, status } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (wallet) dbQuery.wallet = wallet;
  if (club) dbQuery.club = club;
  if (user) dbQuery.user = user;
  if (type) dbQuery.type = type;
  if (status) dbQuery.status = status;

  return dbQuery;
};

const buildFeeProfileQuery = (query = {}) => {
  const { club, feeType, isActive } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (club) dbQuery.club = club;
  if (feeType) dbQuery.feeType = feeType;
  if (isActive !== undefined) dbQuery.isActive = isActive === "true";

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

const buildReference = (prefix) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

const ensureUser = async (id) => {
  ensureObjectId(id, "User");
  const entity = await Users.findById(id);

  if (!entity || !entity.isActive) {
    throw new Error("User not found.");
  }

  return entity;
};

const ensureClub = async (id) => {
  if (!id) return null;

  ensureObjectId(id, "Club");
  const entity = await Clubs.findById(id);

  if (!entity || entity.deletedAt) {
    throw new Error("Club not found.");
  }

  return entity;
};

const ensureAffiliation = async (id) => {
  if (!id) return null;

  ensureObjectId(id, "Affiliation");
  const entity = await Affiliations.findById(id);

  if (!entity || entity.deletedAt) {
    throw new Error("Affiliation not found.");
  }

  return entity;
};

const ensureRace = async (id) => {
  if (!id) return null;

  ensureObjectId(id, "Race");
  const entity = await Races.findById(id);

  if (!entity || entity.deletedAt) {
    throw new Error("Race not found.");
  }

  return entity;
};

const ensureBird = async (id) => {
  if (!id) return null;

  ensureObjectId(id, "Bird");
  const entity = await Birds.findById(id);

  if (!entity || entity.deletedAt) {
    throw new Error("Bird not found.");
  }

  return entity;
};

const ensureWallet = async (id) => {
  ensureObjectId(id, "Wallet");
  const entity = await CommerceWallets.findById(id);

  if (!entity || entity.deletedAt) {
    throw new Error("Wallet not found.");
  }

  if (entity.status !== "active") {
    throw new Error("Wallet is not active.");
  }

  return entity;
};

const ensureFeeProfile = async ({ club, feeType }) => {
  const entity = await CommerceFeeProfiles.findOne({
    club,
    feeType,
    isActive: true,
    deletedAt: { $exists: false },
  });

  if (!entity) {
    throw new Error(`No active ${feeType} fee profile found for this club.`);
  }

  return entity;
};

const issueReceipt = async ({
  wallet,
  transaction,
  amount,
  type,
  label,
  issuedBy,
  notes,
}) => {
  const receipt = await CommerceReceipts.create({
    receiptNumber: buildReference("OR"),
    referenceNumber: transaction.referenceNumber,
    wallet: wallet._id,
    transactionId: transaction._id,
    user: wallet.user,
    club: wallet.club,
    type,
    items: [{ label, amount, quantity: 1 }],
    amount,
    currency: wallet.currency,
    notes,
    issuedBy,
  });

  transaction.receipt = receipt._id;
  return receipt;
};

const loadWalletPayload = async (walletId) =>
  populateWallet(CommerceWallets.findById(walletId)).lean({ virtuals: true });

export const getCommerceSummary = async (req, res) => {
  try {
    const [wallets, receipts, feeProfiles] = await Promise.all([
      CommerceWallets.countDocuments({ deletedAt: { $exists: false } }),
      CommerceReceipts.countDocuments({ deletedAt: { $exists: false } }),
      CommerceFeeProfiles.countDocuments({ deletedAt: { $exists: false } }),
    ]);

    res.json({
      success: "Commerce summary fetched successfully",
      payload: {
        wallets,
        receipts,
        feeProfiles,
        routeBase: "/api/commerce",
      },
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findWallets = async (req, res) => {
  try {
    const payload = await populateWallet(
      CommerceWallets.find(buildWalletQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Commerce wallets fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findWallet = async (req, res) => {
  try {
    const payload = await populateWallet(
      CommerceWallets.findById(req.params.walletId),
    ).lean({ virtuals: true });

    if (!payload || payload.deletedAt) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json({ success: "Commerce wallet fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createWallet = async (req, res) => {
  try {
    const {
      user,
      club,
      affiliation,
      ownerType,
      openingBalance,
      initiatedBy,
      settings,
    } = req.body;

    await ensureUser(user);
    const clubEntity = await ensureClub(club);
    const affiliationEntity = await ensureAffiliation(affiliation);
    if (!clubEntity && !affiliationEntity?.club) {
      throw new Error("Club is required when affiliation has no club.");
    }

    const wallet = new CommerceWallets({
      user,
      club: club || affiliationEntity?.club,
      affiliation,
      ownerType,
      settings,
    });

    const initialAmount = Number(openingBalance || 0);
    if (initialAmount > 0) {
      wallet.applyTransaction({
        referenceNumber: buildReference("TXN"),
        type: "opening_balance",
        direction: "credit",
        amount: initialAmount,
        description: "Opening wallet balance for commerce operations.",
        initiatedBy,
        club: wallet.club,
        affiliation: wallet.affiliation,
      });
    }

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.status(201).json({ success: "Commerce wallet created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const preloadWallet = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.walletId);
    const amount = ensurePositiveAmount(req.body.amount, "Preload amount");

    const transaction = wallet.applyTransaction({
      referenceNumber: buildReference("TXN"),
      type: "preload",
      direction: "credit",
      amount,
      description:
        req.body.description || "Coordinator wallet preload / recharge.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      gcashReference: req.body.gcashReference,
      remarks: req.body.remarks,
      meta: req.body.meta,
    });

    if (wallet.settings?.autoIssueReceipt) {
      await issueReceipt({
        wallet,
        transaction,
        amount,
        type: "preload",
        label: "Wallet preload",
        issuedBy: req.body.initiatedBy,
        notes: req.body.description,
      });
    }

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Commerce wallet preloaded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const transferLoad = async (req, res) => {
  try {
    const sourceWallet = await ensureWallet(req.params.walletId);
    const targetWallet = await ensureWallet(req.body.targetWalletId);
    const amount = ensurePositiveAmount(req.body.amount, "Transfer amount");

    if (String(sourceWallet._id) === String(targetWallet._id)) {
      throw new Error("Source and target wallet must be different.");
    }

    if (!sourceWallet.settings?.allowTransfers) {
      throw new Error("This wallet is not allowed to transfer load.");
    }

    if (
      sourceWallet.club &&
      targetWallet.club &&
      String(sourceWallet.club) !== String(targetWallet.club)
    ) {
      throw new Error("Transfer is only allowed within the same club.");
    }

    sourceWallet.applyTransaction({
      referenceNumber: buildReference("TXN"),
      type: "load_transfer",
      direction: "debit",
      amount,
      description:
        req.body.description ||
        "Load transfer sent by coordinator after GCash confirmation.",
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

    const inbound = targetWallet.applyTransaction({
      referenceNumber: buildReference("TXN"),
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

    if (targetWallet.settings?.autoIssueReceipt) {
      await issueReceipt({
        wallet: targetWallet,
        transaction: inbound,
        amount,
        type: "load_transfer",
        label: "Load received",
        issuedBy: req.body.initiatedBy,
        notes: req.body.targetDescription,
      });
    }

    await Promise.all([sourceWallet.save(), targetWallet.save()]);

    const payload = {
      sourceWallet: await loadWalletPayload(sourceWallet._id),
      targetWallet: await loadWalletPayload(targetWallet._id),
    };

    res.json({ success: "Commerce load transfer completed successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

const chargeFee = async ({
  wallet,
  feeType,
  classification,
  amount,
  description,
  initiatedBy,
  race,
  pigeon,
  meta,
}) => {
  const resolvedAmount =
    amount ||
    (
      await ensureFeeProfile({
        club: wallet.club,
        feeType,
      })
    ).resolveAmount(classification);

  const transaction = wallet.applyTransaction({
    referenceNumber: buildReference("TXN"),
    type: feeType === "bird_registration" ? "bird_registration_fee" : "race_fee",
    direction: "debit",
    amount: resolvedAmount,
    description,
    initiatedBy,
    club: wallet.club,
    affiliation: wallet.affiliation,
    classification,
    race,
    pigeon,
    meta,
  });

  if (wallet.settings?.autoIssueReceipt) {
    await issueReceipt({
      wallet,
      transaction,
      amount: resolvedAmount,
      type: feeType,
      label:
        feeType === "bird_registration" ? "Bird registration fee" : "Race fee",
      issuedBy: initiatedBy,
      notes: description,
    });
  }

  return transaction;
};

export const chargeBirdRegistrationFee = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.walletId);
    const pigeon = await ensureBird(req.body.pigeon || req.body.bird);

    await chargeFee({
      wallet,
      feeType: "bird_registration",
      classification: req.body.classification,
      amount: req.body.amount ? ensurePositiveAmount(req.body.amount) : null,
      description:
        req.body.description || "Bird registration fee charged to wallet.",
      initiatedBy: req.body.initiatedBy,
      pigeon: pigeon?._id,
      meta: req.body.meta,
    });

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
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
    const wallet = await ensureWallet(req.params.walletId);
    const race = await ensureRace(req.body.race);

    await chargeFee({
      wallet,
      feeType: "race",
      classification: req.body.classification,
      amount: req.body.amount ? ensurePositiveAmount(req.body.amount) : null,
      description: req.body.description || "Race fee charged to wallet.",
      initiatedBy: req.body.initiatedBy,
      race: race?._id,
      meta: {
        entryCount: req.body.entryCount,
        ...req.body.meta,
      },
    });

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Race fee charged successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const requestRecharge = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.walletId);
    const amount = ensurePositiveAmount(req.body.amount, "Recharge amount");

    wallet.transactions.push({
      referenceNumber: buildReference("REQ"),
      type: "recharge_request",
      direction: "credit",
      status: "pending",
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      description:
        req.body.description ||
        "Recharge requested and waiting for coordinator/admin call approval.",
      initiatedBy: req.body.initiatedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      gcashReference: req.body.gcashReference,
      requiresCall: wallet.settings?.requireCallForRechargeApproval !== false,
      remarks: req.body.remarks,
      meta: {
        contactNumber: req.body.contactNumber,
        ...req.body.meta,
      },
    });

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Recharge request recorded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const approveRecharge = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.walletId);
    const transaction = wallet.transactions.id(req.params.transactionId);

    if (!transaction) {
      return res.status(404).json({ error: "Recharge request not found" });
    }

    if (transaction.type !== "recharge_request" || transaction.status !== "pending") {
      throw new Error("Only pending recharge requests can be approved.");
    }

    transaction.status = "approved";
    transaction.approvedBy = req.body.approvedBy;
    transaction.remarks = req.body.remarks || transaction.remarks;

    const approval = wallet.applyTransaction({
      referenceNumber: buildReference("TXN"),
      type: "recharge_approval",
      direction: "credit",
      amount: transaction.amount,
      description:
        req.body.description ||
        "Recharge approved after coordinator/admin call confirmation.",
      initiatedBy: transaction.initiatedBy,
      approvedBy: req.body.approvedBy,
      club: wallet.club,
      affiliation: wallet.affiliation,
      gcashReference: transaction.gcashReference,
      meta: {
        sourceRequestId: transaction._id,
        ...req.body.meta,
      },
    });

    if (wallet.settings?.autoIssueReceipt) {
      await issueReceipt({
        wallet,
        transaction: approval,
        amount: transaction.amount,
        type: "recharge_approval",
        label: "Recharge approval",
        issuedBy: req.body.approvedBy,
        notes: req.body.description,
      });
    }

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Recharge approved successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const rejectRecharge = async (req, res) => {
  try {
    const wallet = await ensureWallet(req.params.walletId);
    const transaction = wallet.transactions.id(req.params.transactionId);

    if (!transaction) {
      return res.status(404).json({ error: "Recharge request not found" });
    }

    if (transaction.type !== "recharge_request" || transaction.status !== "pending") {
      throw new Error("Only pending recharge requests can be rejected.");
    }

    transaction.status = "rejected";
    transaction.approvedBy = req.body.approvedBy;
    transaction.remarks = req.body.remarks || "Recharge request rejected.";

    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Recharge rejected successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateWallet = async (req, res) => {
  try {
    const wallet = await CommerceWallets.findById(req.params.walletId);
    if (!wallet || wallet.deletedAt) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    wallet.set(req.body);
    await wallet.save();

    const payload = await loadWalletPayload(wallet._id);
    res.json({ success: "Commerce wallet updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteWallet = async (req, res) => {
  try {
    const payload = await populateWallet(
      CommerceWallets.findByIdAndUpdate(
        req.params.walletId,
        { deletedAt: new Date().toISOString(), status: "closed" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    res.json({ success: "Commerce wallet closed successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findFeeProfiles = async (req, res) => {
  try {
    const payload = await CommerceFeeProfiles.find(buildFeeProfileQuery(req.query))
      .populate("club", "name code abbr level location")
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Commerce fee profiles fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createOrUpdateFeeProfile = async (req, res) => {
  try {
    await ensureClub(req.body.club);

    const payload = await CommerceFeeProfiles.findOneAndUpdate(
      {
        club: req.body.club,
        feeType: req.body.feeType,
      },
      {
        ...req.body,
        deletedAt: undefined,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate("club", "name code abbr level location")
      .lean({ virtuals: true });

    res.status(201).json({
      success: "Commerce fee profile saved successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findReceipts = async (req, res) => {
  try {
    const payload = await populateReceipt(
      CommerceReceipts.find(buildReceiptQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Commerce receipts fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findReceipt = async (req, res) => {
  try {
    const payload = await populateReceipt(
      CommerceReceipts.findById(req.params.receiptId),
    ).lean({ virtuals: true });

    if (!payload || payload.deletedAt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json({ success: "Commerce receipt fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
