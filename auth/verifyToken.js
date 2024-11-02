const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");
const logger = require("../utils/logger"); // Import the logger

// Configure JWKS client to get Google's public keys
const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

// Function to retrieve the signing key based on the `kid` in the token header
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      logger.error("Error retrieving signing key", { error: err.message });
      return callback(err, null);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Middleware to verify the token with audience and issuer validation
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const { requestId } = req;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    logger.warn("Unauthorized access attempt: No token provided", {
      requestId,
    });
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  const options = {
    algorithms: ["RS256"],
    audience: "YOUR_GOOGLE_CLIENT_ID",
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  };

  jwt.verify(token, getKey, options, (err, decoded) => {
    if (err) {
      logger.error("Token verification failed", {
        requestId,
        error: err.message,
      });
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }

    logger.info("Token verified successfully", {
      requestId,
      userId: decoded.sub,
    });
    req.user = decoded; // Attach decoded token to request object
    next();
  });
};

module.exports = verifyToken;
