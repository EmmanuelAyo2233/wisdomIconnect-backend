// const jwt = require("jsonwebtoken");
// const { User, Mentor, Mentee } = require("../models");
// const { Op } = require("sequelize");
// const { SECRET_KEY } = require("../config/reuseablePackages"); // import properly

// const authentication = async (req, res, next) => {
//   try {
//     let idToken = "";
//     if (
//       req.headers.authorization &&
//       req.headers.authorization.startsWith("Bearer ")
//     ) {
//       idToken = req.headers.authorization.split(" ")[1].trim();
//     }

//     if (!idToken) {
//       return res.status(401).json({ status: "fail", message: "please login to get access" });
//     }

//     const tokenDetails = jwt.verify(idToken, SECRET_KEY);

//     const freshUser = await User.findOne({
//       where: { [Op.or]: [{ id: tokenDetails.id }, { email: tokenDetails.email }] },
//       include: [
//         { model: Mentor, as: "mentor", required: false },
//         { model: Mentee, as: "mentee", required: false },
//       ],
//       attributes: { exclude: ["password"] },
//     });

//     if (!freshUser) {
//       return res.status(400).json({ status: "fail", message: "User no longer exist" });
//     }

//     req.user = freshUser;
//     next();
//   } catch (error) {
//     return res.status(401).json({ status: "fail", message: "Invalid or expired token" });
//   }
// };

// module.exports = authentication;
