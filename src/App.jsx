import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkflowProvider } from './context/WorkflowContext';
import { CustomAlertProvider } from './context/CustomAlertContext';
import ProtectedRoute from './layouts/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobWorkHub from './pages/JobWorkHub';
import InventoryStock from './pages/InventoryStock';
import SalesDispatch from './pages/SalesDispatch';
import DirectorySettings from './pages/DirectorySettings';
import ProcessMasters from './pages/ProcessMasters';

function DefaultRouteRedirect() {
  const { user, loading, defaultRoute } = useAuth();
  if (loading) {
    return (
      <div className="flex-center min-vh-100 bg-slate-900 text-white">
        <div className="spinner-loader"></div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={defaultRoute || '/job-work'} replace />;
}

function App() {
  return (
    <CustomAlertProvider>
      <AuthProvider>
        <WorkflowProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<DefaultRouteRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute module="dashboard">
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/job-work" 
                element={
                  <ProtectedRoute module="jobwork">
                    <JobWorkHub />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/inventory" 
                element={
                  <ProtectedRoute module="inventory">
                    <InventoryStock />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/sales" 
                element={
                  <ProtectedRoute module="sales">
                    <SalesDispatch />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/process-masters" 
                element={
                  <ProtectedRoute module="processMasters">
                    <ProcessMasters />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/directory" 
                element={
                  <ProtectedRoute module="directory">
                    <DirectorySettings />
                  </ProtectedRoute>
                } 
              />
              {/* Dynamic RBAC fallback route */}
              <Route path="*" element={<DefaultRouteRedirect />} />
            </Routes>
          </BrowserRouter>
        </WorkflowProvider>
      </AuthProvider>
    </CustomAlertProvider>
  );
}

export default App;
