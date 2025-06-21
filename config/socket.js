const { socketIo, FRONTEND_URL } = require("./reuseablePackages");
let io;

const setSocketIo = (serverInstance) => {
    io = socketIo(serverInstance, {
        cors: {
            origin: `${FRONTEND_URL}`,
            credentials: true,
        },
    });
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized. Call setSocketIo() first.");
    }

    return io;
};

module.exports = {
    setSocketIo,
    getIo,
};
