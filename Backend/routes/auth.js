const express = require("express");
const router  = express.Router();
const supabase = require("../supabaseClient");

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: "Enter a valid email" });
    if (String(password).length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (authError) return res.status(400).json({ message: authError.message });

    const { error: dbError } = await supabase.from("users").insert([{
      id: authData.user.id, full_name: fullName, email,
    }]);
    if (dbError) return res.status(400).json({ message: dbError.message });

    res.json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ message: error.message });

    const { data: profile } = await supabase
      .from("users").select("*").eq("email", email).single();

    res.json({
      message: "Login successful",
      token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, fullName: profile?.full_name, email },
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
