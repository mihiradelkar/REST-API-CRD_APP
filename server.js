const express = require("express");
const planRoute = require("./routes/planRoute");

const app = express();
app.use(express.json());

// Use the plan routes
app.use("/api/v1/plans", planRoute);

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
