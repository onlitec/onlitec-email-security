import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
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
import Layout from './components/Layout'

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const token = localStorage.getItem('token') || localStorage.getItem('accessToken')
        if (token) {
            setIsAuthenticated(true)
        }
        setLoading(false)
    }, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl">Loading...</div>
            </div>
        )
    }

    return (
        <Router>
            <Routes>
                <Route path="/login" element={
                    isAuthenticated ? <Navigate to="/" /> : <Login setAuth={setIsAuthenticated} />
                } />
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
                            </Routes>
                        </Layout>
                    ) : (
                        <Navigate to="/login" />
                    )
                } />
            </Routes>
        </Router>
    )
}

export default App
