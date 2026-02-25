import "./navbar.scss";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import { Link } from "react-router-dom";

const Navbar = () => {

  return (
    <div className="navbar">
      <div className="wrapper">
        <div className="search">
          <input type="text" placeholder="Search..." />
          <SearchOutlinedIcon />
        </div>
        <div className="items">
          <Link to="/notifications">
          <div className="item">
            <NotificationsNoneOutlinedIcon className="icon" />
            <div className="counter">3</div>
          </div>
          </Link>
          <Link to="/profile">
          <div className="item">
            <img
              src="/avatar.webp"
              alt=""
              className="avatar"
            />
          </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
