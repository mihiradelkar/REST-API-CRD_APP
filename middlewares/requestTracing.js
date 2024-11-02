const { v4: uuidv4 } = require("uuid");

// Middleware to add a unique request ID to each request
const requestIdMiddleware = (req, res, next) => {
  req.requestId = uuidv4();
  next();
};

module.exports = requestIdMiddleware;
