import express from "express";
import { getSuggestions, queryChatbot } from "../controllers/Chatbot.js";

const router = express.Router();

router.get("/suggestions", getSuggestions);
router.post("/query", queryChatbot);

export default router;
