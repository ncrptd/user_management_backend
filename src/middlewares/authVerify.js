const jwt = require("jsonwebtoken");
const jwt_secret = process.env["jwt_secret"];

const authVerify = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(" ")[1];
        const isCustomAuth = token.length < 500;
        let decoded;
        if (token && isCustomAuth) {
            decoded = jwt.verify(token, jwt_secret);

            req.user = { role: decoded?.role, id: decoded?.id, organization: decoded?.organization, email: decoded?.email };
        }
        return next();
    } catch (error) {
        return res
            .status(401)
            .json({ error: "Unauthorized access, please add a valid token" });
    }
};

module.exports = authVerify;
