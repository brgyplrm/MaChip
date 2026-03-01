import "./profile.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { formatUserId } from "../../utils/formatUserId";

const user = JSON.parse(localStorage.getItem("userData")) || {};

const Profile = () => {
  return (
    <div className="profile">
      <Sidebar />
      <div className="profileContainer">
        <Navbar />
        <div className="profileWrapper">
          {/* Top Section: Hero Profile Card */}
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
              <button className="editBtn">
                <EditOutlinedIcon className="icon" />
                Edit Profile
              </button>
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

          {/* Middle Section: Wide Chart */}
          <div className="chartSection">
            <Chart
              aspect={4 / 1}
              title="Attendance Consistency (Last 6 Months)"
            />
          </div>

          {/* Bottom Section: Logs */}
          <div className="tableSection">
            <div className="tableTitle">Personal Activity Logs</div>
            <Table />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
