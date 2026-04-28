import "./profile.scss";
import Sidebar from "../../components/Sidebar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchWithAuth } from "../../utils/api";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const userDataString = localStorage.getItem("userData");
      const userData = userDataString ? JSON.parse(userDataString) : null;
      const userId = userData?.user_Id;

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetchWithAuth(`/api/users/${userId}`);
        if (response.ok) {
          const data = await response.json();
          setUser(data);
          // Optional: Update localStorage if backend data is newer
          localStorage.setItem("userData", JSON.stringify(data));
        } else {
          console.error("Failed to fetch profile");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="profile">
        <Sidebar />
        <div className="profileContainer">
          <div className="profileWrapper">
            <p>Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="profile">
        <Sidebar />
        <div className="profileContainer">
          <Navbar />
          <div className="profileWrapper">
            <p>No user data found.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile">
      <Sidebar />
      <div className="profileContainer">
        <Navbar />
        <div className="profileWrapper">
          <div className="heroSection">
            <div className="profileHeader">
              <div className="imageContainer">
                <img
                  src={user.user_ProfilePic ? `/api/uploads/${user.user_ProfilePic}` : "/avatar.webp"}
                  alt="Profile"
                  className="profileImg"
                  onError={(e) => { e.target.src = "/avatar.webp"; }}
                />
              </div>
              <div className="mainInfo">
                <h1 className="name">
                  {user.user_FirstName} {user.user_LastName}
                </h1>
                <span className="roleTag">{user.user_Role || "—"}</span>
              </div>
              <Link
                to={`/users/edit/${user.user_Id}`}
                style={{ textDecoration: "none" }}
              >
                <button className="editBtn">
                  <EditOutlinedIcon className="icon" />
                  Edit Profile
                </button>
              </Link>
            </div>

            <div className="detailsGrid">
              <div className="detailBox">
                <span className="label">User ID</span>
                <span className="value">{formatUserId(user.user_Id)}</span>
              </div>
              <div className="detailBox">
                <span className="label">Email Address</span>
                <span className="value">{user.user_Email || "—"}</span>
              </div>
              <div className="detailBox">
                <span className="label">MaChip ID</span>
                <span className="value">{user.user_MachipId || "—"}</span>
              </div>
            </div>
          </div>

          <div className="chartSection">
            <Chart
              aspect={4 / 1}
              title="Attendance Consistency (Last 6 Months)"
              userId={user.user_Id}
            />
          </div>

          <div className="tableSection">
            <div className="tableTitle">Personal Activity Logs</div>
            <Table userId={user.user_Id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
