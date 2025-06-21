const generateAccessCode = (mentorId) => {
    return `${mentorId}${Math.floor(Math.random() * 1000000)}`;
};

module.exports = {
    generateAccessCode,
};
