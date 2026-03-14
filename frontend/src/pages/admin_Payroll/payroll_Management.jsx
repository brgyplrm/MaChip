import "./payroll_Management.scss";
import Sidebar from "../../components/sidebar/Sidebar";
import Navbar from "../../components/navbar/Navbar";

const Payroll_Management = () => {

    return (
        <div className="payrollManagement">
            <Sidebar />
            <div className="payrollManagementContainer">
                <Navbar />
                <h1>Payroll Management</h1>
                {/* Add your payroll management content here */}
            </div>
        </div>
    );
}

export default Payroll_Management;

