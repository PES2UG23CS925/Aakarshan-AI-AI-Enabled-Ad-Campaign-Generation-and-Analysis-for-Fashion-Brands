// import AuthPage from "./pages/AuthPage.jsx";
// import "./index.css";
// import Home from "./pages/Home";


// export default function App() {
//   return <AuthPage />;
  
// }

import { BrowserRouter, Routes, Route } from "react-router-dom";
import AuthPage from "./pages/AuthPage.jsx";
import Home from "./pages/Home.jsx";
import "./index.css";
import Dashboard from "./pages/Dashboard";
import GenerateCampaign from "./pages/GenerateCampaign";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/generate" element={<GenerateCampaign />} />
      </Routes>
    </BrowserRouter>
  );
}
