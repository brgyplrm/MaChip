import Sidebar from "../../components/Sidebar";
import Datatable from "../../components/datatable/Datatable"
//import PageTransition from "../../components/PageTransition/PageTransition"

const List = () => {
  return (

    <div className="flex min-h-screen overflow-x-hidden w-full">
      <Sidebar>
      <div className="flex-1 min-w-0">
        <Datatable/>
      </div>
      </Sidebar>
    </div>
  )
}

export default List;