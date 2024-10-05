const express = require("express");
const router = express.Router();
const planController = require("../controllers/planController");

// Define routes and map them to controller methods
router.get("/", planController.getAllPlans);
router.post("/", planController.createPlan);
router.get("/:id", planController.getPlanById);
router.delete("/:id", planController.deletePlanById);

module.exports = router;
