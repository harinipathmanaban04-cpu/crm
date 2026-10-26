import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider } from './auth.jsx';
import { SocketProvider } from './socket.jsx';
import { Toaster } from './ui.jsx';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthProvider><SocketProvider><App /><Toaster /></SocketProvider></AuthProvider></BrowserRouter>
);
