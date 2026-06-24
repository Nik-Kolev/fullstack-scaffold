import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const socials = [
  {
    label: 'GitHub',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    label: 'X / Twitter',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.727-8.836L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.209-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
]

export default function Footer() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-muted/50 border-t">
      <div className="mx-auto max-w-7xl px-6 py-6 md:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div className="order-2 flex flex-col items-center gap-4 md:order-1 md:items-start">
            <Link to="/" className="flex items-center gap-2 font-bold">
              <Layers className="h-5 w-5" />
              Scaffold
            </Link>
            <p className="text-muted-foreground max-w-sm text-center text-sm leading-relaxed md:max-w-xs md:text-left">
              {t('footer.description')}
            </p>
            <div className="mt-2 flex gap-5">
              {socials.map(({ label, href, icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          <div className="order-1 grid grid-cols-1 gap-6 md:order-2 md:grid-cols-[auto_auto_auto] md:gap-16">
            <div className="space-y-3 text-center md:text-left">
              <h3 className="text-xs font-semibold tracking-wider uppercase">
                {t('footer.columns.pages')}
              </h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <Link to="/" className="hover:text-foreground transition-colors">
                    {t('footer.links.home')}
                  </Link>
                </li>
                <li>
                  <Link to="/dashboard" className="hover:text-foreground transition-colors">
                    {t('footer.links.dashboard')}
                  </Link>
                </li>
                <li>
                  <Link to="/upload" className="hover:text-foreground transition-colors">
                    {t('footer.links.upload')}
                  </Link>
                </li>
                <li>
                  <Link to="/live" className="hover:text-foreground transition-colors">
                    {t('footer.links.live')}
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <h3 className="text-xs font-semibold tracking-wider uppercase">
                {t('footer.columns.company')}
              </h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    {t('footer.links.about')}
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    {t('footer.links.contact')}
                  </a>
                </li>
              </ul>
            </div>

            <div className="space-y-3 text-center md:text-left">
              <h3 className="text-xs font-semibold tracking-wider uppercase">
                {t('footer.columns.legal')}
              </h3>
              <ul className="text-muted-foreground space-y-2 text-sm">
                <li>
                  <Link to="/terms" className="hover:text-foreground transition-colors">
                    {t('footer.links.terms')}
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="hover:text-foreground transition-colors">
                    {t('footer.links.privacy')}
                  </Link>
                </li>
                <li>
                  <Link to="/cookies" className="hover:text-foreground transition-colors">
                    {t('footer.links.cookies')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-muted-foreground mt-6 flex flex-col items-center gap-3 border-t pt-6 text-sm sm:flex-row sm:justify-between">
          <div className="order-1 flex gap-6 sm:order-2">
            <Link to="/terms" className="hover:text-foreground transition-colors">
              {t('footer.links.terms')}
            </Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">
              {t('footer.links.privacy')}
            </Link>
          </div>
          <span className="order-2 sm:order-1">
            © {year} Scaffold. {t('footer.copyright')}
          </span>
        </div>
      </div>
    </footer>
  )
}
