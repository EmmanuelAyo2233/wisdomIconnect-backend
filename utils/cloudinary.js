const {
    cloudinary,
    CLOUDINARY_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    multer,
} = require("../config/reuseablePackages");

const storage = multer.memoryStorage();
const upload = multer({ storage });

const cloudinaryconfig = cloudinary.config({
    cloud_name: CLOUDINARY_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
});

module.exports = { upload, cloudinary, cloudinaryconfig };
