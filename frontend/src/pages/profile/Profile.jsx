import "./profile.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatUserId } from "../../utils/formatUserId";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const userId = localStorage.getItem("token"); // Token stores the numeric user_Id
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/users/${userId}`);
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
          <Navbar />
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
                  src="https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=3&h=750&w=1260"
                  alt="Profile"
                  className="profileImg"
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
              <div className="detailBox">
                <span className="label">Username</span>
                <span className="value">{user.user_Username || "—"}</span>
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
