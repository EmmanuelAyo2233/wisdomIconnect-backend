const { SECRET_KEY, moment } = require("../config/reuseablePackages");

const { ChatAccess, Mentor, Mentee, Appointment } = require("../models");

// Setup Websocket.io connection for chat
function setupWebsocket(io) {
    const chatNamespace = io.of("/chat");

    chatNamespace.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("No token Provided"));
        }

        try {
            const user = jwt.verify(token, SECRET_KEY);
            socket.user = user;
            next();
        } catch (error) {
            next(new Error("Invalid token"));
        }
    });

    chatNamespace.on("connection", (socket) => {
        socket.on("join", async ({ bookingId, accessCode }) => {
            const userId = socket.user.id;

            const room = await ChatAccess.findOne({
                where: { bookingId },
                include: [{ model: Appointment, as: "appointment" }],
            });
            if (!room) {
                return socket.emit("error", "Appointment Id not found");
            }

            if (room.accessCode !== accessCode) {
                return socket.emit("error", { message: "Invalid access code" });
            }

            if (![room.menteeId, room.mentorId].includes(userId)) {
                return socket.emit("error", {
                    message: "You are not part of this chat",
                });
            }

            const date = room.appointment.date;
            const time = room.appointment.time;

            const now = moment();
            const start = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");

            if (now.isBefore(start)) {
                return socket.emit("error", {
                    message: "Chat is not yet started",
                });
            }

            socket.join(`room-${bookingId}`);
            socket.emit("joined", `You joined room ${bookingId}`);
        });
    });
}
// Retrieves all chat access codes for the logged-in mentor
const getAllChatAccesscode = async (req, res) => {
    try {
        if (req.user.userType === "mentor") {
            const mentor = await Mentor.findOne({
                where: { user_id: req.user.id },
            });

            if (!mentor) {
                return res.status(404).json({
                    status: "fail",
                    message: "Mentor not found",
                });
            }
            accessCodes = await ChatAccess.findAll({
                where: { mentorId: mentor.id },
            });
        }
        if (req.user.userType === "mentee") {
            const mentee = await Mentee.findOne({
                where: { user_id: req.user.id },
            });

            if (!mentee) {
                return res.status(404).json({
                    status: "fail",
                    message: "Mentee not found",
                });
            }
            accessCodes = await ChatAccess.findAll({
                where: { menteeId: mentee.id },
            });
        }

        if (!accessCodes) {
            return res.status(404).json({
                status: "fail",
                message: "Access codes not found",
            });
        }
        if (accessCodes.length === 0) {
            return res.status(404).json({
                status: "fail",
                message:
                    "No apointments confirmed yet once a mentor confrim your appointment you will get access code",
            });
        }
        return res.status(200).json(accessCodes);
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// const deleteAccessCode = async () => {
//     try {
//     } catch (error) {
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// };

module.exports = {
    getAllChatAccesscode,
    // deleteAccessCode,
    setupWebsocket,
};
