exports.setupCallSocket = (io) => {
    io.of("/chat").on("connection", (socket) => {

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
            io.of("/chat").to(meetingId).emit("callEnded");
        });

        socket.on("forceMute", ({ meetingId }) => {
            socket.to(meetingId).emit("forceMute");
        });

        socket.on("forceVideoOff", ({ meetingId }) => {
            socket.to(meetingId).emit("forceVideoOff");
        });

        // Relay media state changes (camera/mic/screen share toggle)
        socket.on("mediaStateChanged", ({ meetingId, ...state }) => {
            socket.to(meetingId).emit("mediaStateChanged", state);
        });

        // In-call chat message
        socket.on("callChatMessage", ({ meetingId, message }) => {
            // Broadcast to all others in the room
            socket.to(meetingId).emit("callChatMessage", message);
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
