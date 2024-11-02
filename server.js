const express = require("express");
const planRoute = require("./routes/planRoute");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv"); // Load environment variables
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");
const requestIdMiddleware = require("./middlewares/requestTracing");
const swaggerDocument = yaml.load("./docs/swagger/openapi.yaml");

console.log(process.env.NODE_ENV);
dotenv.config({
  path: process.env.NODE_ENV ? `.env.${process.env.NODE_ENV}` : ".env",
});

const app = express();

app.use(express.json());
app.use(requestIdMiddleware);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
// Use the plan routes
app.use("/api/v1/plans", planRoute);

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
