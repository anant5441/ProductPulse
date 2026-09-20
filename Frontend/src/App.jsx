import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductDetails from './pages/ProductDetails';
import TrackingDetails from './pages/TrackingDetails';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout title="Dashboard">
                <Dashboard />
              </Layout>
            }
          />
          <Route
            path="/products"
            element={
              <Layout title="Product Catalog">
                <Products />
              </Layout>
            }
          />
          <Route
            path="/products/:id"
            element={
              <Layout title="Product Details" showTrackButton={false}>
                <ProductDetails />
              </Layout>
            }
          />
          <Route
            path="/tracked/:trackingId"
            element={
              <Layout title="Tracking Details" showTrackButton={false}>
                <TrackingDetails />
              </Layout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
