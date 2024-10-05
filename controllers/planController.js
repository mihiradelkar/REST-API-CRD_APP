const Redis = require("ioredis");
const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const crypto = require("crypto");

const redis = new Redis({ host: "redis", port: 6379 });
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

  // Validate request data against JSON schema
  if (!validate(data)) {
    return res.status(400).json({ errors: validate.errors });
  }

  const planId = data.objectId;
  try {
    await redis.set(planId, JSON.stringify(data));
    res.status(201).location(`/api/v1/plans/${planId}`).send();
  } catch (err) {
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

    // Log the ETag and If-None-Match header
    console.log("Generated ETag:", eTag);
    console.log("If-None-Match Header:", ifNoneMatch);

    if (ifNoneMatch === eTag) {
      return res.status(304).send();
    }

    res.set("ETag", eTag).json(JSON.parse(plan));
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a plan
exports.deletePlanById = async (req, res) => {
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
    const keys = await redis.keys("*"); // Get all keys from Redis
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
