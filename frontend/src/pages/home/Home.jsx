import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import "./home.scss";
import Widget from "../../components/widget/Widget";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import OccupancyList from "../../components/occupancy/OccupancyList";

const Home = () => {
  return (
    <div className="home">
      <Sidebar />
      <div className="homeContainer">
        <Navbar />
        <div className="widgets">
          <Widget type="officeOccupancy" />
          <Widget type="onTime" />
          <Widget type="lateArrivals" />
        </div>
        <div className="charts">
          <Featured />
          <Chart title="Attendance Comparison Chart" aspect={2 / 1} />
        </div>
        <div className="listContainer">
          <OccupancyList />
        </div>
      </div>
    </div>
  );
};

export default Home;
