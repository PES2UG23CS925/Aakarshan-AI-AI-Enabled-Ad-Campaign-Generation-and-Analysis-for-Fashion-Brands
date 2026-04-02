// import { useState } from "react";

// export default function Signup({ onSignup, onSwitch }) {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   function handleSignup() {
//     onSignup({ email, password });
//   }

//   function handleGoogleSignup() {
//     // frontend trigger only
//     window.location.href = "http://localhost:8080/auth/google";
//   }

//   return (
//     <div className="card">
//       <h2 className="title">AKARSHAN AI</h2>
//       <p className="tagline">Smarter Ads. Powered by AI.</p>

//       <input type="text" placeholder="Username" />

//       <input
//         type="email"
//         placeholder="Email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//       />

//       <input
//         type="password"
//         placeholder="Password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//       />

//       <input type="password" placeholder="Confirm Password" />

//       {/* Sign Up */}
//       <button className="primary-btn" onClick={handleSignup}>
//         Sign Up
//       </button>

//       {/* Divider */}
//       <div className="divider">
//         <span>OR</span>
//       </div>

//       {/* Continue with Google */}
//       <button className="google-btn" onClick={handleGoogleSignup}>
//         <img
//           src="https://developers.google.com/identity/images/g-logo.png"
//           alt="Google"
//         />
//         Continue with Google
//       </button>

//       <p className="switch">
//         Already have an account?{" "}
//         <span onClick={onSwitch}>Login</span>
//       </p>
//     </div>
//   );
// }

// import { useState } from "react";

// export default function Signup({ onSwitch }) {
//   const [fullName, setFullName] = useState("");
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");

//   async function handleSignup() {
//     try {
//       const res = await fetch("http://localhost:5000/api/auth/register", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json"
//         },
//         body: JSON.stringify({
//           fullName,
//           email,
//           password
//         })
//       });

//       const data = await res.json();
//       alert(data.message);
//     } catch (err) {
//       console.error(err);
//       alert("Server error");
//     }
//   }

//   function handleGoogleSignup() {
//     window.location.href = "http://localhost:8080/auth/google";
//   }

//   return (
//     <div className="card">
//       <h2 className="title">AKARSHAN AI</h2>
//       <p className="tagline">Smarter Ads. Powered by AI.</p>

//       {/* Username */}
//       <input
//         type="text"
//         placeholder="Username"
//         value={fullName}
//         onChange={(e) => setFullName(e.target.value)}
//       />

//       {/* Email */}
//       <input
//         type="email"
//         placeholder="Email"
//         value={email}
//         onChange={(e) => setEmail(e.target.value)}
//       />

//       {/* Password */}
//       <input
//         type="password"
//         placeholder="Password"
//         value={password}
//         onChange={(e) => setPassword(e.target.value)}
//       />

//       {/* Confirm Password (UI only for now) */}
//       <input type="password" placeholder="Confirm Password" />

//       <button className="primary-btn" onClick={handleSignup}>
//         Sign Up
//       </button>

//       <div className="divider">
//         <span>OR</span>
//       </div>

//       <button className="google-btn" onClick={handleGoogleSignup}>
//         <img
//           src="https://developers.google.com/identity/images/g-logo.png"
//           alt="Google"
//         />
//         Continue with Google
//       </button>

//       <p className="switch">
//         Already have an account?{" "}
//         <span onClick={onSwitch}>Login</span>
import { useState } from "react";
import { apiService } from "../services/apiService";

export default function Signup({ onSwitch }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    // Confirm password validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!fullName || !email || !password) {
      setError("All fields are required");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = await apiService.register(fullName, email, password);
      
      if (data.message) {
        alert(data.message);
        if (data.message.includes("successfully")) {
          onSwitch(); // Switch to login
        }
      }
    } catch (err) {
      console.error(err);
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleSignup() {
    window.location.href = "http://localhost:8080/auth/google";
  }

  return (
    <div className="card">
      <h2 className="title">AKARSHAN AI</h2>
      <p className="tagline">Smarter Ads. Powered by AI.</p>

      <input
        type="text"
        placeholder="Full Name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        disabled={loading}
      />

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

      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        disabled={loading}
      />

      {error && <p className="error-text">{error}</p>}

      <button 
        className="primary-btn" 
        onClick={handleSignup}
        disabled={loading}
      >
        {loading ? "Signing Up..." : "Sign Up"}
      </button>

      <div className="divider">
        <span>OR</span>
      </div>

      <button 
        className="google-btn" 
        onClick={handleGoogleSignup}
        disabled={loading}
      >
        <img
          src="https://developers.google.com/identity/images/g-logo.png"
          alt="Google"
        />
        Continue with Google
      </button>

      <p className="switch">
        Already have an account?{" "}
        <span onClick={onSwitch} style={{ cursor: "pointer", color: "#0066ff" }}>
          Login
        </span>
      </p>
    </div>
  );
}

