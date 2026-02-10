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
//       </p>
//     </div>
//   );
// }


import { useState } from "react";

export default function Signup({ onSwitch }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignup() {

    // Confirm password validation
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setError("");

    try {
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          fullName,
          email,
          password
        })
      });

      const data = await res.json();
      alert(data.message);
    } catch (err) {
      console.error(err);
      alert("Server error");
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
        placeholder="Username"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* Confirm Password */}
      <input
        type="password"
        placeholder="Confirm Password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />

      {error && <p className="error-text">{error}</p>}

      <button className="primary-btn" onClick={handleSignup}>
        Sign Up
      </button>

      <div className="divider">
        <span>OR</span>
      </div>

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
