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
const autoSwaggerJs = require("auto-swagger-js");

// Initialize the Express application
const app = express();

// --- Enhanced CORS Configuration ---
const corsOptions = {
    origin: [
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5000",
        "http://localhost:5000",
        FRONTEND_URL,
    ].filter(Boolean), // Remove any falsy values
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
// --- Global Middleware Setup ---
// Enable Cross-Origin Resource Sharing (CORS) for all routes
app.use(cors(corsOptions));
// Set various HTTP headers for security using Helmet
app.use(helmet());
// Parse incoming requests with JSON payloads
app.use(express.json());
// Parse cookies attached to the client request object
app.use(cookieParser());
// Parse incoming requests with URL-encoded payloads
app.use(express.urlencoded({ extended: true }));

//Setup Websocket.io connection for chat
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://127.0.0.1:5000",
            "http://localhost:5000",
            `${FRONTEND_URL}`,
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    },
});

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

// Setup your /chat namespace
setupWebsocket(io);

// --- Server Startup ---
// Start the Express server and listen on the configured PORT

autoSwaggerJs({
    app,
    version: "1.0.0",
    description: "Wisdom connect api documentation and testing",
    title: "Wisdom Connect Api And Documentation",
    schemes: ["http", "https"],
    routePrefix: `${API_URL}`,
    securityDefinitions: {
        BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
        },
    },
    // Add these options:
    swaggerOptions: {
        cors: {
            origin: FRONTEND_URL,
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
    },
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
