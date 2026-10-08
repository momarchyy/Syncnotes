import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Layout } from './components/layout/Layout';
import { Auth } from './pages/Auth';
import { Notes } from './pages/Notes';
import { Search } from './pages/Search';
import { Analytics } from './pages/Analytics';
import { Activity } from './pages/Activity';

import { ErrorBoundary } from './components/ui/ErrorBoundary';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
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
                  <Route path="/shared/note/:id" element={<Notes />} />
                  <Route path="/favorites" element={<Notes />} />
                  <Route path="/favorites/note/:id" element={<Notes />} />
                  <Route path="/archive" element={<Notes />} />
                  <Route path="/archive/note/:id" element={<Notes />} />
                  <Route path="/trash" element={<Notes />} />
                  <Route path="/trash/note/:id" element={<Notes />} />
                  <Route path="/folder/:folderId" element={<Notes />} />
                  <Route path="/folder/:folderId/note/:id" element={<Notes />} />
                  <Route path="/tag/:tagId" element={<Notes />} />
                  <Route path="/tag/:tagId/note/:id" element={<Notes />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/activity" element={<Activity />} />
                  <Route path="/settings" element={<Notes />} />
                </Route>
              </Route>

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
