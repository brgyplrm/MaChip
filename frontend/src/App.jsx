import Home from "./pages/home/Home";
import Login from "./pages/login/Login";
import List from "./pages/list/List";
import Single from "./pages/single/Single";
import New from "./pages/new/New";
import Edit from "./pages/edit/Edit";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { productInputs, userInputs } from "./formSource";

function App() {

  return (
    <div className="app">
        <Routes>
          <Route path="/">
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            <Route path="users">
            <Route index element={<List />} />
            {/* Wrap the Single and Edit routes under the ID parameter */}
            <Route path=":userId">
              <Route index element={<Single />} />
            </Route>
            <Route 
                path="edit/:userId" 
                element={<Edit inputs={userInputs} title="Edit User Profile" />} 
              />
            <Route
              path="new"
              element={<New inputs={userInputs} title="Add New User" />}
            />
          </Route>
            <Route path="products">
              <Route index element={<List />} />
              <Route path=":productId" element={<Single />} />
              <Route
                path="new"
                element={<New inputs={productInputs} title="Add New Product" />}
              />
            </Route>
          </Route>
        </Routes>
    </div>
  );
}

export default App;
