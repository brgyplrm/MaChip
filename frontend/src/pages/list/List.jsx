import "./list.scss"
import Sidebar from "../../components/sidebar/Sidebar"
import Navbar from "../../components/navbar/Navbar"
import Datatable from "../../components/datatable/Datatable"
import PageTransition from "../../components/PageTransition/PageTransition"

const List = () => {
  return (
    <div className="list">
      <Sidebar/>
      <div className="listContainer">
        <Navbar/>
        <PageTransition>
          <Datatable/>
        </PageTransition>
      </div>
    </div>
  )
}

export default List