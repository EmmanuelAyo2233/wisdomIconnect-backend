exports.setupCallSocket = (io) => {
    io.of("/chat").on("connection", (socket) => {

        socket.on("joinRoom", ({ meetingId, userId, role }) => {
            socket.userId = String(userId);
            socket.meetingId = meetingId;
            socket.role = role;
            socket.join(meetingId);
            socket.to(meetingId).emit("userJoined", { userId, role, socketId: socket.id });
        });

        socket.on("offer", ({ meetingId, offer }) => {
            socket.to(meetingId).emit("offer", { offer, senderUserId: socket.userId });
        });

        socket.on("answer", ({ meetingId, answer }) => {
            socket.to(meetingId).emit("answer", { answer, senderUserId: socket.userId });
        });

        socket.on("ice-candidate", ({ meetingId, candidate }) => {
            socket.to(meetingId).emit("ice-candidate", { candidate, senderUserId: socket.userId });
        });

        socket.on("endCall", ({ meetingId }) => {
            // Broadcast only to OTHER participants in the room, not back to the caller
            socket.to(meetingId).emit("callEnded", { senderUserId: socket.userId });
        });

        socket.on("forceMute", ({ meetingId }) => {
            socket.to(meetingId).emit("forceMute", { senderUserId: socket.userId });
        });

        socket.on("forceVideoOff", ({ meetingId }) => {
            socket.to(meetingId).emit("forceVideoOff", { senderUserId: socket.userId });
        });

        // Relay media state changes (camera/mic/screen share toggle)
        socket.on("mediaStateChanged", ({ meetingId, ...state }) => {
            socket.to(meetingId).emit("mediaStateChanged", { ...state, senderUserId: socket.userId });
        });

        // Relay hand raising event
        socket.on("raiseHand", ({ meetingId, userId, isRaised }) => {
            socket.to(meetingId).emit("raiseHand", { userId, isRaised, senderUserId: socket.userId });
        });

        // Relay emoji reactions
        socket.on("emojiReaction", ({ meetingId, userId, emoji }) => {
            socket.to(meetingId).emit("emojiReaction", { userId, emoji, senderUserId: socket.userId });
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
                    socket.to(room).emit("userLeft", { reason: "disconnected", socketId: socket.id });
                }
            }
        });

        socket.on("disconnect", () => {
            // Socket is fully disconnected
        });
    });
};

