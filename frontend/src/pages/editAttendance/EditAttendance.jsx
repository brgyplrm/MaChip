import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";

// shadcn/ui custom structural primitives
import { Card, CardContent } from "@/components/ui/card";

const EditAttendance = () => {
  const { userId, date } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const fromPath = queryParams.get("from");
  const backPath = fromPath === "adminRequests" ? "/adminRequests" : "/logs";

  const currentUser = JSON.parse(localStorage.getItem("userData") || "null");
  const isAdminOrAccountant = currentUser?.user_RoleId === 1 || currentUser?.user_RoleId === 4;

  useEffect(() => {
    if (!isAdminOrAccountant) {
      navigate("/logs");
    }
  }, [isAdminOrAccountant, navigate]);

  const [formData, setFormData] = useState({
    morning_In: "",
    morning_Out: "",
    afternoon_In: "",
    afternoon_Out: "",
    ot_In: "",
    ot_Out: "",
    attendance_StatusId: 1,
    userName: "",
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: "", type: "success" });

  const dismissToast = useCallback(
    () => setToast({ message: "", type: "success" }),
    [],
  );

  const statusOptions = [
    { id: 1, name: "On Time" },
    { id: 2, name: "Late" },
    { id: 3, name: "Absent" },
    { id: 4, name: "On Leave" },
    { id: 5, name: "On Field" },
  ];

  const statusBadgeStyles = {
    1: "bg-[#def7ec] text-[#03543f] border-[#def7ec]", 
    2: "bg-[#fef3c7] text-[#92400e] border-[#fef3c7]", 
    3: "bg-[#fde8e8] text-[#9b1c1c] border-[#fde8e8]", 
    4: "bg-[#e1effe] text-[#1e429f] border-[#e1effe]", 
    5: "bg-[#f3e8ff] text-[#6b21a8] border-[#f3e8ff]", 
  };

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        const response = await fetchWithAuth(`/api/attendance/record/${userId}/${date}`);
        if (response.ok) {
          const data = await response.json();
          setFormData({
            ...data,
            morning_In: data.morning_In === "—" ? "" : data.morning_In,
            morning_Out: data.morning_Out === "—" ? "" : data.morning_Out,
            afternoon_In: data.afternoon_In === "—" ? "" : data.afternoon_In,
            afternoon_Out: data.afternoon_Out === "—" ? "" : data.afternoon_Out,
            ot_In: data.ot_In === "—" ? "" : data.ot_In,
            ot_Out: data.ot_Out === "—" ? "" : data.ot_Out,
            attendance_StatusId: data.attendance_StatusId || 1,
          });
        } else {
          setToast({ message: "Failed to fetch attendance data.", type: "error" });
        }
      } catch (err) {
        console.error("Error fetching attendance data:", err);
        setToast({ message: "Error connecting to server.", type: "error" });
      }
    };
    fetchAttendanceData();
  }, [userId, date]);

  const handleInput = (e) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetchWithAuth(`/api/attendance/update/${userId}/${date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setToast({ message: "Attendance record updated successfully!", type: "success" });
        setTimeout(() => navigate(backPath), 1500);
      } else {
        const errorData = await response.json();
        setToast({ message: errorData.error || "Failed to update record.", type: "error" });
      }
    } catch (err) {
      setToast({ message: "Connection error.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Ultra-tightened input component layout to optimize vertical spacing
  const InputField = ({ label, id, value }) => (
    <div className="w-full sm:w-[calc(50%-8px)] flex flex-col gap-1 text-left">
      <label htmlFor={id} className="text-xs font-bold text-[#2A174E]">
        {label}
      </label>
      <input
        type="time"
        id={id}
        value={value}
        onChange={handleInput}
        className="px-3 py-1.5 border border-gray-200 rounded-lg outline-none text-xs bg-slate-50 focus:bg-white focus:border-[#2A174E] focus:ring-1 focus:ring-[#2A174E]/20 transition-all"
      />
    </div>
  );

  return (
    <div className="flex w-full min-h-screen bg-[#fdfaf5]">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar>
        <div className="flex-1 w-full max-w-6xl mx-auto">
          
          {/* Top Header Card with Interactive Pop-Out Back Button */}
          <div className="p-4 md:p-5 flex flex-col text-left bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] group transition-all duration-300">
            <div className="flex items-center relative overflow-hidden">
              <div className="flex items-center w-0 opacity-0 group-hover:w-9 group-hover:opacity-100 transition-all duration-300 ease-in-out shrink-0">
                <button
                  type="button"
                  onClick={() => navigate(backPath)}
                  className="p-1.5 rounded-full text-slate-400 hover:text-[#2A174E] hover:bg-slate-100 transition-colors mr-1"
                  title="Go back"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                </button>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-[#2A174E] transition-all duration-300 ease-in-out">
                Edit Attendance (ID: {formatUserId(userId)})
              </h1>
            </div>
            <span className="text-xs md:text-sm text-gray-500 mt-0.5 transition-all duration-300 ease-in-out group-hover:translate-x-9">
              {new Date(date).toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>

          {/* Core Content Layout Framework Box */}
          <Card className="w-full border border-slate-200 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row gap-6 p-4 md:p-5">
                
                {/* Left Column: Metadata Context Banner */}
                <div className="w-full lg:w-1/4 flex flex-col items-center gap-4 p-4 border-b lg:border-b-0 lg:border-r border-gray-100 rounded-xl">
                  <div className="text-center w-full pb-3 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-[#2A174E] tracking-tight break-words" title={formData.userName}>
                      {formData.userName}
                    </h2>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">
                      ID: {formatUserId(userId)}
                    </p>
                  </div>

                  {/* Dense Parameter Grid (Prevents Scrolling) */}
                  <div className="w-full grid grid-cols-2 lg:grid-cols-1 gap-2 text-left">
                    <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Base Rate</span>
                      <span className="text-xs font-bold text-slate-700 block mt-0.5">
                        {formData.dailyRate ? `₱${parseFloat(formData.dailyRate).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-between shadow-sm">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Assignment Scope</span>
                      <span className="text-xs font-semibold text-slate-600 block mt-0.5 truncate">
                        {isAdminOrAccountant ? "Management Admin" : "Standard Employee"}
                      </span>
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-100 flex flex-col justify-between shadow-sm col-span-2 lg:col-span-1">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Log Target Date</span>
                      <span className="text-xs font-mono font-bold text-slate-700 block mt-0.5">
                        {date}
                      </span>
                    </div>
                  </div>

                  <div className="w-full pt-1 flex flex-col gap-1 text-left">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block pl-1">Posting Badge</span>
                    <div className={`w-full text-center py-1.5 rounded-lg font-bold text-xs uppercase tracking-wide border ${statusBadgeStyles[formData.attendance_StatusId] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {statusOptions.find((o) => o.id === parseInt(formData.attendance_StatusId))?.name || "Unknown"}
                    </div>
                  </div>
                </div>

                {/* Right Column: Dense Form Configuration */}
                <div className="w-full lg:w-3/4">
                  <form onSubmit={handleUpdate} className="flex flex-col gap-5">
                    
                    {/* Morning Session Rows */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1 mb-2.5 text-left">
                        Morning Session
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <InputField label="AM In" id="morning_In" value={formData.morning_In} />
                        <InputField label="AM Out" id="morning_Out" value={formData.morning_Out} />
                      </div>
                    </div>

                    {/* Afternoon Session Rows */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1 mb-2.5 text-left">
                        Afternoon Session
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <InputField label="PM In" id="afternoon_In" value={formData.afternoon_In} />
                        <InputField label="PM Out" id="afternoon_Out" value={formData.afternoon_Out} />
                      </div>
                    </div>

                    {/* Overtime Session Rows */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1 mb-2.5 text-left">
                        Overtime Session
                      </h3>
                      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                        <InputField label="OT In" id="ot_In" value={formData.ot_In} />
                        <InputField label="OT Out" id="ot_Out" value={formData.ot_Out} />
                      </div>
                    </div>

                    {/* Status Dropdown Segment */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-gray-100 pb-1 mb-2.5 text-left">
                        Attendance Status
                      </h3>
                      <div className="w-full flex flex-col gap-1 text-left">
                        <label htmlFor="attendance_StatusId" className="text-xs font-bold text-[#2A174E]">
                          Status Label
                        </label>
                        <select
                          id="attendance_StatusId"
                          value={formData.attendance_StatusId}
                          onChange={handleInput}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-gray-200 rounded-lg outline-none text-xs focus:bg-white focus:border-[#2A174E] focus:ring-1 focus:ring-[#2A174E]/20 transition-all font-semibold text-slate-700"
                        >
                          {statusOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Compact Footer Actions Container Row */}
                    <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => navigate(backPath)}
                        className="px-5 py-2 text-xs font-bold text-[#2A174E]/70 hover:text-[#2A174E] bg-white border border-[#2A174E]/20 rounded-lg hover:bg-slate-50 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#2A174E] rounded-lg hover:bg-[#7A52B5] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-all shadow-sm"
                      >
                        {loading ? "Saving..." : "Save Changes"}
                      </button>
                    </div>

                  </form>
                </div>

              </div>
            </CardContent>
          </Card>
        </div>
      </Sidebar>
    </div>
  );
};

export default EditAttendance;