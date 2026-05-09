import {
  getSuggestions as getSuggestionsService,
  queryChatbot as queryChatbotService,
} from "../services/chatbotService.js";

export const getSuggestions = (req, res) => getSuggestionsService(req, res);

export const queryChatbot = (req, res) => queryChatbotService(req, res);
