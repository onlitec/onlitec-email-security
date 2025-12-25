import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function Layout({ children, setAuth }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { t, i18n } = useTranslation()
    const user = JSON.parse(localStorage.getItem('user') || '{}')

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

    const navigation = [
        { name: t('nav.dashboard'), href: '/' },
        { name: t('nav.tenants'), href: '/tenants' },
        { name: t('nav.domains'), href: '/domains' },
        { name: t('nav.users'), href: '/users' },
        { name: t('nav.aliases'), href: '/aliases' },
        { name: t('nav.policies'), href: '/policies' },
        { name: t('nav.quarantine'), href: '/quarantine' },
        { name: t('nav.logs'), href: '/logs' },
        { name: t('nav.audit'), href: '/audit' },
        { name: t('nav.settings'), href: '/settings' },
        { name: t('nav.help'), href: '/help' }
    ]

    const isActive = (href) => {
        if (href === '/') return location.pathname === '/'
        return location.pathname.startsWith(href)
    }

    return (
        <div className="min-h-screen bg-gray-100">
            <nav className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="flex-shrink-0 flex items-center">
                                <h1 className="text-xl font-bold text-blue-600">Onlitec Email</h1>
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
                            </div>
                        </div>
                        <div className="flex items-center space-x-4">
                            {/* Language Selector */}
                            <div className="relative">
                                <select
                                    value={i18n.language}
                                    onChange={(e) => changeLanguage(e.target.value)}
                                    className="appearance-none bg-gray-100 border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    <option value="pt-BR">🇧🇷 PT</option>
                                    <option value="en">🇺🇸 EN</option>
                                </select>
                            </div>
                            <Link to="/profile" className="text-sm text-gray-700 hover:text-blue-600">
                                {user.email}
                            </Link>
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                            >
                                {t('nav.logout')}
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
