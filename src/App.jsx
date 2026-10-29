import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
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

function App() {
  return (
    <CustomAlertProvider>
      <AuthProvider>
        <WorkflowProvider>
          <BrowserRouter>
            <Routes>
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
              {/* Default redirect to /dashboard */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </WorkflowProvider>
      </AuthProvider>
    </CustomAlertProvider>
  );
}

export default App;
