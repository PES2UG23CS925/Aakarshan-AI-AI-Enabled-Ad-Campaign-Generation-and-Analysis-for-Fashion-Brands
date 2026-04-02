// import { useState } from "react";

// export default function Login({ user, onSwitch }) {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");

//   function handleLogin() {
//     if (!user) {
//       setError("Invalid credentials");
//       return;
//     }

//     if (
//       email.trim() === user.email &&
//       password.trim() === user.password
//     ) {
//       setError(""); //  correct login
//     } else {
//       setError("Invalid credentials");
//     }
//   }

//   return (
//     <div className="card">
//       <h2 className="title">AKARSHAN AI</h2>
//       <p className="tagline">Smarter Ads. Powered by AI.</p>

//       <input
//         type="email"
//         placeholder="Email"
//         onChange={(e) => setEmail(e.target.value)}
//       />
//       <input
//         type="password"
//         placeholder="Password"
//         onChange={(e) => setPassword(e.target.value)}
//       />

//       {error && <p className="error-text">{error}</p>}

//       <button className="primary-btn" onClick={handleLogin}>
//         Login
//       </button>

//       <p className="switch">
//         Don’t have an account?{" "}
//         <span onClick={onSwitch}>Sign Up</span>
//       </p>
//     </div>
//   );
// }


import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiService } from "../services/apiService";

export default function Login({ onSwitch }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin() {
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await apiService.login(email, password);
      
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user || { email }));
        alert("Login successful!");
        navigate("/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = "http://localhost:8080/auth/google";
  }

  function handleForgotPassword() {
    alert("Password reset functionality coming soon!");
  }

  return (
    <div className="card">
      <h2 className="title">AKARSHAN AI</h2>
      <p className="tagline">Smarter Ads. Powered by AI.</p>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />

      {error && <p className="error-text">{error}</p>}

      <button 
        className="primary-btn" 
        onClick={handleLogin}
        disabled={loading}
      >
        {loading ? "Logging In..." : "Login"}
      </button>

      <p style={{ textAlign: "center", marginTop: "10px" }}>
        <span 
          onClick={handleForgotPassword}
          style={{ cursor: "pointer", color: "#0066ff", fontSize: "14px" }}
        >
          Forgot Password?
        </span>
      </p>

      <div className="divider">
        <span>OR</span>
      </div>

      <button 
        className="google-btn" 
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
        />
        Continue with Google
      </button>

      <p className="switch">
        Don't have an account?{" "}
        <span onClick={onSwitch} style={{ cursor: "pointer", color: "#0066ff" }}>
          Sign Up
        </span>
      </p>
    </div>
  );
}
