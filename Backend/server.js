const {
    PORT,
    express,
    cors,
    helmet,
    cookieParser,
    API_URL,
} = require("./config/reuseablePackages");
const {
    authRoutes,
    userRoutes,
    appointmentsRoutes,
    menteessRoutes,
} = require("./routes");
const sequelize = require("./config/db");

// Initialize the Express application
const app = express();

// --- Global Middleware Setup ---
// Enable Cross-Origin Resource Sharing (CORS) for all routes
app.use(cors());
// Set various HTTP headers for security using Helmet
app.use(helmet());
// Parse incoming requests with JSON payloads
app.use(express.json());
// Parse cookies attached to the client request object
app.use(cookieParser());
// Parse incoming requests with URL-encoded payloads
app.use(express.urlencoded({ extended: true }));

// --- API Routes Setup ---
// Basic health check or welcome route for the root path
app.get("/", (req, res) => {
    res.status(200).json({ message: "Backend is working" });
});

// Mount authentication routes under the /api/v1/auth prefix
app.use(`${API_URL}/auth`, authRoutes);
// Mount user-specific routes under the /api/v1/user prefix
app.use(`${API_URL}/user`, userRoutes);
// Mount mentee/mentor related routes under the /api/v1/mentors prefix
app.use(`${API_URL}/mentors`, menteessRoutes);
// Mount appointment routes under the /api/v1/appointments prefix
app.use(`${API_URL}/appointments`, appointmentsRoutes);

// --- Error Handling Middleware --- 
// Catch-all for undefined routes (404 Not Found)
app.use((req, res, next) => {
    return next(new Error("This is error")); // Forwards a generic error to the global error handler
});

// Global error handler
app.use((err, req, res, next) => {
    // Sends a JSON response with the error status and message
    res.status(err.statusCode || 404).json({ status: "error", message: err.message });
});

// --- Server Startup ---
// Start the Express server and listen on the configured PORT
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
