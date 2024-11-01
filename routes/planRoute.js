const express = require("express");
const router = express.Router();
const planController = require("../controllers/planController");
const verifyToken = require("../auth/verifyToken");

// Define routes and apply verifyToken middleware for secure access
router.post("/", verifyToken, planController.createPlan);
router.get("/", verifyToken, planController.getAllPlans);
router.get("/:id", verifyToken, planController.getPlanById);
// router.put("/:id", verifyToken, planController.updatePlan);
// router.patch("/:id", verifyToken, planController.patchPlan);
router.delete("/:id", verifyToken, planController.deletePlanById);

module.exports = router;
