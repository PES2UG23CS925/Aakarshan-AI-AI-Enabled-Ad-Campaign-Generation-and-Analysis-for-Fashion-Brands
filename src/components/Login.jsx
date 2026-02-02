import { useState } from "react";

export default function Login({ user, onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleLogin() {
    if (!user) {
      setError("Invalid credentials");
      return;
    }

    if (
      email.trim() === user.email &&
      password.trim() === user.password
    ) {
      setError(""); //  correct login
    } else {
      setError("Invalid credentials");
    }
  }

  return (
    <div className="card">
      <h2 className="title">AKARSHAN AI</h2>
      <p className="tagline">Smarter Ads. Powered by AI.</p>

      <input
        type="email"
        placeholder="Email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password"
        onChange={(e) => setPassword(e.target.value)}
      />

      {error && <p className="error-text">{error}</p>}

      <button className="primary-btn" onClick={handleLogin}>
        Login
      </button>

      <p className="switch">
        Don’t have an account?{" "}
        <span onClick={onSwitch}>Sign Up</span>
      </p>
    </div>
  );
}
