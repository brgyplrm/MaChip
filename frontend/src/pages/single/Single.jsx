import "./single.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import Chart from "../../components/chart/Chart";
import List from "../../components/table/Table";
import { Link, useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { formatUserId } from "../../utils/formatUserId";

const Single = () => {
  const { userId } = useParams();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(
          `http://localhost:4000/api/users/${userId}`,
        );
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        }
      } catch (err) {
        console.error("Error fetching user:", err);
      }
    };
    fetchUser();
  }, [userId]);

  return (
    <div className="single">
      <Sidebar />
      <div className="singleContainer">
        <Navbar />
        <div className="top">
          <div className="left">
            <div className="editButton">
              <Link
                to={`/users/edit/${userId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                Edit
              </Link>
            </div>
            <h1 className="title">Information</h1>
            {user ? (
              <div className="item">
                <img
                  src="https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&dpr=3&h=750&w=1260"
                  alt=""
                  className="itemImg"
                />
                <div className="details">
                  <h1
                    className="itemTitle"
                    id="user-name"
                  >{`${user.user_FirstName} ${user.user_LastName}`}</h1>

                  <div className="detailItem" id="user-id">
                    <span className="itemKey">User Id:</span>
                    <span className="itemValue">
                      {formatUserId(user.user_Id)}
                    </span>
                  </div>

                  <div className="detailItem" id="user-email">
                    <span className="itemKey">Email</span>
                    <span className="itemValue">{user.user_Email}</span>
                  </div>

                  <div className="detailItem" id="machip-id">
                    <span className="itemKey">Machip:</span>
                    <span className="itemValue">
                      {user.user_MachipId || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </div>
          <div className="right">
            <Chart aspect={3 / 1} title="User Attendance ( Last 6 Months )" userId={userId} />
          </div>
        </div>
        <div className="bottom">
          <h1 className="title">Last Activity Log</h1>
          <List userId={userId} />
        </div>
      </div>
    </div>
  );
};

export default Single;
