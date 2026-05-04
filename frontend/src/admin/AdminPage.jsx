/* Legacy entry point — redirects to the new admin shell at /admin */
import { Navigate } from "react-router-dom";

export default function AdminPage() {
  return <Navigate to="/admin" replace />;
}
