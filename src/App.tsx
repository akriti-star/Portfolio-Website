import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Admin from './pages/Admin';
import { AnimatePresence } from 'framer-motion';
import axios from 'axios';

// Create a PathTracker component that only tracks homepage visits
const PathTracker = () => {
  const location = useLocation();

  // Track only homepage visit once
  useEffect(() => {
    // Only track if we're on the homepage and not admin
    const trackHomepageVisit = async () => {
      try {
        if (location.pathname === '/' && !location.pathname.includes('admin')) {
          console.log('Tracking homepage visit');
          await axios.post(`${import.meta.env.VITE_API_URL}/api/track`, {
            path: '/',
            interactionType: 'pageview'
          });
        }
      } catch (error) {
        console.error('Tracking error:', error);
      }
    };

    trackHomepageVisit();
  }, [location.pathname]);

  return null;
};

function App() {
  return (
    <I18nextProvider i18n={i18n}>
      <Router>
        <div className="min-h-screen bg-[#0a0a0a] text-white">
          <PathTracker />
          <Navbar />
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/admin" element={<Admin />} />
            </Routes>
          </AnimatePresence>
        </div>
      </Router>
    </I18nextProvider>
  );
}

export default App;