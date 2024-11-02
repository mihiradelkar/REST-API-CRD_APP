const swaggerJsdoc = require("swagger-jsdoc");

// Swagger definition
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description:
        "API documentation for the project with CRUD, authentication, and validation features",
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1", // Update as needed
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ["./routes/*.js"], // Path to the API docs (e.g., within your route files)
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;
