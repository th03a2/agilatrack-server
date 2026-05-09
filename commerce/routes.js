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
import {
  archiveShopProduct,
  cancelShopOrder,
  checkoutShopOrder,
  createShopProduct,
  findMyShopOrders,
  findShopAuditLogs,
  findShopOrders,
  findShopProducts,
  fulfillShopOrder,
  getShopAnalytics,
  scanFulfillmentQr,
  updateShopOrderPayment,
  updateShopProduct,
} from "./controllers/shop.js";
import { optionalSessionUser, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", getCommerceSummary);

router.get("/shop/products", optionalSessionUser, findShopProducts);
router.post("/shop/products", requireSessionUser, createShopProduct);
router.put(
  "/shop/products/:productId",
  requireSessionUser,
  validateObjectIdParam("productId"),
  updateShopProduct,
);
router.delete(
  "/shop/products/:productId",
  requireSessionUser,
  validateObjectIdParam("productId"),
  archiveShopProduct,
);

router.get("/shop/orders", requireSessionUser, findShopOrders);
router.get("/shop/orders/my", requireSessionUser, findMyShopOrders);
router.post("/shop/orders/checkout", requireSessionUser, checkoutShopOrder);
router.put(
  "/shop/orders/:orderId/payment",
  requireSessionUser,
  validateObjectIdParam("orderId"),
  updateShopOrderPayment,
);
router.post(
  "/shop/orders/:orderId/cancel",
  requireSessionUser,
  validateObjectIdParam("orderId"),
  cancelShopOrder,
);
router.post(
  "/shop/orders/:orderId/fulfill",
  requireSessionUser,
  validateObjectIdParam("orderId"),
  fulfillShopOrder,
);
router.post("/shop/fulfillment/scan", requireSessionUser, scanFulfillmentQr);
router.get("/shop/analytics", requireSessionUser, getShopAnalytics);
router.get("/shop/audit-logs", requireSessionUser, findShopAuditLogs);

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
