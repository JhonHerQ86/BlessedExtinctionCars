import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
// Fonts are bundled locally (no Google Fonts requests / trackers).
import '@fontsource/metal-mania/400.css';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import './App.css';

createRoot(document.getElementById('root')).render(<App />);
