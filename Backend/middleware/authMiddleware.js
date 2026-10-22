const supabase = require("../supabaseClient");

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "No token" });
  const token = authHeader.split(" ")[1];
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return res.status(403).json({ message: "Invalid token" });
    req.user = { id: data.user.id, email: data.user.email };
    next();
  } catch (err) {
    res.status(403).json({ message: "Invalid token" });
  }
};
