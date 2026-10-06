import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { MapPage } from './pages/MapPage';
import { AddMenderPage } from './pages/AddMenderPage';
import { AboutPage } from './pages/AboutPage';
import { AdminPage } from './pages/AdminPage';
import { ToastProvider } from './components/ui/toaster';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="mymenders-textile-surface min-h-screen bg-backdrop flex flex-col mymenders-body-font">
          <Routes>
            <Route path="/admin/menders/:id" element={<AdminPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="/*" element={<PublicApp />} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

function PublicApp() {
  return <>
    <Navbar />
    <Routes>
      <Route index element={<AboutPage homepage />} />
      <Route path="map" element={<MapPage />} />
      <Route path="add" element={<AddMenderPage />} />
      <Route path="about" element={<AboutPage homepage />} />
    </Routes>
  </>;
}
