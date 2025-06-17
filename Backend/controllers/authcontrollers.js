const { User, Mentee, Mentor } = require("../models");
const {
    bcrypt,
    EMAIL_REGEX,
    salt,
    SECRET_KEY,
    jwt,
    Op,
} = require("../config/reuseablePackages");

// Handles new user registration
const signup = async (req, res) => {
    try {
        const body = req.body;

        // Check if all fields are present
        if (
            !body.name ||
            !body.email ||
            !body.userType ||
            !body.password ||
            !body.confirmPassword
        ) {
            return res
                .status(400)
                .json({ status: "fail", message: "fields are required" });
        }

        // Check if email pattern matches
        if (!EMAIL_REGEX.test(body.email)) {
            return res.status(404).json({
                status: "fail",
                message: "Invalid email address",
            });
        }

        // Check if valid userType was selected
        if (!["mentor", "mentee"].includes(body.userType)) {
            return res.status(400).json({
                status: "fail",
                message: "Invalid user type",
            });
        }

        //Check if user exist
        const existingUser = await User.findOne({
            where: { email: body.email },
        });

        if (existingUser) {
            return res.status(400).json({
                status: "fail",
                message: "User already exist",
            });
        }

        // Check if the confirm password is a match with password
        if (body.confirmPassword !== body.password) {
            return res.status(400).json({
                status: "fail",
                message: "Confirm password not match with password",
            });
        }

        // hash Password
        const hashedPassword = await bcrypt.hash(body.password, salt);

        const newUser = await User.create({
            name: body.name,
            email: body.email,
            userType: body.userType,
            password: hashedPassword,
        });

        if (!newUser || !newUser.id) {
            return res.status(500).json({ message: "User creation failed" });
        }

        // Create Profile based o userType Detected
        if (body.userType === "mentor") {
            await Mentor.create({ user_id: newUser.id });
        }

        if (body.userType === "mentee") {
            await Mentee.create({ user_id: newUser.id });
        }

        const responsData = {
            name: newUser.name,
            email: newUser.email,
            userType: newUser.userType,
        };

        return res.status(201).json({
            status: "success",
            message: "Registration successful",
            data: responsData,
        });
    } catch (error) {
        console.error("User registration error", error);
        res.status(500).json({
            message: "Failed to register user",
            error: error.message,
        });
    }
};

// Handles user login
const login = async (req, res) => {
    try {
        const body = req.body;

        // Check if all fields are present
        if (!body.email || !body.password) {
            return res
                .status(400)
                .json({ status: "fail", message: "fields are required" });
        }

        // Check if email pattern matches
        if (!EMAIL_REGEX.test(body.email)) {
            return res.status(404).json({
                status: "fail",
                message: "Invalid email address",
            });
        }

        //Check if user does't exist
        const user = await User.findOne({ where: { email: body.email } });

        if (!user) {
            return res.status(404).json({
                status: "fail",
                message: "User not found",
            });
        }

        // Check if password is match
        const isPasswordMatch = await bcrypt.compare(
            body.password,
            user.password
        );

        if (!isPasswordMatch) {
            return res.status(400).json({
                status: "fail",
                message: "Password incorrect",
            });
        }

        // Sign jwt token

        const userSig = {
            id: user.id,
            email: user.email,
        };
        const token = jwt.sign(userSig, SECRET_KEY, { expiresIn: "1d" });

        return res.status(201).json({
            status: "fail",
            message: "Login successful",
            token: token,
            token_type: "berear",
        });
    } catch (error) {
        console.error("User login error", error);
        res.status(500).json({
            message: "Failed to login user",
            error: error.message,
        });
    }
};

// Middleware to authenticate users using JWT
const authentication = async (req, res, next) => {
    try {
        // Get the token fro headers
        let idToken = "";
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith("Bearer ")
        ) {
            idToken = req.headers.authorization.split(" ")[1];
        }

        if (!idToken) {
            return res.status(401).json({
                status: "fail",
                message: "please login to get access",
            });
        }
        // Token verificattion
        const tokenDetails = jwt.verify(idToken, SECRET_KEY);

        // get the user details from database and add to rquest
        const freshUser = await User.findOne({
            where: {
                [Op.or]: [
                    { id: tokenDetails.id },
                    { email: tokenDetails.email },
                ],
            },
            include: [
                { model: Mentor, as: "mentor", required: false },
                { model: Mentee, as: "mentee", required: false },
            ],
            attributes: { exclude: ["password"] },
        });

        if (!freshUser) {
            return res
                .status(400)
                .json({ status: "fail", message: "User no longer exist" });
        }

        req.user = freshUser;
        next();
    } catch (error) {
        console.error("Auth error:", error);
        return res.status(401).json({
            status: "fail",
            message: "Invalid or expired token",
        });
    }
};

// Middleware factory to restrict access based on user type (role)
const restrictTo = (...userType) => {
    // Inner middleware function that performs the permission check
    const checkPermission = (req, res, next) => {
        if (!userType.includes(req.user.userType)) {
            return res.status(400).json({
                status: "fail",
                message: `You don't have permission to perform this acction as a ${req.user.userType}`,
            });
        }
        return next();
    };

    return checkPermission;
};

module.exports = { signup, login, authentication, restrictTo };
