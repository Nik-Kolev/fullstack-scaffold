import { Layers, LogOut, Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

const publicLinks = [
  { to: '/terms', labelKey: 'nav.terms' },
  { to: '/privacy', labelKey: 'nav.privacy' },
  { to: '/cookies', labelKey: 'nav.cookies' },
]

const authLinks = [
  { to: '/dashboard', labelKey: 'nav.dashboard' },
  { to: '/upload', labelKey: 'nav.upload' },
  { to: '/live', labelKey: 'nav.live' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative w-fit whitespace-nowrap pb-1 text-foreground transition-colors',
    'after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-foreground after:transition-transform after:duration-200',
    isActive ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100',
  ].join(' ')

export default function Navbar() {
  const { t, i18n } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handle = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [menuOpen])

  const isEnglish = i18n.resolvedLanguage === 'en'
  const toggleLang = () => i18n.changeLanguage(isEnglish ? 'bg' : 'en')
  const handleLogout = async () => {
    await logout()
    navigate('/')
  }
  const handleMobileNav = () => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  return (
    <header ref={headerRef} className="bg-muted/80 sticky top-0 z-50 border-b backdrop-blur-sm">
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-3 items-center px-6">
        <Link to="/" className="inline-flex w-fit items-center gap-2.5 font-bold tracking-tight">
          <Layers className="h-6 w-6" />
          <span className="text-xl">Scaffold</span>
        </Link>

        <nav className="hidden items-center justify-center gap-8 text-base font-medium md:flex">
          <NavLink to="/" end className={linkClass}>
            {t('nav.home')}
          </NavLink>
          {publicLinks.map(({ to, labelKey }) => (
            <NavLink key={to} to={to} className={linkClass}>
              {t(labelKey)}
            </NavLink>
          ))}
          {user &&
            authLinks.map(({ to, labelKey }) => (
              <NavLink key={to} to={to} className={linkClass}>
                {t(labelKey)}
              </NavLink>
            ))}
        </nav>

        <div className="col-start-3 flex items-center justify-end gap-3">
          <button
            onClick={toggleLang}
            aria-label={isEnglish ? 'Switch to Bulgarian' : 'Switch to English'}
            className="text-muted-foreground hover:text-foreground w-8 text-sm font-medium transition-colors"
          >
            {isEnglish ? 'BG' : 'EN'}
          </button>

          <div className="bg-border h-5 w-px md:hidden" />

          <div className="hidden items-center gap-3 md:flex">
            <div className="bg-border h-5 w-px" />
            {user ? (
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">{t('common.login')}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">{t('common.register')}</Link>
                </Button>
              </>
            )}
          </div>

          <button
            className="text-foreground transition-colors md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="animate-in slide-in-from-top-2 fade-in bg-background absolute inset-x-0 top-16 z-40 border-b px-6 py-4 shadow-md duration-200 md:hidden">
          <nav className="flex flex-col items-center gap-4 text-sm font-medium">
            <NavLink to="/" end className={linkClass} onClick={handleMobileNav}>
              {t('nav.home')}
            </NavLink>
            {publicLinks.map(({ to, labelKey }) => (
              <NavLink key={to} to={to} className={linkClass} onClick={handleMobileNav}>
                {t(labelKey)}
              </NavLink>
            ))}
            {user &&
              authLinks.map(({ to, labelKey }) => (
                <NavLink key={to} to={to} className={linkClass} onClick={handleMobileNav}>
                  {t(labelKey)}
                </NavLink>
              ))}
          </nav>
          <div className="mt-4 flex items-center justify-center gap-3 border-t pt-4">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await handleLogout()
                  handleMobileNav()
                }}
              >
                <LogOut className="h-4 w-4" />
                {t('common.logout')}
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login" onClick={handleMobileNav}>
                    {t('common.login')}
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register" onClick={handleMobileNav}>
                    {t('common.register')}
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
