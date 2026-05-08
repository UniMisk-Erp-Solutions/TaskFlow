const jwt = require("jsonwebtoken");

module.exports = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) return res.status(401).json({ error: "No token" });

    const decoded = jwt.decode(token);

    req.user = decoded;

    next();
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
};
