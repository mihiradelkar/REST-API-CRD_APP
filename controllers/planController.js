const Redis = require("ioredis");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const crypto = require("crypto");
const stringify = require("json-stable-stringify");
const deepmerge = require("deepmerge");

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
  if (!validate(data)) {
    return res.status(400).json({ errors: validate.errors });
  }
  const planId = data.objectId;
  try {
    await redis.set(planId, stringify(data));
    const eTag = `"${crypto
      .createHash("md5")
      .update(stringify(data))
      .digest("base64")}"`;

    res
      .set("ETag", eTag)
      .location(`/api/v1/plans/${planId}`)
      .status(201)
      .send();
  } catch (err) {
    console.error("Error in createPlan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get a plan by ID
exports.getPlanById = async (req, res) => {
  const planId = req.params.id;
  const ifNoneMatch = req.headers["if-none-match"];

  try {
    const plan = await redis.get(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const eTag = `"${crypto.createHash("md5").update(plan).digest("base64")}"`;

    // console.log("Generated ETag:", eTag);
    // console.log("If-None-Match Header:", ifNoneMatch);

    if (ifNoneMatch === eTag) {
      return res.status(304).send();
    }

    res.set("ETag", eTag).json(JSON.parse(plan));
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a plan
exports.updatePlan = async (req, res) => {
  const planId = req.params.id;
  const ifMatch = req.headers["if-match"];

  try {
    const existingPlan = await redis.get(planId);
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const existingEtag = `"${crypto
      .createHash("md5")
      .update(existingPlan)
      .digest("base64")}"`;
    if (ifMatch && ifMatch !== existingEtag) {
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
    res.set("ETag", newEtag).status(200).json(updatedPlan);
  } catch (err) {
    console.error("Error in updatePlan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Patch a plan
exports.patchPlan = async (req, res) => {
  const planId = req.params.id;
  const ifMatch = req.headers["if-match"];

  try {
    const existingPlan = await redis.get(planId);
    if (!existingPlan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    const existingEtag = `"${crypto
      .createHash("md5")
      .update(existingPlan)
      .digest("base64")}"`;
    if (ifMatch && ifMatch !== existingEtag) {
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
    res.set("ETag", newEtag).status(200).json(mergedPlan);
  } catch (err) {
    console.error("Error in patchPlan:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
  const planId = req.params.id;

  try {
    const deleted = await redis.del(planId);
    if (deleted === 0) {
      return res.status(404).json({ error: "Plan not found" });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all plans
exports.getAllPlans = async (req, res) => {
  try {
    const keys = await redis.keys("*");
    const plans = [];

    for (const key of keys) {
      const plan = await redis.get(key);
      plans.push(JSON.parse(plan));
    }

    res.status(200).json(plans);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};
