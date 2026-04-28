import "./list.scss"
import Sidebar from "../../components/Sidebar";
import Datatable from "../../components/datatable/Datatable"
//import PageTransition from "../../components/PageTransition/PageTransition"

const List = () => {
  return (
    <div className="flex bg-[#fdfaf5] min-h-screen">
      <Sidebar/>
      {/* SPACER FOR FIXED SIDEBAR */}
      <div className="hidden sm:block w-64 flex-shrink-0"></div>

      <div className="flex-1 min-w-0 pt-20">
        <Datatable/>
      </div>
    </div>
  )
}

export default List