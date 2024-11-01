const jwt = require("jsonwebtoken");
const jwksClient = require("jwks-rsa");

// Configure JWKS client to get Google's public keys
const client = jwksClient({
  jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
});

// Function to retrieve the signing key based on the `kid` in the token header
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Middleware to verify the token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Auth Header:", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, getKey, { algorithms: ["RS256"] }, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Forbidden: Invalid token" });
    }
    req.user = decoded; // Attach decoded token to request object
    next();
  });
};

module.exports = verifyToken;
