import express from "express";
import {
  approveRecharge,
  chargeBirdRegistrationFee,
  chargeRaceFee,
  createOrUpdateFeeProfile,
  createWallet,
  deleteWallet,
  findFeeProfiles,
  findReceipt,
  findReceipts,
  findWallet,
  findWallets,
  getCommerceSummary,
  preloadWallet,
  rejectRecharge,
  requestRecharge,
  transferLoad,
  updateWallet,
} from "./controllers/commerce.js";

const router = express.Router();

router.get("/", getCommerceSummary);

router.get("/wallets", findWallets);
router.get("/wallets/:walletId", findWallet);
router.post("/wallets", createWallet);
router.put("/wallets/:walletId", updateWallet);
router.put("/wallets/:walletId/preload", preloadWallet);
router.put("/wallets/:walletId/transfer", transferLoad);
router.put("/wallets/:walletId/fees/bird-registration", chargeBirdRegistrationFee);
router.put("/wallets/:walletId/fees/race", chargeRaceFee);
router.post("/wallets/:walletId/recharge-requests", requestRecharge);
router.put(
  "/wallets/:walletId/recharge-requests/:transactionId/approve",
  approveRecharge,
);
router.put(
  "/wallets/:walletId/recharge-requests/:transactionId/reject",
  rejectRecharge,
);
router.delete("/wallets/:walletId", deleteWallet);

router.get("/fee-profiles", findFeeProfiles);
router.post("/fee-profiles", createOrUpdateFeeProfile);

router.get("/receipts", findReceipts);
router.get("/receipts/:receiptId", findReceipt);

export default router;
