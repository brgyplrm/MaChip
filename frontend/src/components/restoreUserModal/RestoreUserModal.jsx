import React, { useState, useEffect } from "react";
import "./restoreUserModal.scss";
import CloseIcon from "@mui/icons-material/Close";
import RestoreIcon from "@mui/icons-material/Restore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import WorkOutlineOutlinedIcon from "@mui/icons-material/WorkOutlineOutlined";
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import { fetchWithAuth } from "../../utils/api";

const RestoreUserModal = ({ isOpen, onClose, onConfirm, user, itemName, userId, loading }) => {
  const [positions, setPositions] = useState([]);
  const [formData, setFormData] = useState({
    hireDate: "",
    user_EmploymentStatusId: 1, // Default Regular
    department: "",
    position: "",
    position_id: "",
    dailyRate: ""
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      // Fetch positions
      fetchWithAuth("/api/positions")
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setPositions(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Error fetching positions in restore modal:", err));

      const today = new Date().toISOString().split("T")[0];
      setFormData({
        hireDate: today,
        user_EmploymentStatusId: 1, // Regular
        department: user?.positionDepartment || user?.department || "",
        position: user?.positionTitle || user?.position || "",
        position_id: user?.position_id ? user.position_id.toString() : "",
        dailyRate: user?.dailyRate !== undefined && user?.dailyRate !== null ? user.dailyRate : ""
      });
      setErrors({});
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Filter positions by department
  const uniqueDepartments = Array.from(new Set(positions.map((p) => p.department).filter(Boolean)));
  if (formData.department && !uniqueDepartments.includes(formData.department)) {
    uniqueDepartments.push(formData.department);
  }

  const availablePositions = formData.department
    ? positions.filter((p) => p.department === formData.department)
    : positions;

  const handleDepartmentChange = (e) => {
    const dept = e.target.value;
    setFormData((prev) => ({
      ...prev,
      department: dept,
      position: "",
      position_id: ""
    }));
  };

  const handlePositionChange = (e) => {
    const posId = e.target.value;
    const selected = positions.find((p) => p.positionId.toString() === posId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        position_id: selected.positionId.toString(),
        position: selected.title,
        dailyRate: prev.dailyRate || selected.dailyRate || prev.dailyRate
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        position_id: posId,
        position: posId
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!formData.hireDate) newErrors.hireDate = "Hire date is required";
    if (!formData.department) newErrors.department = "Department is required";
    if (!formData.position) newErrors.position = "Position is required";
    if (!formData.dailyRate || isNaN(parseFloat(formData.dailyRate)) || parseFloat(formData.dailyRate) <= 0) {
      newErrors.dailyRate = "Valid daily rate is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onConfirm({
      hireDate: formData.hireDate,
      user_EmploymentStatusId: parseInt(formData.user_EmploymentStatusId) || 1,
      department: formData.department,
      position: formData.position,
      position_id: formData.position_id ? parseInt(formData.position_id) : null,
      dailyRate: parseFloat(formData.dailyRate)
    });
  };

  return (
    <div className="restoreModalOverlay">
      <div className="restoreModalContainer">
        <div className="restoreModalHeader">
          <div className="iconTitle">
            <div className="restoreCircle">
              <RestoreIcon className="restoreIcon" />
            </div>
            <div>
              <h2>Re-Hire & Restore Employee</h2>
              <p className="subTitle">
                Reactivate <strong>{itemName}</strong> {userId ? `(${userId})` : ""} with updated employment details
              </p>
            </div>
          </div>
          <button className="closeBtn" onClick={onClose} disabled={loading} type="button">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="restoreModalBody">
            <div className="restoreFormGrid">
              {/* New Hire Date */}
              <div className="formGroup">
                <label>
                  <CalendarTodayOutlinedIcon className="inputIcon" />
                  New Hire Date <span className="req">*</span>
                </label>
                <input
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                  className={errors.hireDate ? "errorInput" : ""}
                />
                {errors.hireDate && <span className="errorText">{errors.hireDate}</span>}
                <span className="helperText">Refreshes tenure and annual leave allocations</span>
              </div>

              {/* Employment Status */}
              <div className="formGroup">
                <label>
                  <BadgeOutlinedIcon className="inputIcon" />
                  Employment Status <span className="req">*</span>
                </label>
                <select
                  value={formData.user_EmploymentStatusId}
                  onChange={(e) => setFormData({ ...formData, user_EmploymentStatusId: parseInt(e.target.value) })}
                >
                  <option value={1}>Regular</option>
                  <option value={2}>Probationary</option>
                </select>
                <span className="helperText">Employee will return to active directory</span>
              </div>

              {/* Department */}
              <div className="formGroup">
                <label>
                  <BusinessOutlinedIcon className="inputIcon" />
                  Department <span className="req">*</span>
                </label>
                <select
                  value={formData.department}
                  onChange={handleDepartmentChange}
                  className={errors.department ? "errorInput" : ""}
                >
                  <option value="">Select Department</option>
                  {uniqueDepartments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
                {errors.department && <span className="errorText">{errors.department}</span>}
              </div>

              {/* Position */}
              <div className="formGroup">
                <label>
                  <WorkOutlineOutlinedIcon className="inputIcon" />
                  Position <span className="req">*</span>
                </label>
                <select
                  value={formData.position_id || ""}
                  onChange={handlePositionChange}
                  className={errors.position ? "errorInput" : ""}
                  disabled={!formData.department}
                >
                  <option value="">{formData.department ? "Select Position" : "Choose department first"}</option>
                  {availablePositions.map((pos) => (
                    <option key={pos.positionId} value={pos.positionId}>
                      {pos.title}
                    </option>
                  ))}
                </select>
                {errors.position && <span className="errorText">{errors.position}</span>}
              </div>

              {/* Daily Rate */}
              <div className="formGroup fullWidth">
                <label>
                  <PaymentsOutlinedIcon className="inputIcon" />
                  Daily Rate (₱) <span className="req">*</span>
                </label>
                <div className="pesoInputWrapper">
                  <span className="pesoSign">₱</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value })}
                    className={errors.dailyRate ? "errorInput" : ""}
                  />
                </div>
                {errors.dailyRate && <span className="errorText">{errors.dailyRate}</span>}
                <span className="helperText">Updates live daily rate and logs audit rate history</span>
              </div>
            </div>

            <div className="restoreNoticeBox">
              <div className="boxHeader">
                <InfoOutlinedIcon className="smallNoticeIcon" />
                <h3>Data Preservation & Policy Notice</h3>
              </div>
              <ul>
                <li>All historical payroll slips, labor benefits records, and audit logs remain permanently preserved.</li>
                <li>Biometric RFID cards and fingerprint access can be re-registered on their respective hardware setup pages.</li>
              </ul>
            </div>
          </div>

          <div className="restoreModalActions">
            <button className="cancelBtn" onClick={onClose} disabled={loading} type="button">
              Cancel
            </button>
            <button className="restoreBtn" type="submit" disabled={loading}>
              {loading ? "Reactivating Account..." : "Confirm & Restore Employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RestoreUserModal;
