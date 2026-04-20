import express from "express";
import {
  createUser,
  deleteUser,
  findAll,
  findOne,
  updateUser,
} from "../controllers/Users.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
