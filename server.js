require("dotenv").config();
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
const { setupWebsocket } = require("./controllers/chatcontroller");
const autoSwaggerJs = require("auto-swagger-js");

// Import routes directly
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const appointmentsRoutes = require("./routes/appointments");
const menteeRoutes = require("./routes/mentees");
const chatRoutes = require("./routes/chat");
const postRoutes = require("./routes/post");
const commentRoutes = require("./routes/comment");
const adminRoutes = require("./routes/admin");
const mentorRoutes = require("./routes/mentor");

// Initialize Express
const app = express();

// --- Enhanced CORS Configuration ---
const corsOptions = {
    origin: [
        "http://127.0.0.1:5503",
        "http://localhost:5503",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// --- Global Middleware ---
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads')); // serve images

// Setup Websocket.io connection for chat
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://127.0.0.1:5000",
            "http://localhost:5000",
            FRONTEND_URL,
        ],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    },
});

// --- API Routes ---
app.get("/", (req, res) => {
    res.status(200).json({ message: "Backend is working" });
});

app.use(`${API_URL}/auth`, authRoutes);
app.use(`${API_URL}/user`, userRoutes);
app.use(`${API_URL}/mentees`, menteeRoutes);
app.use(`${API_URL}/appointments`, appointmentsRoutes);
app.use(`${API_URL}/chat`, chatRoutes);
app.use(`${API_URL}/post`, postRoutes);
app.use(`${API_URL}/comment`, commentRoutes);
app.use(`${API_URL}/admin`, adminRoutes);
app.use(`${API_URL}/mentors`, mentorRoutes);
const availabilityRoutes = require("./routes/availability");
app.use(`${API_URL}/availability`, availabilityRoutes);


// Setup /chat namespace
setupWebsocket(io);

// --- Swagger Documentation ---
autoSwaggerJs({
    app,    
    version: "1.0.0",
    description: "Wisdom Connect API documentation and testing",
    title: "Wisdom Connect API",
    schemes: ["http", "https"],
    host: "localhost:5000",
    routePrefix: `${API_URL}`,
    securityDefinitions: {
        BearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
        },
    },
    swaggerOptions: {
        cors: {
            origin: FRONTEND_URL,
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
    },
});

// --- Start Server ---
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
});
