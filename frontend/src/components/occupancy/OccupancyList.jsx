import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatUserId } from "../../utils/formatUserId";
import { useSystemTime } from "../../context/SystemTimeContext";
import { fetchWithAuth } from "../../utils/api";
import SearchOffIcon from '@mui/icons-material/SearchOff';
import EmptyState from "../EmptyState";
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';

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
      const response = await fetchWithAuth(
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

  // Fetch on mount and listen for real-time refreshes
  useEffect(() => {
    fetchOccupancy();

    window.addEventListener("dataRefresh", fetchOccupancy);
    return () => window.removeEventListener("dataRefresh", fetchOccupancy);
  }, [fetchOccupancy]);

  // Auto-refresh every 60 seconds (Reduced from 5s to prevent 429 errors)
  useEffect(() => {
    const interval = setInterval(fetchOccupancy, 60000);
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
    <div className="bg-white rounded-xl shadow-[2px_4px_10px_1px_rgba(201,201,201,0.47)] overflow-x-auto animate-[fadeInUp_0.3s_ease]">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[#2a174e] text-white">
        <div className="flex items-center gap-2.5">
          <MeetingRoomOutlinedIcon className="!text-[20px] text-white/85" />
          <span className="text-[15px] font-semibold tracking-wide">Currently In Office</span>
          <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-[#1e7e4e] text-white text-[13px] font-bold">
            {count}
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          {lastUpdated && (
            <span className="text-[11px] text-white/60">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full bg-white/10 hover:enabled:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 cursor-pointer"
            onClick={fetchOccupancy}
            disabled={loading}
            aria-label="Refresh occupancy"
          >
            <RefreshIcon
              fontSize="small"
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {loading && users.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-[#aaa] text-sm font-medium">Loading...</div>
      ) : users.length === 0 ? (
          <div className="p-5">
              <EmptyState 
                icon={<MeetingRoomIcon className="w-8 h-8 text-slate-300" />}
                title="Office is Empty"
                description="There are currently no employee entry or exit logs recorded for today."
              />
          </div>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#f7f5ff]">
              <th className="px-4 py-2.5 text-left font-semibold text-[#555] border-b border-[#eee] whitespace-nowrap">#</th>
              <th className="px-4 py-2.5 text-left font-semibold text-[#555] border-b border-[#eee] whitespace-nowrap">User ID</th>
              <th className="px-4 py-2.5 text-left font-semibold text-[#555] border-b border-[#eee] whitespace-nowrap">Name</th>
              <th className="px-4 py-2.5 text-left font-semibold text-[#555] border-b border-[#eee] whitespace-nowrap">Time In</th>
              <th className="px-4 py-2.5 text-left font-semibold text-[#555] border-b border-[#eee] whitespace-nowrap text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, index) => (
              <tr key={u.user_id} className="border-b border-[#f0f0f0] last:border-b-0 hover:bg-[#faf8ff] transition-colors duration-150">
                <td className="px-4 py-2.5 text-[#aaa] text-xs w-8 align-middle">{index + 1}</td>
                <td className="px-4 py-2.5 font-semibold text-[#2a174e] text-xs align-middle">{formatUserId(u.user_Id)}</td>
                <td className="px-4 py-2.5 align-middle">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#2a174e] text-white flex items-center justify-center text-[13px] font-bold shrink-0 uppercase">
                      {u.firstName?.charAt(0)}
                    </div>
                    <span className="font-medium whitespace-nowrap text-[#333]">
                      {u.firstName} {u.lastName}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 align-middle">
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#1e7e4e]/10 text-[#1e7e4e] text-xs font-semibold whitespace-nowrap">
                    {u.time_In ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-middle text-right">
                  <Link
                    to={`/users/${u.user_Id}`}
                    className="inline-block px-3.5 py-1 rounded-[5px] border-[1.5px] border-[#2a174e] text-[#2a174e] text-xs font-semibold hover:bg-[#2a174e] hover:text-white transition-all duration-200 no-underline cursor-pointer"
                  >
                    View
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
