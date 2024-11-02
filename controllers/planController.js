const Redis = require("ioredis");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const crypto = require("crypto");
const stringify = require("json-stable-stringify");
const deepmerge = require("deepmerge");
const { makeSchemaOptional } = require("../utils/helper");
const logger = require("../utils/logger"); // Import the logger

const redis = new Redis({ host: "localhost", port: 6379 });
const ajv = new Ajv();
addFormats(ajv);

// Load JSON schema
const planSchema = JSON.parse(
  fs.readFileSync("./schemas/planSchema.json", "utf-8")
);
const validate = ajv.compile(planSchema);

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
    const eTag = `"${crypto
      .createHash("md5")
      .update(stringify(data))
      .digest("base64")}"`;

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
  const ifNoneMatch = req.headers["if-none-match"];
  const { requestId } = req;

  try {
    const plan = await redis.get(planId);
    if (!plan) {
      logger.warn("Plan not found", { requestId, planId });
      return res.status(404).json({ error: "Plan not found" });
    }

    const eTag = `"${crypto.createHash("md5").update(plan).digest("base64")}"`;

    if (ifNoneMatch === eTag) {
      logger.info("Conditional read: Not Modified", { requestId, planId });
      return res.status(304).send();
    }

    logger.info("Plan retrieved successfully", { requestId, planId });
    res.set("ETag", eTag).json(JSON.parse(plan));
  } catch (err) {
    logger.error("Error in getPlanById", { requestId, error: err.message });
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a plan
exports.updatePlan = async (req, res) => {
  const planId = req.params.id;
  const ifMatch = req.headers["if-match"];
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

    const existingEtag = `"${crypto
      .createHash("md5")
      .update(existingPlan)
      .digest("base64")}"`;
    if (ifMatch && ifMatch !== existingEtag) {
      logger.warn("Precondition failed for update", { requestId, planId });
      return res
        .status(412)
        .json({ error: "Precondition Failed: Resource has been modified" });
    }

    const updatedPlan = req.body;
    await redis.set(planId, stringify(updatedPlan));

    const newEtag = `"${crypto
      .createHash("md5")
      .update(stringify(updatedPlan))
      .digest("base64")}"`;
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
  const ifMatch = req.headers["if-match"];
  const { requestId } = req;

  // Create a deep clone of the schema to avoid modifying the original
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

    const existingEtag = `"${crypto
      .createHash("md5")
      .update(existingPlan)
      .digest("base64")}"`;
    if (ifMatch && ifMatch !== existingEtag) {
      logger.warn("Precondition failed for patch", { requestId, planId });
      return res
        .status(412)
        .json({ error: "Precondition Failed: Resource has been modified" });
    }

    const partialUpdate = req.body;
    const mergedPlan = deepmerge(JSON.parse(existingPlan), partialUpdate);

    await redis.set(planId, stringify(mergedPlan));
    const newEtag = `"${crypto
      .createHash("md5")
      .update(stringify(mergedPlan))
      .digest("base64")}"`;
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
    const deleted = await redis.del(planId);
    if (deleted === 0) {
      logger.warn("Plan not found for delete", { requestId, planId });
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
