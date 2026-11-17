import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import './index.css';
import './components/redesign/VibeDietTheme.css';

if (typeof document !== 'undefined') {
  const savedTheme = localStorage.getItem('vibediet_theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
