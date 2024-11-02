const { createLogger, format, transports } = require("winston");

// Configure the logger
const logger = createLogger({
  level: "info", // Log level (e.g., 'error', 'warn', 'info', 'debug')
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Add timestamps
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta) : ""
      }`;
    })
  ),
  transports: [
    new transports.Console(), // Log to console for easy viewing in development
    new transports.File({ filename: "logs/error.log", level: "error" }), // Separate file for error logs
    new transports.File({ filename: "logs/combined.log" }), // Combined file for all logs
  ],
});

module.exports = logger;
