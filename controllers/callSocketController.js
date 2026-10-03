const { meetingFor } = require('../services/authorizationService');
exports.setupCallSocket = (io) => {
    io.of("/chat").on("connection", (socket) => {
        const register = (event, handler) => socket.on(event, async (payload = {}) => {
            try {
                if (!payload || typeof payload !== 'object' || JSON.stringify(payload).length > 64000) throw new Error('Invalid event');
                if(event !== 'leaveRoom') await meetingFor(socket.user, payload.meetingId);
                if (event !== 'joinRoom' && !socket.rooms.has(payload.meetingId)) throw new Error('Join first');
                if (['forceMute','forceVideoOff'].includes(event) && socket.user.userType !== 'mentor') throw new Error('Mentor only');
                await handler({ ...payload, userId: socket.user.id, role: socket.user.userType });
            } catch { socket.emit('error', { message: 'This call action is unavailable.' }); }
        });

        register("joinRoom", ({ meetingId, userId, role }) => {
            socket.join(meetingId);
            socket.to(meetingId).emit("userJoined", { userId, role });
        });

        register("offer", ({ meetingId, offer }) => {
            socket.to(meetingId).emit("offer", offer);
        });

        register("answer", ({ meetingId, answer }) => {
            socket.to(meetingId).emit("answer", answer);
        });

        register("ice-candidate", ({ meetingId, candidate }) => {
            socket.to(meetingId).emit("ice-candidate", candidate);
        });

        register("endCall", ({ meetingId }) => {
            // Broadcast only to OTHER participants in the room, not back to the caller
            socket.to(meetingId).emit("callEnded");
        });

        register("forceMute", ({ meetingId }) => {
            socket.to(meetingId).emit("forceMute");
        });

        register("forceVideoOff", ({ meetingId }) => {
            socket.to(meetingId).emit("forceVideoOff");
        });

        // Relay media state changes (camera/mic/screen share toggle)
        register("mediaStateChanged", ({ meetingId, videoOn, audioOn, screenSharing }) => {
            const state={senderUserId:socket.user.id};
            for(const [key,value] of Object.entries({videoOn,audioOn,screenSharing})) if(typeof value === "boolean") state[key]=value;
            socket.to(meetingId).emit("mediaStateChanged", state);
        });

        // Relay hand raising event
        register("raiseHand", ({ meetingId, userId, isRaised }) => {
            socket.to(meetingId).emit("raiseHand", { userId, isRaised });
        });

        // Relay emoji reactions
        register("emojiReaction", ({ meetingId, userId, emoji }) => {
            socket.to(meetingId).emit("emojiReaction", { userId, emoji });
        });

        // In-call chat message
        register("callChatMessage", ({ meetingId, message }) => {
            // Broadcast to all others in the room
            if(typeof message?.text!=="string" || !message.text.trim() || message.text.length>2000) return;
            socket.to(meetingId).emit("callChatMessage", {id:require("crypto").randomUUID(),text:message.text,senderName:socket.user.name,senderImage:socket.user.picture,senderId:socket.user.id,timestamp:new Date().toISOString()});
        });

        register("leaveRoom", ({ meetingId, userId }) => {
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


