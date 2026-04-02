import "./occupancy.scss";
import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatUserId } from "../../utils/formatUserId";
import { useSystemTime } from "../../context/SystemTimeContext";

// Returns milliseconds from current time until the next 12:00 AM (midnight)
const msUntilMidnight = (currentTime) => {
  const midnight = new Date(currentTime);
  midnight.setHours(24, 0, 0, 0); 
  return midnight - currentTime;
};

const OccupancyList = () => {
  const { systemToday } = useSystemTime();
  const [users, setUsers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const midnightTimeoutRef = useRef(null);

  const fetchOccupancy = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "/api/attendance/occupancy",
      );
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users ?? []);
        setCount(data.count ?? 0);
        setLastUpdated(new Date());
      } else {
        console.error("Failed to fetch office occupancy");
      }
    } catch (err) {
      console.error("Error fetching office occupancy:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchOccupancy();
  }, [fetchOccupancy]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchOccupancy, 30000);
    return () => clearInterval(interval);
  }, [fetchOccupancy]);

  // At exactly midnight, clear the list instantly (new day = no one in office yet)
  // then re-fetch to confirm with the backend (returns empty for the new day)
  useEffect(() => {
    const scheduleMidnightReset = () => {
      midnightTimeoutRef.current = setTimeout(() => {
        // Instant visual reset at 12:00 AM
        setUsers([]);
        setCount(0);
        setLastUpdated(new Date(systemToday));
        // Confirm with backend (will return empty for the new day)
        fetchOccupancy();
        // Re-schedule for the following midnight (24 hrs from now)
        scheduleMidnightReset();
      }, msUntilMidnight(systemToday));
    };

    scheduleMidnightReset();

    return () => {
      if (midnightTimeoutRef.current) {
        clearTimeout(midnightTimeoutRef.current);
      }
    };
  }, [fetchOccupancy]);

  return (
    <div className="occupancyList">
      {/* ── Header ── */}
      <div className="occupancyHeader">
        <div className="occupancyHeaderLeft">
          <MeetingRoomOutlinedIcon className="headerIcon" />
          <span className="headerTitle">Currently In Office</span>
          <span className="occupancyBadge">{count}</span>
        </div>
        <div className="occupancyHeaderRight">
          {lastUpdated && (
            <span className="lastUpdated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="refreshBtn"
            onClick={fetchOccupancy}
            disabled={loading}
            aria-label="Refresh occupancy"
          >
            <RefreshIcon
              fontSize="small"
              className={loading ? "spinning" : ""}
            />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {loading && users.length === 0 ? (
        <div className="occupancyEmpty">Loading...</div>
      ) : users.length === 0 ? (
        <div className="occupancyEmpty">
          <PersonOutlinedIcon className="emptyIcon" />
          <span>No one is currently in the office.</span>
        </div>
      ) : (
        <table className="occupancyTable">
          <thead>
            <tr>
              <th>#</th>
              <th>User ID</th>
              <th>Name</th>
              <th>Time In</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, index) => (
              <tr key={u.user_id}>
                <td className="indexCell">{index + 1}</td>
                <td className="idCell">{formatUserId(u.user_Id)}</td>
                <td className="nameCell">
                  <div className="nameWrapper">
                    <div className="avatar">
                      {u.firstName?.charAt(0).toUpperCase()}
                    </div>
                    <span>
                      {u.firstName} {u.lastName}
                    </span>
                  </div>
                </td>
                <td className="timeCell">
                  <span className="timeBadge">{u.time_In ?? "—"}</span>
                </td>
                <td className="actionCell">
                  <Link
                    to={`/users/${u.user_Id}`}
                    style={{ textDecoration: "none" }}
                  >
                    <div className="viewButton">View</div>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default OccupancyList;
