// import { Link } from "react-router-dom";

// export default function Home() {
//   return (
//     <div className="min-h-screen flex flex-col">

//       {/* ================= NAVBAR ================= */}
//       <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
//         <div className="max-w-7xl mx-auto px-10 py-4 flex justify-between items-center">

//           <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">
//             Aakarshan AI
//           </h1>

//           <nav className="hidden md:flex gap-10 text-sm font-medium text-gray-700">
//             <a href="#" className="nav-link">Home</a>
//             <a href="#" className="nav-link">Generate Campaign</a>
//             <a href="#" className="nav-link">Analytics</a>
//             <a href="#" className="nav-link">Templates</a>
//             <a href="#" className="nav-link">About</a>
//           </nav>

//           <div className="flex items-center gap-4">
//             <Link
//               to="/auth"
//               className="px-4 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-md transition"
//             >
//               Login
//             </Link>

//             <Link
//               to="/auth"
//               className="px-5 py-2 bg-indigo-600 text-white rounded-md shadow-md hover:shadow-lg hover:bg-indigo-700 transition duration-300"
//             >
//               Sign Up
//             </Link>
//           </div>

//         </div>
//       </header>

//       {/* ================= HERO ================= */}
//       <section className="flex-1 flex items-center">

//         <div className="max-w-7xl mx-auto px-10 w-full flex flex-col md:flex-row items-center justify-between">

//           {/* LEFT CONTENT */}
//           <div className="flex-1">

//             <h2 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
//               <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
//                 AI-Powered
//               </span>
//               <br />
//               Fashion Campaign Intelligence
//             </h2>

//             <p className="text-gray-600 text-lg md:text-xl max-w-xl mb-8 leading-relaxed">
//               Generate high-performing fashion ads, track engagement,
//               analyze CTR, perform sentiment analysis, and predict campaign
//               effectiveness using advanced AI-driven marketing intelligence.
//             </p>

//             <div className="flex gap-5">
//               <button className="px-7 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition duration-300">
//                 Create Campaign
//               </button>

//               <button className="px-7 py-3 border border-indigo-600 text-indigo-600 rounded-xl hover:bg-indigo-50 transition duration-300">
//                 View Demo
//               </button>
//             </div>

//           </div>

//           {/* RIGHT SIDE DASHBOARD MOCK */}
//           <div className="flex-1 mt-14 md:mt-0 flex justify-center">

//             <div className="bg-white rounded-3xl shadow-2xl p-10 w-[90%] md:w-[80%]">

//               <div className="h-72 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center text-gray-400 font-medium">
//                 Dashboard Preview
//               </div>

//             </div>

//           </div>

//         </div>

//       </section>

//     </div>
//   );
// }




import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import dashboardImg from "../assets/dashboard-preview.png";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* ================= NAVBAR ================= */}
      <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-10 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">
            Aakarshan AI
          </h1>

          <nav className="hidden md:flex gap-10 text-sm font-medium text-gray-700">
            <a href="#" className="nav-link">Home</a>
            <Link to="/generate" className="nav-link">
  Generate Campaign
</Link>

            <a href="#" className="nav-link">Analytics</a>
            <a href="#" className="nav-link">Templates</a>
            <a href="#" className="nav-link">About</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link to="/auth" className="px-4 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-md transition">
              Login
            </Link>

            <Link to="/auth" className="px-5 py-2 bg-indigo-600 text-white rounded-md shadow-md hover:shadow-lg hover:bg-indigo-700 transition duration-300">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

   {/* ================= HERO ================= */}
<section className="min-h-[90vh] flex items-center">
  <div className="max-w-7xl mx-auto px-10 w-full flex flex-col md:flex-row items-center justify-between gap-16">

    {/* LEFT CONTENT */}
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7 }}
      className="flex-1"
    >
      <h2 className="text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          AI-Powered
        </span>
        <br />
        Fashion Campaign Intelligence
      </h2>

      <p className="text-gray-600 text-lg md:text-xl max-w-xl mb-8 leading-relaxed">
        Generate high-performing fashion ads, analyze CTR,
        track engagement and predict campaign success using
        intelligent AI marketing systems.
      </p>

      <div className="flex gap-5">
        <Link 
          to="/dashboard" 
          className="px-7 py-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl hover:scale-105 transition duration-300"
        >
          Create Campaign
        </Link>

        <button className="px-7 py-3 border border-indigo-600 text-indigo-600 rounded-xl hover:bg-indigo-50 transition duration-300">
          View Demo
        </button>
      </div>
    </motion.div>

    {/* RIGHT IMAGE */}
    <motion.div 
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8 }}
      className="flex-1 flex justify-center"
    >
      <div className="relative w-full max-w-lg">

        {/* Glow background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-200 to-purple-200 blur-3xl opacity-40 rounded-3xl"></div>

        {/* Card */}
        <div className="relative bg-white rounded-3xl shadow-2xl p-6">
          <img
            src={dashboardImg}
            alt="Dashboard Preview"
            className="rounded-2xl w-full aspect-[16/10] object-cover"
          />
        </div>

      </div>
    </motion.div>

  </div>
</section>


      {/* ================= STATS SECTION ================= */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-10 text-center">

          {[
            { label: "Campaigns Generated", value: "2,500+" },
            { label: "Average CTR Boost", value: "38%" },
            { label: "Engagement Increase", value: "45%" },
            { label: "Fashion Brands Served", value: "120+" }
          ].map((stat, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <h3 className="text-4xl font-bold text-indigo-600">{stat.value}</h3>
              <p className="text-gray-600 mt-2">{stat.label}</p>
            </motion.div>
          ))}

        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-16">Core AI Capabilities</h3>

          <div className="grid md:grid-cols-3 gap-12 px-6">

            {[
              "AI Campaign Generator",
              "CTR & Engagement Analytics",
              "Sentiment Analysis Engine",
              "Ad Effectiveness Prediction",
              "Audience Behavior Tracking",
              "Real-Time Dashboard"
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                className="p-8 bg-white rounded-2xl shadow-md hover:shadow-xl transition"
              >
                <div className="h-12 w-12 bg-indigo-100 rounded-full mx-auto mb-6"></div>
                <h4 className="font-semibold text-lg">{feature}</h4>
              </motion.div>
            ))}

          </div>
        </div>
      </section>
{/* ================= HOW IT WORKS ================= */}
<section className="py-28 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
  <div className="max-w-4xl mx-auto px-6">

    <div className="text-center mb-16">
      <h3 className="text-3xl md:text-4xl font-bold text-gray-900">
        How <span className="text-indigo-600">Aakarshan AI</span> Works
      </h3>
      <p className="text-gray-600 mt-4">
        From brand data to deployed ads in six seamless steps.
      </p>
    </div>

    <div className="space-y-8">

      {[
        {
          title: "Upload Brand Data",
          desc: "Add your brand assets, product info, and guidelines."
        },
        {
          title: "Generate Campaigns",
          desc: "AI creates ad copy, creatives, and targeting strategies."
        },
        {
          title: "Predict Performance",
          desc: "Get AI-powered CTR, reach, and conversion predictions."
        },
        {
          title: "Analyze Metrics",
          desc: "Track real-time performance across platforms."
        },
        {
          title: "Optimize Prompts",
          desc: "Refine prompts based on AI-driven recommendations."
        },
        {
          title: "Publish Ads",
          desc: "Deploy optimized campaigns directly to ad platforms."
        }
      ].map((step, index) => (
        <div
          key={index}
          className="flex items-start gap-6 bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-1 transition duration-300"
        >
          {/* Step Number */}
          <div className="h-12 w-12 flex items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow">
            {index + 1}
          </div>

          {/* Content */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              {step.title}
            </h4>
            <p className="text-gray-600 mt-2">
              {step.desc}
            </p>
          </div>
        </div>
      ))}

    </div>

  </div>
</section>
{/* CTA SECTION */}
<section className="py-24 px-6 bg-gradient-to-br from-indigo-50 via-white to-purple-50">
  <div className="max-w-5xl mx-auto text-center bg-white shadow-xl rounded-3xl p-14 border border-gray-100">

    <h3 className="text-4xl md:text-5xl font-bold leading-tight mb-6">
      Ready to build your next{" "}
      <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
        high-performing fashion campaign?
      </span>
    </h3>

    <p className="text-gray-600 text-lg md:text-xl mb-10 max-w-2xl mx-auto">
      Join hundreds of fashion brands already using AI to create smarter,
      data-driven campaigns with predictive performance insights.
    </p>

    <button className="px-8 py-4 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 hover:scale-105 transition duration-300">
      Get Started Free →
    </button>

  </div>
</section>


    </div>
  );
}
