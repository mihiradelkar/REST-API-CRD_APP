const express = require("express");
const planRoute = require("./routes/planRoute");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
// Add a unique request ID to each request
app.use((req, res, next) => {
  req.requestId = uuidv4();
  next();
});
// Use the plan routes
app.use("/api/v1/plans", planRoute);

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
