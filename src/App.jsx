import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { WorkflowProvider } from './context/WorkflowContext';
import ProtectedRoute from './layouts/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import JobWorkHub from './pages/JobWorkHub';
import InventoryStock from './pages/InventoryStock';
import SalesDispatch from './pages/SalesDispatch';
import DirectorySettings from './pages/DirectorySettings';

function App() {
  return (
    <AuthProvider>
      <WorkflowProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/job-work" 
              element={
                <ProtectedRoute>
                  <JobWorkHub />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/inventory" 
              element={
                <ProtectedRoute>
                  <InventoryStock />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sales" 
              element={
                <ProtectedRoute>
                  <SalesDispatch />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/directory" 
              element={
                <ProtectedRoute>
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
  );
}

export default App;
