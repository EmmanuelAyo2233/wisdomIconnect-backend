const {
    cloudinary,
    CLOUDINARY_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    multer,
} = require("../config/reuseablePackages");

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024, fieldNestingDepth: 2, fieldArrayIndexLimit: 100, parts: 45, files: 1, fields: 40, fieldSize: 64 * 1024 } });

const cloudinaryconfig = cloudinary.config({
    cloud_name: CLOUDINARY_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

module.exports = { upload, cloudinary, cloudinaryconfig };
