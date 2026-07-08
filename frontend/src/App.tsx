import { Routes, Route } from 'react-router-dom'
import { MemphisGate } from '@thebes/sdk'
import { Layout } from './components/Layout'
import { Browse } from './pages/Browse'
import { ProductPage } from './pages/Product'
import { Cart } from './pages/Cart'
import { Checkout } from './pages/Checkout'
import { Orders } from './pages/Orders'
import { Admin } from './pages/Admin'

// Separate pages under one shell: browse / product / cart / checkout review /
// orders / admin back-office.
export function App() {
  return (
    <MemphisGate appName="Souk" tagline="Sign in to shop the on-chain souk.">
      <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Browse />} />
        <Route path="/p/:id" element={<ProductPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Browse />} />
      </Route>
    </Routes>
    </MemphisGate>
  )
}
