import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tenants from './pages/Tenants'
import Domains from './pages/Domains'
import Users from './pages/Users'
import Quarantine from './pages/Quarantine'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import Profile from './pages/Profile'
import Aliases from './pages/Aliases'
import Policies from './pages/Policies'
import AuditLog from './pages/AuditLog'
import Help from './pages/Help'
import Services from './pages/Services'
import AIVerdicts from './pages/AIVerdicts'
import Manager from './pages/Manager'
import AdminUsers from './pages/AdminUsers'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Layout from './components/Layout'
import { usePWA } from './hooks/usePWA'
import { SettingsProvider } from './contexts/SettingsContext'

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)
    const [showInstallBanner, setShowInstallBanner] = useState(true)
    const { t } = useTranslation()
    const { isInstallable, isInstalled, updateAvailable, promptInstall, reloadForUpdate } = usePWA()

    useEffect(() => {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken')
        if (token) {
            setIsAuthenticated(true)
        }
        setLoading(false)
    }, [])

    const handleInstall = async () => {
        const installed = await promptInstall()
        if (installed) {
            setShowInstallBanner(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <SettingsProvider>
            <Router>
                {/* PWA Update Available Banner */}
                {updateAvailable && (
                    <div className="fixed top-0 left-0 right-0 bg-blue-600 text-white px-4 py-3 flex items-center justify-between z-50">
                        <span className="text-sm">
                            🔄 {t('pwa.updateAvailable', 'Nova versão disponível!')}
                        </span>
                        <button
                            onClick={reloadForUpdate}
                            className="bg-white text-blue-600 px-3 py-1 rounded text-sm font-medium hover:bg-blue-50"
                        >
                            {t('pwa.updateNow', 'Atualizar agora')}
                        </button>
                    </div>
                )}

                {/* PWA Install Banner */}
                {isInstallable && !isInstalled && showInstallBanner && (
                    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white px-4 py-3 flex items-center justify-between z-50 shadow-lg">
                        <div className="flex items-center space-x-3">
                            <span className="text-2xl">📱</span>
                            <span className="text-sm">
                                {t('pwa.installPrompt', 'Instale o app para acesso rápido')}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setShowInstallBanner(false)}
                                className="text-gray-400 hover:text-white px-2 py-1 text-sm"
                            >
                                {t('common.later', 'Depois')}
                            </button>
                            <button
                                onClick={handleInstall}
                                className="bg-blue-500 hover:bg-blue-600 px-4 py-1 rounded text-sm font-medium"
                            >
                                {t('pwa.install', 'Instalar')}
                            </button>
                        </div>
                    </div>
                )}

                <Routes>
                    <Route path="/login" element={
                        isAuthenticated ? <Navigate to="/" /> : <Login setAuth={setIsAuthenticated} />
                    } />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/*" element={
                        isAuthenticated ? (
                            <Layout setAuth={setIsAuthenticated}>
                                <Routes>
                                    <Route path="/" element={<Dashboard />} />
                                    <Route path="/tenants" element={<Tenants />} />
                                    <Route path="/domains" element={<Domains />} />
                                    <Route path="/users" element={<Users />} />
                                    <Route path="/aliases" element={<Aliases />} />
                                    <Route path="/policies" element={<Policies />} />
                                    <Route path="/quarantine" element={<Quarantine />} />
                                    <Route path="/logs" element={<Logs />} />
                                    <Route path="/audit" element={<AuditLog />} />
                                    <Route path="/settings" element={<Settings />} />
                                    <Route path="/profile" element={<Profile />} />
                                    <Route path="/help" element={<Help />} />
                                    <Route path="/services" element={<Services />} />
                                    <Route path="/ai-verdicts" element={<AIVerdicts />} />
                                    <Route path="/manager" element={<Manager />} />
                                    <Route path="/admin-users" element={<AdminUsers />} />
                                </Routes>
                            </Layout>
                        ) : (
                            <Navigate to="/login" />
                        )
                    } />
                </Routes>
            </Router>
        </SettingsProvider>
    )
}

export default App

