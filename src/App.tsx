import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Auth } from './pages/Auth';
import { Notes } from './pages/Notes';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Route */}
          <Route path="/auth" element={<Auth />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Notes />} />
              <Route path="/note/:id" element={<Notes />} />
              <Route path="/shared" element={<Notes />} />
              <Route path="/favorites" element={<Notes />} />
              <Route path="/archive" element={<Notes />} />
              <Route path="/trash" element={<Notes />} />
              <Route path="/folder/:id" element={<Notes />} />
              <Route path="/tag/:id" element={<Notes />} />
              <Route path="/search" element={<Notes />} />
              <Route path="/analytics" element={<Notes />} />
              <Route path="/activity" element={<Notes />} />
              <Route path="/settings" element={<Notes />} />
            </Route>
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
