require("dotenv").config();
const validateEnv = require("./config/envValidator");
validateEnv();
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
const allowedOrigins = [FRONTEND_URL, ...(process.env.CORS_ORIGINS || '').split(','), ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:5173','http://127.0.0.1:5173'] : [])].map(s => s?.trim()).filter(Boolean);
if(process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Render health checks)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new (require('./utils/security').HttpError)(403,'Origin not allowed'));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
};

// Handle OPTIONS preflight BEFORE helmet or any other middleware
app.options("*", cors(corsOptions));
app.use(cors(corsOptions));

// --- Global Middleware ---
app.use(helmet({
    crossOriginResourcePolicy: false,
}));
app.use(express.json({
    verify: (req, _res, buf) => {
        if (req.originalUrl && req.originalUrl.includes('/webhook')) {
            req.rawBody = buf;
        }
    }
}));
app.use(cookieParser());
// Protect KYC uploads from unauthenticated direct public access
app.use('/uploads/kyc', (req, res) => {
    res.status(403).json({ status: "fail", message: "Direct static access to KYC documents is restricted. Access via /api/v1/kyc/document/:filename" });
});
app.use('/uploads', express.static('uploads')); // serve images

// Setup Websocket.io connection for chat
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions, maxHttpBufferSize: 64000 });
app.use(API_URL, (req,res,next) => req.path === '/payments/webhook' ? next() : require('./config/rateLimiter').generalLimiter(req,res,next));
// Never serialize security credentials, even in nested Sequelize associations.
app.use((req,res,next) => {
 const original = res.json.bind(res);
 res.json = value => original(JSON.parse(JSON.stringify(value, (key, item) => ['password','verificationToken','passwordResetToken','verificationExpires','passwordResetExpires','tokenVersion','stack','sql'].includes(key) ? undefined : item)));
 next();
});

// --- API Routes ---
app.get("/", (req, res) => {
    res.status(200).json({ message: "Backend is working" });
});

app.use(`${API_URL}/support`,require("./routes/supportRoutes"));
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

const kycRoutes = require("./routes/kycRoutes");
app.use(`${API_URL}/kyc`, kycRoutes);


const announcementRoutes = require("./routes/announcementRoutes");
app.use(`${API_URL}/announcements`, announcementRoutes);

const platformSettingRoutes = require("./routes/platformSettingRoutes");
app.use(`${API_URL}/settings`, platformSettingRoutes);

const waitlistRoutes = require("./routes/waitlistRoutes");
app.use(`${API_URL}/waitlist`, waitlistRoutes);

app.get("/test-notifications", (req, res) => {
    res.json({ message: "Notifications route is alive ✅" });
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
    require('./utils/logger').error('Unhandled request error',err);
    if (res.headersSent) return next(err);
    const statusCode = err.code?.startsWith('LIMIT_') ? 413 : err.statusCode || err.status || 500;
    const response = {
        status: "fail",
        message: statusCode < 500 ? (err.code?.startsWith("LIMIT_") ? "Upload exceeds permitted limits" : err instanceof require("./utils/security").HttpError ? err.message : "Invalid request payload") : "Internal server error"
    };
    if (process.env.NODE_ENV !== "production" && err.stack) {
        // Internal stack traces stay in server logs.
    }
    res.status(statusCode).json(response);
});


// Setup /chat namespace
setupWebsocket(io);

// Setup call socket
const { setupCallSocket } = require("./controllers/callSocketController");
setupCallSocket(io);

// --- Swagger Documentation ---
if (process.env.NODE_ENV !== "production") autoSwaggerJs({
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
            credentials: false,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
    },
});

// --- Synchronize Database & Start Server ---
let webhookTimer, reminderTimer;
db.sequelize.authenticate()
    .then(async () => {
        console.log("✅ Database synchronized successfully (Tables created/updated)");

        // Note: Schema updates and column alterations are handled via Sequelize migrations (run `npm run migrate`)

        server.listen(PORT, () => {
            console.log(`Server is running on port ${PORT} http://localhost:${PORT}`);
            console.log(`Swagger docs available at http://localhost:${PORT}/docs`);

            // Start session call reminder scheduler (24h, 1h, 10min notifications)
            const reminderService = require('./services/reminderService');
            reminderTimer = reminderService.start();
            webhookTimer = require('./services/webhookService').start();
        });
    })
    .catch(async (err) => {
        console.error("❌ Database synchronization failed:", err);
    });

let shuttingDown=false;
async function shutdown() {
 if(shuttingDown) return;shuttingDown=true;
 clearInterval(webhookTimer);clearInterval(reminderTimer);
 const timeout=setTimeout(()=>process.exit(1),15000);timeout.unref();
 io.close(async()=>{try {await db.sequelize.close();clearTimeout(timeout);} catch {process.exitCode=1;}});
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
