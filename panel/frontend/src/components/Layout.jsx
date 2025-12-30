import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../contexts/SettingsContext'

export default function Layout({ children, setAuth }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { t, i18n } = useTranslation()
    const { settings } = useSettings()
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const settingsRef = useRef(null)

    const handleLogout = () => {
        localStorage.removeItem('token')
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
        setAuth(false)
        navigate('/login')
    }

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng)
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setSettingsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Main navigation items (without settings-related items)
    const navigation = [
        { name: t('nav.dashboard'), href: '/', icon: '📊' },
        { name: t('nav.tenants'), href: '/tenants', icon: '🏢' },
        { name: t('nav.domains'), href: '/domains', icon: '🌐' },
        { name: t('nav.users'), href: '/users', icon: '👥' },
        { name: t('nav.aliases'), href: '/aliases', icon: '📧' },
        { name: t('nav.policies'), href: '/policies', icon: '📜' },
        { name: t('nav.quarantine'), href: '/quarantine', icon: '🔒' },
        { name: t('nav.quarantine'), href: '/quarantine', icon: '🔒' },
        { name: t('nav.aiVerdicts', 'IA'), href: '/ai-verdicts', icon: '🧠' }
    ]

    // Settings dropdown items
    const settingsItems = [
        { name: t('nav.settings', 'Configurações'), href: '/settings', icon: '⚙️' },
        { name: t('nav.manager', 'Gerenciamento'), href: '/manager', icon: '🔧' },
        { name: t('nav.services', 'Serviços'), href: '/services', icon: '⚡' },
        { name: t('nav.logs', 'Logs'), href: '/logs', icon: '📝' },
        { name: t('nav.audit', 'Auditoria'), href: '/audit', icon: '📋' },
        { name: t('nav.profile', 'Meu Perfil'), href: '/profile', icon: '👤' },
        { name: t('nav.help'), href: '/help', icon: '❓' },
    ]

    const isActive = (href) => {
        if (href === '/') return location.pathname === '/'
        return location.pathname.startsWith(href)
    }

    const isSettingsActive = settingsItems.some(item => isActive(item.href))

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                {settings.logo_url ? (
                                    <img
                                        src={settings.logo_url}
                                        alt={settings.site_name || 'Logo'}
                                        className="h-8 w-auto"
                                    />
                                ) : (
                                    <h1 className="text-xl font-bold text-blue-600">
                                        {settings.site_name || 'Onlitec Email'}
                                    </h1>
                                )}
                            </div>
                            <div className="hidden lg:ml-6 lg:flex lg:space-x-4">
                                {navigation.map((item) => (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${isActive(item.href)
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            }`}
                                    >
                                        <span className="mr-1">{item.icon}</span>
                                        {item.name}
                                    </Link>
                                ))}

                                {/* Settings Dropdown */}
                                <div className="relative" ref={settingsRef}>
                                    <button
                                        onClick={() => setSettingsOpen(!settingsOpen)}
                                        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-full ${isSettingsActive
                                            ? 'border-blue-500 text-gray-900'
                                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                                            }`}
                                    >
                                        <span className="mr-1">🛡️</span>
                                        {t('nav.admin', 'Admin')}
                                        <svg className={`ml-1 h-4 w-4 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>

                                    {settingsOpen && (
                                        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                                            <div className="py-1">
                                                {settingsItems.map((item) => (
                                                    <Link
                                                        key={item.href}
                                                        to={item.href}
                                                        onClick={() => setSettingsOpen(false)}
                                                        className={`flex items-center px-4 py-2 text-sm ${isActive(item.href)
                                                            ? 'bg-blue-50 text-blue-700'
                                                            : 'text-gray-700 hover:bg-gray-100'
                                                            }`}
                                                    >
                                                        <span className="mr-3 text-lg">{item.icon}</span>
                                                        {item.name}
                                                    </Link>
                                                ))}

                                                {/* Language Selector in dropdown */}
                                                <div className="border-t border-gray-100 mt-1 pt-1">
                                                    <div className="px-4 py-2">
                                                        <p className="text-xs text-gray-500 mb-2">🌍 {t('nav.language', 'Idioma')}</p>
                                                        <div className="flex space-x-2">
                                                            <button
                                                                onClick={() => changeLanguage('pt-BR')}
                                                                className={`px-3 py-1 rounded text-sm ${i18n.language === 'pt-BR' || i18n.language === 'pt'
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                    }`}
                                                            >
                                                                🇧🇷 PT
                                                            </button>
                                                            <button
                                                                onClick={() => changeLanguage('en')}
                                                                className={`px-3 py-1 rounded text-sm ${i18n.language === 'en'
                                                                    ? 'bg-blue-600 text-white'
                                                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                                    }`}
                                                            >
                                                                🇺🇸 EN
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-4 ml-auto pl-4 flex-shrink-0">
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 flex items-center space-x-1"
                            >
                                <span>🚪</span>
                                <span>{t('nav.logout')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="py-10">
                <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
