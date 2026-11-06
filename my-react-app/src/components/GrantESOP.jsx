import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, FileText } from "lucide-react";
import { createGrant, fetchEmployees } from "../api";
import { useAuth } from "../AuthContext";

const BASE_URL = "http://localhost:5000";

const GrantESOP = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [recentGrants, setRecentGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(true);

  const [formData, setFormData] = useState({
    employeeName: "", employeeEmail: "", employeeAddress: "",
    department: "", grantType: "ISO", shares: "", exercisePrice: "",
    vestingStart: "", vestingPeriod: "4", cliff: "1", grantReason: "", notes: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Load employees and existing grants from blockchain on page load
  useEffect(() => {
    fetchEmployees().then(setEmployees).catch(() => {});

    // Fetch all existing grants from blockchain
    fetch(`${BASE_URL}/api/grants/all`)
      .then(r => r.json())
      .then(data => {
        setRecentGrants(data);
        setLoadingGrants(false);
      })
      .catch(() => setLoadingGrants(false));
  }, []);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleEmployeeSelect = (e) => {
    const selectedEmail = e.target.value;
    const emp = employees.find(em => em.email === selectedEmail);
    if (emp) {
      setFormData(prev => ({
        ...prev,
        employeeName: emp.name,
        employeeEmail: emp.email,
        employeeAddress: emp.wallet_address || "",
        department: emp.department || ""
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const cliffDays = Math.round(parseFloat(formData.cliff) * 365);
      const vestingDays = Math.round(parseFloat(formData.vestingPeriod) * 365);

      const result = await createGrant({
  employeeName: formData.employeeName,
  employeeEmail: formData.employeeEmail,
  employeeAddress: formData.employeeAddress,
  totalShares: parseInt(formData.shares),
  cliffPeriod: cliffDays,
  vestingDuration: vestingDays
});

      setSuccess(`✅ ESOP granted! Tx: ${result.txHash?.slice(0, 20)}...`);

      // Refresh grants from blockchain
      fetch(`${BASE_URL}/api/grants/all`)
        .then(r => r.json())
        .then(setRecentGrants)
        .catch(() => {});

      // Reset form
      setFormData({
        employeeName: "", employeeEmail: "", employeeAddress: "",
        department: "", grantType: "ISO", shares: "", exercisePrice: "",
        vestingStart: "", vestingPeriod: "4", cliff: "1", grantReason: "", notes: ""
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="bg-white shadow px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <ArrowLeft className="cursor-pointer text-gray-600 hover:text-blue-600"
            onClick={() => navigate(user?.role === "admin" ? "/admin-dashboard" : "/hr-dashboard")} />
          <h1 className="text-xl font-bold text-blue-600">Grant ESOP to Employee</h1>
        </div>
        <div className="flex items-center gap-4">
          {[
            { label: "Dashboard", path: user?.role === "admin" ? "/admin-dashboard" : "/hr-dashboard" },
            { label: "Employees", path: "/hr-employees" },
            { label: "Reports", path: "/hr-reports" },
          ].map(({ label, path }) => (
            <button key={path} onClick={() => navigate(path)}
              className="text-gray-600 hover:text-blue-600 font-medium">{label}</button>
          ))}
        </div>
      </nav>

      <div className="p-6 grid grid-cols-2 gap-6">
        {/* Grant Form */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus size={20} /> Grant Details
          </h2>

          {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4">{error}</div>}
          {success && <div className="bg-green-50 text-green-700 p-3 rounded mb-4">{success}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Select Employee */}
            <div>
              <label className="block font-medium">Select Employee</label>
              <select onChange={handleEmployeeSelect}
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">-- Select existing employee --</option>
                {employees.filter(e => e.role === "employee").map(e => (
                  <option key={e.id} value={e.email}>{e.name} ({e.email})</option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Selecting auto-fills the fields below</p>
            </div>

            {[
              { label: "Employee Name", name: "employeeName", type: "text" },
              { label: "Employee Email", name: "employeeEmail", type: "email" },
              { label: "Wallet Address (0x...)", name: "employeeAddress", type: "text" },
              { label: "Number of Shares", name: "shares", type: "number" },
              { label: "Exercise Price ($)", name: "exercisePrice", type: "number" },
              { label: "Vesting Start Date", name: "vestingStart", type: "date" },
              { label: "Grant Reason", name: "grantReason", type: "text" },
            ].map(({ label, name, type }) => (
              <div key={name}>
                <label className="block font-medium">{label}</label>
                <input type={type} name={name} value={formData[name]}
                  onChange={handleChange} required={name !== "grantReason" && name !== "exercisePrice"}
                  className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            ))}

            <div>
              <label className="block font-medium">Department</label>
              <select name="department" value={formData.department}
                onChange={handleChange} required
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Department</option>
                <option>Engineering</option><option>Marketing</option>
                <option>HR</option><option>Finance</option>
              </select>
            </div>

            <div>
              <label className="block font-medium">Grant Type</label>
              <select name="grantType" value={formData.grantType} onChange={handleChange}
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option>ISO</option><option>NSO</option><option>RSU</option>
              </select>
            </div>

            <div>
              <label className="block font-medium">Vesting Period</label>
              <select name="vestingPeriod" value={formData.vestingPeriod} onChange={handleChange}
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="1">1 Year</option><option value="2">2 Years</option>
                <option value="3">3 Years</option><option value="4">4 Years</option>
              </select>
            </div>

            <div>
              <label className="block font-medium">Cliff Period</label>
              <select name="cliff" value={formData.cliff} onChange={handleChange}
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="0">None</option>
                <option value="0.5">6 Months</option>
                <option value="1">1 Year</option>
              </select>
            </div>

            <div>
              <label className="block font-medium">Notes</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3}
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>

            <button type="submit" disabled={loading}
              className="bg-blue-600 text-white w-full p-2 rounded hover:bg-blue-700 disabled:opacity-60 font-medium">
              {loading ? "Submitting to Blockchain..." : "Grant ESOP"}
            </button>
          </form>
        </div>

        {/* Recent Grants — from blockchain */}
        <div className="bg-white p-6 rounded shadow">
          <h2 className="font-bold mb-4 flex items-center gap-2 text-lg">
            <FileText size={20} /> All Grants
            <span className="text-xs text-blue-500 font-normal">(from blockchain)</span>
          </h2>

          {loadingGrants ? (
            <p className="text-gray-400 text-center py-8">Loading from blockchain...</p>
          ) : recentGrants.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>No grants issued yet</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Name</th>
                    <th>Dept</th>
                    <th>Shares</th>
                    <th>Vested</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentGrants.map((g, i) => (
                    <tr key={i} className="border-b hover:bg-gray-50">
                      <td className="py-2">{g.employeeName}</td>
                      <td>{g.department || "—"}</td>
                      <td>{g.totalShares?.toLocaleString()}</td>
                      <td className="text-green-600">{g.vestedShares?.toLocaleString()}</td>
                      <td className="text-xs text-gray-500">
                        {g.grantDate ? new Date(g.grantDate * 1000).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrantESOP;