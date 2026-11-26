const supabase = require("../supabaseClient");

// Role-based access control. Use AFTER authMiddleware (needs req.user.id).
// A user is an admin when users.role = 'admin' (see supabase_migration_3_roles.sql).
module.exports = async function adminMiddleware(req, res, next) {
  try {
    const { data, error } = await supabase.from("users").select("role").eq("id", req.user.id).single();
    if (error || !data || data.role !== "admin") return res.status(403).json({ message: "Admin access required" });
    next();
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};
