import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSettings } from '../contexts/SettingsContext'
import pkg from '../../package.json'

export default function Layout({ children, setAuth }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { t, i18n } = useTranslation()
    const { settings } = useSettings()
    const user = JSON.parse(localStorage.getItem('user') || '{}')
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)
    const settingsRef = useRef(null)
    const profileRef = useRef(null)

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

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setSettingsOpen(false)
            }
            if (profileRef.current && !profileRef.current.contains(event.target)) {
                setProfileOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Main navigation items (without settings-related items)
    const navigation = [
        { name: t('nav.dashboard'), href: '/' },
        { name: t('nav.tenants'), href: '/tenants' },
        { name: t('nav.domains'), href: '/domains' },
        { name: t('nav.users'), href: '/users' },
        { name: t('nav.aliases'), href: '/aliases' },
        { name: t('nav.policies'), href: '/policies' },
        { name: t('nav.quarantine'), href: '/quarantine' },
        { name: t('nav.aiVerdicts', 'IA'), href: '/ai-verdicts' }
    ]

    // Settings dropdown items
    const settingsItems = [
        { name: t('nav.settings', 'Configurações'), href: '/settings' },
        { name: t('nav.manager', 'Gerenciamento'), href: '/manager' },
        { name: t('nav.services', 'Serviços'), href: '/services' },
        { name: t('nav.logs', 'Logs'), href: '/logs' },
        { name: t('nav.audit', 'Auditoria'), href: '/audit' },
        { name: t('nav.help'), href: '/help' },
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
                            <div className="flex-shrink-0 flex items-center ml-2 border-l pl-2 border-gray-300 h-6">
                                <span className="text-xs text-gray-400 font-mono">
                                    {(settings.version || pkg.version || '1.0.0').startsWith('v')
                                        ? (settings.version || pkg.version || '1.0.0')
                                        : `v${settings.version || pkg.version || '1.0.0'}`}
                                </span>
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
                                                        {item.name}
                                                    </Link>
                                                ))}

                                                {/* Language Selector in dropdown */}
                                                <div className="border-t border-gray-100 mt-1 pt-1">
                                                    <div className="px-4 py-2">
                                                        <p className="text-xs text-gray-500 mb-2">{t('nav.language', 'Idioma')}</p>
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
                            {/* Profile Dropdown */}
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 focus:outline-none"
                                >
                                    <div className="bg-gray-200 rounded-full p-2">
                                        <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <span className="hidden md:block text-sm font-medium">{user.username || user.email || 'Usuário'}</span>
                                    <svg className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>

                                {profileOpen && (
                                    <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                                        <div className="py-1">
                                            <div className="px-4 py-2 border-b border-gray-100">
                                                <p className="text-sm font-medium text-gray-900 truncate">{user.email || 'user@example.com'}</p>
                                            </div>
                                            <Link
                                                to="/profile"
                                                onClick={() => setProfileOpen(false)}
                                                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                            >
                                                <span className="mr-3">👤</span>
                                                {t('nav.profile', 'Meu Perfil')}
                                            </Link>
                                            <button
                                                onClick={handleLogout}
                                                className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                <span className="mr-3">🚪</span>
                                                {t('nav.logout')}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
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
