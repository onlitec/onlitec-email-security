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
            const token = localStorage.getItem('token')

            if (token) {
                // If authenticated, try to get full settings from /manager
                try {
                    const { data } = await api.get('/manager')
                    if (data.data) {
                        setSettings(prev => ({ ...prev, ...data.data }))
                        updateBranding(data.data)
                        return
                    }
                } catch (err) {
                    // If /manager fails (403), fall back to public endpoint
                    console.log('Manager endpoint not accessible, using public branding')
                }
            }

            // Use public branding endpoint (no auth required)
            const { data } = await api.get('/config/branding')
            if (data.data) {
                setSettings(prev => ({ ...prev, ...data.data }))
                updateBranding(data.data)
            }
        } catch (err) {
            console.error('Failed to fetch settings', err)
        } finally {
            setLoading(false)
        }
    }

    const updateBranding = (data) => {
        // Update favicon dynamically
        if (data.favicon_url) {
            const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
            link.type = 'image/x-icon';
            link.rel = 'shortcut icon';
            link.href = data.favicon_url;
            document.getElementsByTagName('head')[0].appendChild(link);
        }

        // Update title dynamically
        if (data.site_name) {
            document.title = data.site_name
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
