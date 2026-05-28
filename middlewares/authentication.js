/**
 * Authentication Middleware - Moved to controllers/authcontrollers.js
 * 
 * This file is kept for reference only.
 * 
 * ✅ SECURE: Token now stored in HTTP-only cookie, not in Authorization header
 * 
 * The authentication middleware in authcontrollers.js:
 * 1. Reads token from HTTP-only cookie (req.cookies.authToken)
 * 2. Verifies the JWT
 * 3. Attaches user to req.user
 * 
 * Import from:
 *   const { authentication, restrictTo } = require("../controllers/authcontrollers");
 * 
 * Usage in routes:
 *   router.get("/protected", authentication, restrictTo("mentor"), handler);
 */

// Authentication is now in authcontrollers.js
// Search for "const authentication = async" there


