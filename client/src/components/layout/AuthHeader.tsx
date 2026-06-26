import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export default function AuthHeader() {
  const { i18n } = useTranslation()
  const isEnglish = i18n.resolvedLanguage === 'en'
  const toggleLang = () => i18n.changeLanguage(isEnglish ? 'bg' : 'en')

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <Link to="/" className="inline-flex items-center gap-2 font-bold tracking-tight">
        <Layers className="h-5 w-5" />
        <span>Scaffold</span>
      </Link>
      <button
        onClick={toggleLang}
        aria-label={isEnglish ? 'Switch to Bulgarian' : 'Switch to English'}
        className="text-muted-foreground hover:text-foreground w-8 text-sm font-medium transition-colors"
      >
        {isEnglish ? 'BG' : 'EN'}
      </button>
    </header>
  )
}
