const Redis = require("ioredis");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const crypto = require("crypto");
const stringify = require("json-stable-stringify");
const deepmerge = require("deepmerge");
const { makeSchemaOptional } = require("../utils/helper");
const logger = require("../utils/logger");

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});
const ajv = new Ajv();
addFormats(ajv);

// Load JSON schema
const planSchema = JSON.parse(
  fs.readFileSync("./schemas/planSchema.json", "utf-8")
);
const validate = ajv.compile(planSchema);

// Generate ETag
const generateEtag = (data) =>
  `"${crypto.createHash("md5").update(stringify(data)).digest("base64")}"`;

// Check ETag conditions
const checkETags = (req, res, eTag) => {
  const ifNoneMatch = req.headers["if-none-match"];
  const ifMatch = req.headers["if-match"];

  // If `if-none-match` matches, return 304
  if (ifNoneMatch && ifNoneMatch === eTag) {
    return res.status(304).send();
  }

  // If `if-match` does not match, return 412
  if (ifMatch && ifMatch !== eTag) {
    return res
      .status(412)
      .json({ error: "Precondition Failed: Resource has been modified" });
  }

  // No condition met, continue with request processing
  return null;
};

// Create a plan
exports.createPlan = async (req, res) => {
  const data = req.body;
  const { requestId } = req;

  if (!validate(data)) {
    logger.warn("Validation failed for createPlan", {
      requestId,
      errors: validate.errors,
    });
    return res.status(400).json({ errors: validate.errors });
  }

  const planId = data.objectId;
  try {
    await redis.set(planId, stringify(data));
    const eTag = generateEtag(data);

    logger.info(`Plan created with ID: ${planId}`, { requestId, planId });
    res
      .set("ETag", eTag)
      .location(`/api/v1/plans/${planId}`)
      .status(201)
      .send();
  } catch (err) {
    logger.error("Error in createPlan", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get a plan by ID
exports.getPlanById = async (req, res) => {
  const planId = req.params.id;
  const { requestId } = req;

  try {
    const plan = await redis.get(planId);
    if (!plan) {
      logger.warn("Plan not found", { requestId, planId });
      return res.status(404).json({ error: "Plan not found" });
    }

    const eTag = generateEtag(plan);

    // Check ETag conditions
    const conditionResult = checkETags(req, res, eTag);
    if (conditionResult) return conditionResult; // End response if ETag condition met

    logger.info("Plan retrieved successfully", { requestId, planId });
    res.set("ETag", eTag).status(200).json(JSON.parse(plan));
  } catch (err) {
    logger.error("Error in getPlanById", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a plan
exports.updatePlan = async (req, res) => {
  const planId = req.params.id;
  const { requestId } = req;

  if (!validate(req.body)) {
    logger.warn("Validation failed for updatePlan", {
      requestId,
      errors: validate.errors,
    });
    return res.status(400).json({ errors: validate.errors });
  }

  try {
    const existingPlan = await redis.get(planId);
    if (!existingPlan) {
      logger.warn("Plan not found for update", { requestId, planId });
      return res.status(404).json({ error: "Plan not found" });
    }

    const existingEtag = generateEtag(existingPlan);

    // Check ETag conditions
    const conditionResult = checkETags(req, res, existingEtag);
    if (conditionResult) return conditionResult; // End response if ETag condition met

    const updatedPlan = req.body;
    await redis.set(planId, stringify(updatedPlan));

    const newEtag = generateEtag(updatedPlan);
    logger.info("Plan updated successfully", { requestId, planId });
    res.set("ETag", newEtag).status(200).json(updatedPlan);
  } catch (err) {
    logger.error("Error in updatePlan", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Partially update a plan using PATCH
exports.patchPlan = async (req, res) => {
  const planId = req.params.id;
  const { requestId } = req;

  // Validate schema for PATCH
  const patchSchema = JSON.parse(JSON.stringify(planSchema));
  makeSchemaOptional(patchSchema);
  const partialValidate = ajv.compile(patchSchema);

  if (!partialValidate(req.body)) {
    logger.warn("Validation failed for patchPlan", {
      requestId,
      errors: partialValidate.errors,
    });
    return res.status(400).json({ errors: partialValidate.errors });
  }

  try {
    const existingPlan = await redis.get(planId);
    if (!existingPlan) {
      logger.warn("Plan not found for patch", { requestId, planId });
      return res.status(404).json({ error: "Plan not found" });
    }

    const existingEtag = generateEtag(existingPlan);

    // Check ETag conditions
    const conditionResult = checkETags(req, res, existingEtag);
    if (conditionResult) return conditionResult; // End response if ETag condition met

    const partialUpdate = req.body;
    const mergedPlan = deepmerge(JSON.parse(existingPlan), partialUpdate);

    await redis.set(planId, stringify(mergedPlan));
    const newEtag = generateEtag(mergedPlan);
    logger.info("Plan patched successfully", { requestId, planId });
    res.set("ETag", newEtag).status(200).json(mergedPlan);
  } catch (err) {
    logger.error("Error in patchPlan", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
  const planId = req.params.id;
  const { requestId } = req;

  try {
    const plan = await redis.get(planId);
    if (!plan) {
      logger.warn("Plan not found for delete", { requestId, planId });
      return res.status(404).json({ error: "Plan not found" });
    }

    const eTag = generateEtag(plan);

    // Check ETag conditions for delete
    const conditionResult = checkETags(req, res, eTag);
    if (conditionResult) return conditionResult; // End response if ETag condition met

    const deleted = await redis.del(planId);
    if (deleted === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }

    logger.info("Plan deleted successfully", { requestId, planId });
    res.status(204).send();
  } catch (err) {
    logger.error("Error in deletePlan", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all plans
exports.getAllPlans = async (req, res) => {
  const { requestId } = req;

  try {
    const keys = await redis.keys("*");
    const plans = [];

    for (const key of keys) {
      const plan = await redis.get(key);
      plans.push(JSON.parse(plan));
    }

    logger.info("All plans retrieved successfully", { requestId });
    res.status(200).json(plans);
  } catch (err) {
    logger.error("Error in getAllPlans", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};
