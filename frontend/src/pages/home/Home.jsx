import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";
import "./home.scss";
import Widget from "../../components/widget/Widget";
import Featured from "../../components/featured/Featured";
import Chart from "../../components/chart/Chart";
import Table from "../../components/table/Table";
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';

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
          <div className="listTitle">
            <MeetingRoomOutlinedIcon className="icon" />
            Office Recent
          </div>
          <Table />
        </div>
      </div>
    </div>
  );
};

export default Home;
