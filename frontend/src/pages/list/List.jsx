import "./list.scss"
import Sidebar from "../../components/Sidebar";
import Datatable from "../../components/datatable/Datatable"
//import PageTransition from "../../components/PageTransition/PageTransition"

const List = () => {
  return (
    <div className="list">
      <Sidebar/>
      <div className="listContainer">
        {/* <PageTransition> */}
          <Datatable/>
        {/* </PageTransition> */}
      </div>
    </div>
  )
}

export default List