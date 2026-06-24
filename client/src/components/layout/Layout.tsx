import { Outlet, useLocation } from 'react-router-dom'

import CookieBanner from './CookieBanner'
import Footer from './Footer'
import Navbar from './Navbar'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <div
          key={location.pathname}
          className="animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <Outlet />
        </div>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  )
}
