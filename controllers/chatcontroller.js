// const { SECRET_KEY, moment } = require("../config/reuseablePackages");

// const { ChatAccess, Mentor, Mentee, Appointment } = require("../models");

// // Setup Websocket.io connection for chat
// function setupWebsocket(io) {
//     const chatNamespace = io.of("/chat");

//     chatNamespace.use((socket, next) => {
//         const token = socket.handshake.auth.token;
//         if (!token) {
//             return next(new Error("No token Provided"));
//         }

//         try {
//             const user = jwt.verify(token, SECRET_KEY);
//             socket.user = user;
//             next();
//         } catch (error) {
//             next(new Error("Invalid token"));
//         }
//     });

//     chatNamespace.on("connection", (socket) => {
//         socket.on("join", async ({ bookingId, accessCode }) => {
//             const userId = socket.user.id;

//             const room = await ChatAccess.findOne({
//                 where: { bookingId },
//                 include: [{ model: Appointment, as: "appointment" }],
//             });
//             if (!room) {
//                 return socket.emit("error", "Appointment Id not found");
//             }

//             if (room.accessCode !== accessCode) {
//                 return socket.emit("error", { message: "Invalid access code" });
//             }

//             if (![room.menteeId, room.mentorId].includes(userId)) {
//                 return socket.emit("error", {
//                     message: "You are not part of this chat",
//                 });
//             }

//             const date = room.appointment.date;
//             const time = room.appointment.time;

//             const now = moment();
//             const start = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm");

//             if (now.isBefore(start)) {
//                 return socket.emit("error", {
//                     message: "Chat is not yet started",
//                 });
//             }

//             socket.join(`room-${bookingId}`);
//             socket.emit("joined", `You joined room ${bookingId}`);
//         });
//     });
// }
// // Retrieves all chat access codes for the logged-in mentor
// const getAllChatAccesscode = async (req, res) => {
//     try {
//         if (req.user.userType === "mentor") {
//             const mentor = await Mentor.findOne({
//                 where: { user_id: req.user.id },
//             });

//             if (!mentor) {
//                 return res.status(404).json({
//                     status: "fail",
//                     message: "Mentor not found",
//                 });
//             }
//             accessCodes = await ChatAccess.findAll({
//                 where: { mentorId: mentor.id },
//             });
//         }
//         if (req.user.userType === "mentee") {
//             const mentee = await Mentee.findOne({
//                 where: { user_id: req.user.id },
//             });

//             if (!mentee) {
//                 return res.status(404).json({
//                     status: "fail",
//                     message: "Mentee not found",
//                 });
//             }
//             accessCodes = await ChatAccess.findAll({
//                 where: { menteeId: mentee.id },
//             });
//         }

//         if (!accessCodes) {
//             return res.status(404).json({
//                 status: "fail",
//                 message: "Access codes not found",
//             });
//         }
//         if (accessCodes.length === 0) {
//             return res.status(404).json({
//                 status: "fail",
//                 message:
//                     "No apointments confirmed yet once a mentor confrim your appointment you will get access code",
//             });
//         }
//         return res.status(200).json(accessCodes);
//     } catch (error) {
//         res.status(500).json({ error: "Internal Server Error" });
//     }
// };

// // const deleteAccessCode = async () => {
// //     try {
// //     } catch (error) {
// //         res.status(500).json({ error: "Internal Server Error" });
// //     }
// // };

// module.exports = {
//     getAllChatAccesscode,
//     // deleteAccessCode,
//     setupWebsocket,
// };



const jwt = require("jsonwebtoken");
const moment = require("moment");
const { SECRET_KEY } = require("../config/reuseablePackages");

const { ChatAccess, Mentor, Mentee, Appointment, ChatMessage } = require("../models");
// ===============================
// 🔌 SOCKET.IO CHAT SETUP
// ===============================
function setupWebsocket(io) {
  const chatNamespace = io.of("/chat");

  // 🔐 SOCKET AUTH
  chatNamespace.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided ❌"));

    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      socket.user = decoded; // { id, userType }
      next();
    } catch (err) {
      next(new Error("Invalid token ❌"));
    }
  });

  chatNamespace.on("connection", (socket) => {
    console.log("🔗 Chat connected:", socket.user.id);

    socket.on("join", async ({ bookingId, accessCode }) => {
      try {
        const userId = socket.user.id;
        const userType = socket.user.userType;

        // 🔍 Find chat access
        const room = await ChatAccess.findOne({
          where: { bookingId },
          include: [{ model: Appointment, as: "appointment" }],
        });

        if (!room) {
          return socket.emit("error", {
            message: "Chat access not found ❌",
          });
        }

        // 🔐 Validate access code
        if (room.accessCode !== accessCode) {
          return socket.emit("error", {
            message: "Invalid access code ❌",
          });
        }

        // 🔁 Map user → mentor/mentee
        let allowed = false;

        if (userType === "mentor") {
          const mentor = await Mentor.findOne({
            where: { user_id: userId },
          });
          allowed = mentor && mentor.id === room.mentorId;
        }

        if (userType === "mentee") {
          const mentee = await Mentee.findOne({
            where: { user_id: userId },
          });
          allowed = mentee && mentee.id === room.menteeId;
        }

        if (!allowed) {
          return socket.emit("error", {
            message: "You are not allowed in this chat ❌",
          });
        }

        // ⏰ Check appointment time
        const { date, startTime } = room.appointment;
        const now = moment();
        const start = moment(`${date} ${startTime}`, "YYYY-MM-DD HH:mm");

        if (now.isBefore(start)) {
          return socket.emit("error", {
            message: "Chat has not started yet ⏳",
          });
        }

        // ✅ Join room
        socket.join(`room-${bookingId}`);
        socket.emit("joined", {
          message: "Joined chat successfully ✅",
          bookingId,
        });

                  // ===============================
          // 💬 SEND MESSAGE
          // ===============================
          socket.on("send-message", async ({ bookingId, message }) => {
            try {
              const chatAccess = await ChatAccess.findOne({
                where: { bookingId },
              });

              if (!chatAccess) {
                return socket.emit("error", {
                  message: "Chat access not found ❌",
                });
              }

              // Save message to DB
              const newMessage = await ChatMessage.create({
                chatAccessId: chatAccess.id,
                senderId: socket.user.id,
                message,
              });

              // Broadcast to room
              chatNamespace
                .to(`room-${bookingId}`)
                .emit("new-message", newMessage);

            } catch (error) {
              console.error("❌ Send message error:", error);
              socket.emit("error", {
                message: "Message failed ❌",
              });
            }
          });

      } catch (error) {
        console.error("❌ Chat join error:", error);
        socket.emit("error", {
          message: "Failed to join chat ❌",
        });
      }
    });
  });
}

// ===============================
// 📄 GET ALL CHAT ACCESS CODES
// ===============================
const getAllChatAccesscode = async (req, res) => {
  try {
    let accessCodes;

    if (req.user.userType === "mentor") {
      const mentor = await Mentor.findOne({
        where: { user_id: req.user.id },
      });

      if (!mentor) {
        return res.status(404).json({
          status: "fail",
          message: "Mentor not found ❌",
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
          message: "Mentee not found ❌",
        });
      }

      accessCodes = await ChatAccess.findAll({
        where: { menteeId: mentee.id },
      });
    }

    if (!accessCodes || accessCodes.length === 0) {
      return res.status(404).json({
        status: "fail",
        message:
          "No confirmed appointments yet. Chat opens after mentor accepts.",
      });
    }

    res.status(200).json({
      status: "success",
      data: accessCodes,
    });
  } catch (error) {
    console.error("❌ getAllChatAccesscode error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error ❌",
    });
  }
};



// ===============================
// 📜 GET CHAT HISTORY
// ===============================
const getChatMessages = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const chatAccess = await ChatAccess.findOne({
      where: { bookingId },
    });

    if (!chatAccess) {
      return res.status(404).json({
        status: "fail",
        message: "Chat not found ❌",
      });
    }

    const messages = await ChatMessage.findAll({
      where: { chatAccessId: chatAccess.id },
      order: [["createdAt", "ASC"]],
    });

    res.status(200).json({
      status: "success",
      data: messages,
    });

  } catch (error) {
    console.error("❌ getChatMessages error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error ❌",
    });
  }
};

module.exports = {
  setupWebsocket,
  getChatMessages,
  getAllChatAccesscode,
};
