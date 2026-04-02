const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const supabase = require("../supabaseClient");

const router = express.Router();

/* REGISTER */
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password)
      return res.status(400).json({ message: "All fields required" });

    // Check if email already exists in auth.users table
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.find((u) => u.email === email);

    if (userExists)
      return res.status(400).json({ message: "Email already registered" });

    // Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError)
      return res.status(400).json({ message: authError.message });

    // Create user profile in public.users table
    const { data: userData, error: dbError } = await supabase
      .from("users")
      .insert([
        {
          id: authData.user.id,
          full_name: fullName,
          email,
        },
      ])
      .select();

    if (dbError)
      return res.status(400).json({ message: dbError.message });

    res.json({ message: "User registered successfully", user: userData[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/* LOGIN */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error)
      return res.status(400).json({ message: error.message });

    // Fetch user profile from users table
    const { data: userProfile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (profileError)
      return res.status(400).json({ message: "User profile not found" });

    res.json({
      message: "Login successful",
      token: data.session.access_token,
      user: {
        id: data.user.id,
        fullName: userProfile.full_name,
        email: userProfile.email,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
