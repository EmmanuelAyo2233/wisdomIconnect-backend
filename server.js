require("dotenv").config();
const { db } = require("./models");


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
const playbookRoutes = require("./routes/playbookRoutes");
const commentRoutes = require("./routes/comment");
const adminRoutes = require("./routes/admin");
const mentorRoutes = require("./routes/mentor");
const messageRequestRoutes = require("./routes/messageRequestRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const callRoutes = require("./routes/callRoutes");

// Initialize Express
const app = express();

// --- Enhanced CORS Configuration ---
const corsOptions = {
    origin: [
        "http://127.0.0.1:5503",
        "http://localhost:5503",
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "https://wisdom-iconnect.vercel.app",
        "https://wisdom-iconnect-1hz4dgiqz-emmanuels-projects-8000beb3.vercel.app",
        /\.vercel\.app$/, // Allows any Vercel preview branch
        FRONTEND_URL,
    ].filter(Boolean),
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
};
app.use(cors(corsOptions));

// --- Global Middleware ---
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
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
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "https://wisdom-iconnect.vercel.app",
            "https://wisdom-iconnect-1hz4dgiqz-emmanuels-projects-8000beb3.vercel.app",
            /\.vercel\.app$/, // Allows any Vercel preview branch
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
app.use(`${API_URL}/playbooks`, playbookRoutes);
app.use(`${API_URL}/comment`, commentRoutes);
app.use(`${API_URL}/admin`, adminRoutes);
app.use(`${API_URL}/mentors`, mentorRoutes);
const availabilityRoutes = require("./routes/availability");
app.use(`${API_URL}/availability`, availabilityRoutes);

const notificationRoutes = require("./routes/notificationRoutes");
app.use(`${API_URL}/notifications`, notificationRoutes);

const connectionRoutes = require("./routes/connectionRoutes");
app.use(`${API_URL}/connections`, connectionRoutes);
app.use(`${API_URL}/message-requests`, messageRequestRoutes);

const sessionRoutes = require("./routes/sessionRoutes");
app.use(`${API_URL}/sessions`, sessionRoutes);

app.use(`${API_URL}/payments`, paymentRoutes);

const activityRoutes = require("./routes/activityRoutes");
app.use(`${API_URL}/activity`, activityRoutes);

app.use(`${API_URL}/call`, callRoutes);

const wishlistRoutes = require("./routes/wishlistRoutes");
app.use(`${API_URL}/social`, wishlistRoutes);

const reportRoutes = require("./routes/reportRoutes");
app.use(`${API_URL}/reports`, reportRoutes);

const refundRoutes = require("./routes/refundRoutes");
app.use(`${API_URL}/refunds`, refundRoutes);

const announcementRoutes = require("./routes/announcementRoutes");
app.use(`${API_URL}/announcements`, announcementRoutes);

const platformSettingRoutes = require("./routes/platformSettingRoutes");
app.use(`${API_URL}/settings`, platformSettingRoutes);

app.get("/test-notifications", (req, res) => {
  res.json({ message: "Notifications route is alive ✅" });
});


// Setup /chat namespace
setupWebsocket(io);

// Setup call socket
const { setupCallSocket } = require("./controllers/callSocketController");
setupCallSocket(io);

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

// --- Synchronize Database & Start Server ---
db.sequelize.sync() // creates missing tables but avoids complex alterations to existing ones
    .then(async () => {
        console.log("✅ Database synchronized successfully (Tables created/updated)");
        
        // Safely add missing column to user table without alter: true which breaks on unique constraints
        try {
            await db.sequelize.query("ALTER TABLE `user` ADD COLUMN `accountStatus` ENUM('active', 'suspended', 'banned') DEFAULT 'active';");
            console.log("✅ accountStatus column added to user table");
        } catch (err) {
            if (err.original && err.original.errno !== 1060) {
                console.error("Note: accountStatus column already exists or could not be added.");
            }
        }

        // Safely patch notification enum and message length
        try {
            await db.sequelize.query("ALTER TABLE `notifications` MODIFY COLUMN `receiverType` ENUM('mentor', 'mentee', 'admin') NOT NULL;");
            await db.sequelize.query("ALTER TABLE `notifications` MODIFY COLUMN `message` TEXT NOT NULL;");
            console.log("✅ notifications table patched (enum & message text)");
        } catch (err) {
            console.error("Note: could not patch notifications table.");
        }

        // Safely add duration column to appointment table
        try {
            await db.sequelize.query("ALTER TABLE `appointment` ADD COLUMN `duration` INT DEFAULT 0;");
            console.log("✅ duration column added to appointment table");
        } catch (err) {
            if (err.original && err.original.errno !== 1060) {
                console.error("Note: duration column already exists or could not be added.");
            }
        }

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
            console.log(`Swagger docs available at http://localhost:${PORT}/docs`);
        });
    })
    .catch((err) => {
        console.error("❌ Database synchronization failed:", err);
    });
