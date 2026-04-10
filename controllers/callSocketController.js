exports.setupCallSocket = (io) => {
    io.on("connection", (socket) => {
        // console.log("User connected to call socket:", socket.id);

        socket.on("joinRoom", ({ meetingId, userId, role }) => {
            socket.join(meetingId);
            socket.to(meetingId).emit("userJoined", { userId, role });
        });

        socket.on("offer", ({ meetingId, offer }) => {
            socket.to(meetingId).emit("offer", offer);
        });

        socket.on("answer", ({ meetingId, answer }) => {
            socket.to(meetingId).emit("answer", answer);
        });

        socket.on("ice-candidate", ({ meetingId, candidate }) => {
            socket.to(meetingId).emit("ice-candidate", candidate);
        });

        socket.on("endCall", ({ meetingId }) => {
            // Terminate session for all in room
            io.to(meetingId).emit("callEnded");
        });

        socket.on("forceMute", ({ meetingId }) => {
            socket.to(meetingId).emit("forceMute");
        });

        socket.on("forceVideoOff", ({ meetingId }) => {
            socket.to(meetingId).emit("forceVideoOff");
        });

        socket.on("leaveRoom", ({ meetingId, userId }) => {
            socket.leave(meetingId);
            socket.to(meetingId).emit("userLeft", { userId });
        });

        socket.on("disconnecting", () => {
            for (const room of socket.rooms) {
                if (room !== socket.id) {
                    socket.to(room).emit("userLeft", { reason: "disconnected" });
                }
            }
        });

        socket.on("disconnect", () => {
            // Socket is fully disconnected
        });
    });
};
