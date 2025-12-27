import { useState, useEffect } from 'react'

export function usePWA() {
    const [installPrompt, setInstallPrompt] = useState(null)
    const [isInstalled, setIsInstalled] = useState(false)
    const [isInstallable, setIsInstallable] = useState(false)
    const [updateAvailable, setUpdateAvailable] = useState(false)

    useEffect(() => {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true)
        }

        // Listen for beforeinstallprompt event
        const handleBeforeInstall = (e) => {
            e.preventDefault()
            setInstallPrompt(e)
            setIsInstallable(true)
        }

        // Listen for app installed event
        const handleAppInstalled = () => {
            setIsInstalled(true)
            setIsInstallable(false)
            setInstallPrompt(null)
        }

        window.addEventListener('beforeinstallprompt', handleBeforeInstall)
        window.addEventListener('appinstalled', handleAppInstalled)

        // Check for service worker updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing
                    newWorker?.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            setUpdateAvailable(true)
                        }
                    })
                })
            })
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
            window.removeEventListener('appinstalled', handleAppInstalled)
        }
    }, [])

    const promptInstall = async () => {
        if (!installPrompt) return false

        try {
            installPrompt.prompt()
            const { outcome } = await installPrompt.userChoice

            if (outcome === 'accepted') {
                setIsInstalled(true)
                setIsInstallable(false)
            }

            setInstallPrompt(null)
            return outcome === 'accepted'
        } catch (error) {
            console.error('Install prompt error:', error)
            return false
        }
    }

    const reloadForUpdate = () => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
                registration.waiting?.postMessage({ type: 'SKIP_WAITING' })
            })
            window.location.reload()
        }
    }

    return {
        isInstallable,
        isInstalled,
        updateAvailable,
        promptInstall,
        reloadForUpdate
    }
}
