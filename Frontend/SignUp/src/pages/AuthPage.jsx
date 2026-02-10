import { useState } from "react";
import Signup from "../components/Signup.jsx";
import Login from "../components/Login.jsx";

export default function AuthPage() {
  const [page, setPage] = useState("signup");
  const [user, setUser] = useState(null);

 return (
  <div className="auth-layout">
    {/* LEFT SIDE – LOGO */}
    <div className="auth-left">
      <img
        src="/akarshan-ai.jpeg"
        alt="Akarshan AI Logo"
        className="auth-logo"
      />
    </div>

    {/* RIGHT SIDE – EXISTING SIGNUP / LOGIN */}
    <div className="auth-right">
      {page === "signup" && (
        <Signup
          onSignup={(data) => {
            setUser(data);
            setPage("login");
          }}
          onSwitch={() => setPage("login")}
        />
      )}

      {page === "login" && (
        <Login
          user={user}
          onSwitch={() => setPage("signup")}
        />
      )}
    </div>
  </div>
);

}