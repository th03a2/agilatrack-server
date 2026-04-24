import express from "express";
import {
  chargeBirdRegistrationFee,
  chargeRaceFee,
  createWallet,
  deleteWallet,
  findAll,
  findOne,
  preloadWallet,
  requestRecharge,
  transferLoad,
  updateWallet,
} from "../controllers/Wallets.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createWallet);
router.put("/:id", updateWallet);
router.put("/:id/preload", preloadWallet);
router.put("/:id/transfer", transferLoad);
router.put("/:id/fees/bird-registration", chargeBirdRegistrationFee);
router.put("/:id/fees/race", chargeRaceFee);
router.put("/:id/recharge-request", requestRecharge);
router.delete("/:id", deleteWallet);

export default router;
