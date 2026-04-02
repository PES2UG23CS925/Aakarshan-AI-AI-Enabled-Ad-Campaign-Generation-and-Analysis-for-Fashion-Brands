import { useState, useEffect } from "react";
import { apiService } from "../services/apiService";

export default function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          setError("Please login first");
          return;
        }

        const data = await apiService.getDashboard(token);
        setDashboardData(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load dashboard data: " + (err.message || "Unknown error"));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-10 flex items-center justify-center">
        <p className="text-xl text-gray-600">Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-10 flex items-center justify-center">
        <p className="text-xl text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-10">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome, {dashboardData?.user?.email}</h1>
          <p className="text-gray-600">Here's your campaign performance overview</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Campaigns</h3>
            <p className="text-3xl font-bold mt-2 text-indigo-600">
              {dashboardData?.totalCampaigns || 0}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Views</h3>
            <p className="text-3xl font-bold mt-2 text-indigo-600">
              {dashboardData?.totalViews || 0}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold text-gray-700">Total Clicks</h3>
            <p className="text-3xl font-bold mt-2 text-indigo-600">
              {dashboardData?.totalClicks || 0}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Average CTR</h3>
            <p className="text-3xl font-bold text-indigo-600">
              {(dashboardData?.ctRAverage || 0).toFixed(2)}%
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Engagement Rate</h3>
            <p className="text-3xl font-bold text-indigo-600">
              {(dashboardData?.engagementRate || 0).toFixed(2)}%
            </p>
          </div>
        </div>

        {dashboardData?.campaigns && dashboardData.campaigns.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow mt-8">
            <h3 className="text-lg font-semibold mb-4 text-gray-700">Recent Campaigns</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b">
                  <tr className="text-left text-gray-600">
                    <th className="pb-3">Campaign</th>
                    <th className="pb-3">Platform</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Views</th>
                    <th className="pb-3">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData.campaigns.slice(0, 5).map((campaign) => (
                    <tr key={campaign.id} className="border-b hover:bg-gray-50">
                      <td className="py-3">{campaign.title || campaign.headline || "Unnamed"}</td>
                      <td className="py-3">{campaign.platform}</td>
                      <td className="py-3">
                        <span className={`px-3 py-1 rounded-full text-sm ${
                          campaign.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-700"
                        }`}>
                          {campaign.status || "draft"}
                        </span>
                      </td>
                      <td className="py-3">{campaign.views || 0}</td>
                      <td className="py-3">{campaign.clicks || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
