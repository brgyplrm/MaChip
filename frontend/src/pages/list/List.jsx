import Sidebar from "../../components/Sidebar";
import Datatable from "../../components/datatable/Datatable"
//import PageTransition from "../../components/PageTransition/PageTransition"

const List = () => {
  return (

    <div className="flex min-h-screen overflow-x-hidden w-full">
      <Sidebar>
      <div className="p-2 md:p-0 overflow-x-hidden w-full max-w-6xl mx-auto">
        <Datatable/>
      </div>
      </Sidebar>
    </div>
  )
}

export default List;