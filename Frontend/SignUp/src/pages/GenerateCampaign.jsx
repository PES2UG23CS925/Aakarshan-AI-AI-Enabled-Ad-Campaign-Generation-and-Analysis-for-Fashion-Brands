import { useState } from "react";
import { apiService } from "../services/apiService";

export default function GenerateCampaign() {
  const [formData, setFormData] = useState({
    brandName: "",
    category: "",
    audience: "",
    platform: "Instagram",
    prompt: ""
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        alert("Please login first");
        return;
      }

      const data = await apiService.generateCampaign(formData, token);
      setResult(data);
    } catch (err) {
      console.error(err);
      alert("Failed to generate campaign: " + (err.message || "Unknown error"));
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white px-10 py-16">

      <div className="max-w-6xl mx-auto">

        <h1 className="text-4xl font-bold mb-3">
          Generate <span className="text-indigo-500">AI Campaign</span>
        </h1>

        <p className="text-gray-400 mb-10">
          Fill in your brand details and let AI create optimized ad campaigns.
        </p>

        <div className="grid md:grid-cols-2 gap-10">
          {/* LEFT FORM */}
<div className="bg-[#121826] p-8 rounded-2xl border border-gray-800">

  <div className="space-y-6">

    {/* Brand Name */}
    <div>
      <label className="text-sm text-gray-400">Brand Name</label>
      <input
        name="brandName"
        placeholder="e.g., Luxe Fashion Co."
        onChange={handleChange}
        className="w-full mt-2 p-4 bg-[#0F172A] rounded-full border border-gray-700 focus:border-indigo-500 outline-none"
      />
    </div>

    {/* Product Category */}
    <div>
      <label className="text-sm text-gray-400">Product Category</label>
      <input
        name="category"
        placeholder="e.g., Women's Streetwear"
        onChange={handleChange}
        className="w-full mt-2 p-4 bg-[#0F172A] rounded-full border border-gray-700 focus:border-indigo-500 outline-none"
      />
    </div>

    {/* Target Audience */}
    <div>
      <label className="text-sm text-gray-400">Target Audience</label>
      <input
        name="audience"
        placeholder="e.g., Women 18-35, Urban Enthusiasts"
        onChange={handleChange}
        className="w-full mt-2 p-4 bg-[#0F172A] rounded-full border border-gray-700 focus:border-indigo-500 outline-none"
      />
    </div>

    {/* Platform Pills */}
    <div>
      <label className="text-sm text-gray-400">Platform</label>

      <div className="flex gap-3 mt-3 flex-wrap">
        {["Instagram", "Google Ads", "Meta", "TikTok"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFormData({ ...formData, platform: item })}
            className={`px-4 py-2 rounded-full border transition ${
              formData.platform === item
                ? "bg-indigo-600 border-indigo-600 text-white"
                : "border-gray-600 text-gray-400 hover:border-indigo-500"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>

    {/* Campaign Prompt */}
    <div>
      <label className="text-sm text-gray-400">Campaign Prompt</label>
      <textarea
        name="prompt"
        placeholder="Describe your campaign goals, tone, style preferences..."
        rows={4}
        onChange={handleChange}
        className="w-full mt-2 p-4 bg-[#0F172A] rounded-xl border border-gray-700 focus:border-indigo-500 outline-none"
      />
    </div>

    {/* Buttons */}
    <div className="flex gap-4 mt-4">
      <button
        onClick={handleGenerate}
        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 py-3 rounded-lg font-semibold hover:opacity-90 transition"
      >
        {loading ? "Generating..." : "Generate"}
      </button>

      <button
        onClick={handleGenerate}
        className="flex-1 border border-gray-600 py-3 rounded-lg text-gray-300 hover:border-indigo-500 transition"
      >
        Regenerate
      </button>
    </div>

  </div>
</div>


          {/* RIGHT RESULT */}
          <div className="bg-[#121826] p-8 rounded-2xl border border-gray-800">

            {result ? (
              <div>
                <h3 className="text-xl font-semibold mb-4 text-indigo-400">
                  Generated Campaign
                </h3>

                <pre className="whitespace-pre-wrap text-gray-300 text-sm">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                AI results will appear here
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
