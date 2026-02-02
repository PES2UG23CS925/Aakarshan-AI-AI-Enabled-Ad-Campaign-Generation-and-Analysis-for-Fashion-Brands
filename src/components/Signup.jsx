import { useState } from "react";

export default function Signup({ onSignup, onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSignup() {
    onSignup({ email, password });
  }

  function handleGoogleSignup() {
    // frontend trigger only
    window.location.href = "http://localhost:8080/auth/google";
  }

  return (
    <div className="card">
      <h2 className="title">AKARSHAN AI</h2>
      <p className="tagline">Smarter Ads. Powered by AI.</p>

      <input type="text" placeholder="Username" />

      <input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input type="password" placeholder="Confirm Password" />

      {/* Sign Up */}
      <button className="primary-btn" onClick={handleSignup}>
        Sign Up
      </button>

      {/* Divider */}
      <div className="divider">
        <span>OR</span>
      </div>

      {/* Continue with Google */}
      <button className="google-btn" onClick={handleGoogleSignup}>
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
        />
        Continue with Google
      </button>

      <p className="switch">
        Already have an account?{" "}
        <span onClick={onSwitch}>Login</span>
      </p>
    </div>
  );
}
