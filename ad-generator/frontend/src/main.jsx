import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#1a1f2e',
          color: '#e2e8f0',
          border: '1px solid #2d3748',
          borderRadius: '10px',
        },
        success: { iconTheme: { primary: '#3d6bff', secondary: '#fff' } },
      }}
    />
  </React.StrictMode>
)
