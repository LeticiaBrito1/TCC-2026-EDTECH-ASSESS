import { Router } from "express";
import { aiController } from "../controllers/aiController.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

const router = Router();

router.post("/ai/generate-questions", asyncHandler(aiController.generateQuestions));

export { router as aiRoutes };
