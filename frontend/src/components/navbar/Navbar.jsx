import "./navbar.scss";
import NotificationsNoneOutlinedIcon from "@mui/icons-material/NotificationsNoneOutlined";
import NavigateNextIcon from '@mui/icons-material/NavigateNext'; // New Icon
import { Link, useLocation } from "react-router-dom"; // Added useLocation

const Navbar = () => {
  const location = useLocation();
  let currentLink = "";

  // Logic to split URL into breadcrumb links
  const crumbs = location.pathname.split("/")
    .filter((crumb) => crumb !== "")
    .map((crumb) => {
      currentLink += `/${crumb}`;
      return (
        <div className="crumb" key={crumb}>
          <NavigateNextIcon className="separator" />
          <Link to={currentLink}>{crumb.charAt(0).toUpperCase() + crumb.slice(1)}</Link>
        </div>
      );
    });

  return (
    <div className="navbar">
      <div className="wrapper">
        {/* REPLACED SEARCH WITH BREADCRUMBS */}
        <div className="breadcrumbs">
          <Link to="/" className="home-link">Dashboard</Link>
          {crumbs}
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
              <img src="/avatar.webp" alt="Profile" className="avatar" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;