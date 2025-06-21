const {
    PORT,
    express,
    cors,
    helmet,
    cookieParser,
    API_URL,
    Server,
    http,
    FRONTEND_URL,
} = require("./config/reuseablePackages");
const {
    authRoutes,
    userRoutes,
    appointmentsRoutes,
    menteessRoutes,
    chatRoutes,
    postRoutes,
    commentRoutes,
} = require("./routes");
const { setupWebsocket } = require("./controllers/chatcontroller");

// Initialize the Express application
const app = express();

// Setup Websocket.io connection for chat
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            `${FRONTEND_URL}`,
        ],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    },
});
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
// Mount chat access routes under the /api/v1/chataccess prefix
app.use(`${API_URL}/chat`, chatRoutes);
// Mount post routes under the /api/v1/post prefix
app.use(`${API_URL}/post`, postRoutes);
// Mount comment routes under the /api/v1/comment prefix
app.use(`${API_URL}/comment`, commentRoutes);

// --- Error Handling Middleware ---
// Catch-all for undefined routes (404 Not Found)
app.use((req, res, next) => {
    return next(new Error("This is error")); // Forwards a generic error to the global error handler
});

// Global error handler
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err); // Let Express handle it
    }

    console.error("Unhandled error:", err);

    return res.status(500).json({
        status: "error",
        message: err.message || "Something went wrong",
    });
});

// Setup your /chat namespace
setupWebsocket(io);

// --- Server Startup ---
// Start the Express server and listen on the configured PORT

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
