/**
 * errorHandler.js — Centralized Error Handling Middleware
 * 
 * This is the last line of defense for the Express application.
 * It catches any errors thrown in routes or controllers and
 * returns a clean JSON response instead of crashing the server.
 */

const errorHandler = (err, req, res, next) => {
  console.error(`[SYSTEM ERROR] ${new Date().toISOString()}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? "[STACK_HIDDEN_PRODUCTION]" : err.stack,
    path: req.path,
    method: req.method,
  });

  // Handle Multer errors specifically
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File size too large. Maximum limit is 5MB." });
  }

  // Handle Sequelize validation errors
  if (err.name === "SequelizeValidationError") {
    return res.status(400).json({ 
      error: "Validation failed.", 
      details: err.errors.map(e => e.message) 
    });
  }

  // Default error response
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProduction = process.env.NODE_ENV === "production";
  const clientMessage = (statusCode === 500 && isProduction)
    ? "An unexpected internal server error occurred. Please contact the administrator."
    : (err.message || "An unexpected internal server error occurred.");

  res.status(statusCode).json({
    error: clientMessage,
  });
};

module.exports = errorHandler;
