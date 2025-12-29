import { createContext, useState, useEffect, useContext } from 'react'
import api from '../api'

const SettingsContext = createContext()

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState({
        site_name: 'Onlitec Email',
        logo_url: '',
        favicon_url: ''
    })
    const [loading, setLoading] = useState(true)

    const fetchSettings = async () => {
        try {
            // We need a public endpoint for branding, but currently /manager is protected.
            // For now, we'll try to fetch if we have a token, or we might need a public endpoint.
            // Let's assume we are authenticated for Layout, but for Login we might need a public route.
            // To make this robust, we should create a public endpoint for branding.
            // For now, let's try to fetch and handle errors gracefully.

            const token = localStorage.getItem('token')
            if (token) {
                const { data } = await api.get('/manager')
                if (data.data) {
                    setSettings(prev => ({ ...prev, ...data.data }))

                    // Update favicon dynamically
                    if (data.data.favicon_url) {
                        const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
                        link.type = 'image/x-icon';
                        link.rel = 'shortcut icon';
                        link.href = data.data.favicon_url;
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }

                    // Update title dynamically
                    if (data.data.site_name) {
                        document.title = data.data.site_name
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch settings', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSettings()
    }, [])

    return (
        <SettingsContext.Provider value={{ settings, fetchSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    )
}

export function useSettings() {
    return useContext(SettingsContext)
}
