import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import Access from "./pages/Access";
import Detail from "./pages/Detail";
import Form from "./pages/Form";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navbar />
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/detail/:id"
        element={
          <ProtectedRoute>
            <Navbar />
            <Detail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add"
        element={
          <RoleRoute allowedRoles={["admin", "operator"]}>
            <Navbar />
            <Form />
          </RoleRoute>
        }
      />
      <Route
        path="/edit/:id"
        element={
          <RoleRoute allowedRoles={["admin", "operator"]}>
            <Navbar />
            <Form />
          </RoleRoute>
        }
      />
      <Route
        path="/access"
        element={
          <RoleRoute allowedRoles={["admin"]}>
            <Navbar />
            <Access />
          </RoleRoute>
        }
      />
    </Routes>
  );
}

export default App;
