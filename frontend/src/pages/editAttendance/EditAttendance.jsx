import "./editAttendance.scss";
import Sidebar from "../../components/Sidebar";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import Toast from "../../components/toast/Toast";
import { formatUserId } from "../../utils/formatUserId";
import { fetchWithAuth } from "../../utils/api";

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

  return (
    <div className="editAttendance">
      <Toast message={toast.message} type={toast.type} onClose={dismissToast} />
      <Sidebar>
      <div className="editAttendanceContainer">
        <div className="top">
          <h1>Edit Attendance (ID: {formatUserId(userId)})</h1>
          <span className="dateSubtitle">{new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div className="bottom">
          <div className="leftInfo">
            <div className="userInfo">
              <h2>{formData.userName}</h2>
              <p>User ID: {formatUserId(userId)}</p>
            </div>
            <div className={`statusIcon status-${formData.attendance_StatusId}`}>
              {statusOptions.find(o => o.id === parseInt(formData.attendance_StatusId))?.name || "Unknown"}
            </div>
          </div>
          <div className="rightForm">
            <form onSubmit={handleUpdate}>
              <div className="formSection">
                <h3>Morning Session</h3>
                <div className="inputGroup">
                  <div className="formInput">
                    <label>AM In</label>
                    <input
                      type="time"
                      id="morning_In"
                      value={formData.morning_In}
                      onChange={handleInput}
                    />
                  </div>
                  <div className="formInput">
                    <label>AM Out</label>
                    <input
                      type="time"
                      id="morning_Out"
                      value={formData.morning_Out}
                      onChange={handleInput}
                    />
                  </div>
                </div>
              </div>

              <div className="formSection">
                <h3>Afternoon Session</h3>
                <div className="inputGroup">
                  <div className="formInput">
                    <label>PM In</label>
                    <input
                      type="time"
                      id="afternoon_In"
                      value={formData.afternoon_In}
                      onChange={handleInput}
                    />
                  </div>
                  <div className="formInput">
                    <label>PM Out</label>
                    <input
                      type="time"
                      id="afternoon_Out"
                      value={formData.afternoon_Out}
                      onChange={handleInput}
                    />
                  </div>
                </div>
              </div>

              <div className="formSection">
                <h3>Overtime Session</h3>
                <div className="inputGroup">
                  <div className="formInput">
                    <label>OT In</label>
                    <input
                      type="time"
                      id="ot_In"
                      value={formData.ot_In}
                      onChange={handleInput}
                    />
                  </div>
                  <div className="formInput">
                    <label>OT Out</label>
                    <input
                      type="time"
                      id="ot_Out"
                      value={formData.ot_Out}
                      onChange={handleInput}
                    />
                  </div>
                </div>
              </div>

              <div className="formSection">
                <h3>Attendance Status</h3>
                <div className="formInput fullWidth">
                  <label>Status</label>
                  <select
                    id="attendance_StatusId"
                    value={formData.attendance_StatusId}
                    onChange={handleInput}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="formButtons">
                <button type="button" className="cancelBtn" onClick={() => navigate(backPath)}>
                  Cancel
                </button>
                <button type="submit" className="submitBtn" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      </Sidebar>
    </div>
  );
};

export default EditAttendance;
