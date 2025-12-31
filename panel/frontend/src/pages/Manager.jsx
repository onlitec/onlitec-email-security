import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import { useSettings } from '../contexts/SettingsContext'

export default function Manager() {
    const { t } = useTranslation()
    const { fetchSettings: refreshGlobalSettings } = useSettings()
    const [activeTab, setActiveTab] = useState('general')
    const [loading, setLoading] = useState(true)
    const [settings, setSettings] = useState({})
    const [smtpTest, setSmtpTest] = useState({ to: '' })
    const [message, setMessage] = useState({ type: '', text: '' })
    const [uploading, setUploading] = useState({ logo: false, favicon: false })

    const logoInputRef = useRef(null)
    const faviconInputRef = useRef(null)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const { data } = await api.get('/manager')
            setSettings(data.data || {})
        } catch (err) {
            console.error(err)
            setMessage({ type: 'error', text: err.response?.data?.error?.message || err.message || 'Error fetching settings' })
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        setSettings({ ...settings, [e.target.name]: e.target.value })
    }

    const handleSave = async () => {
        try {
            await api.put('/manager', settings)
            setMessage({ type: 'success', text: t('common.save') + ' success' })
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Error saving' })
        }
    }

    const handleFileUpload = async (type, file) => {
        if (!file) return

        setUploading({ ...uploading, [type]: true })
        setMessage({ type: '', text: '' })

        try {
            const formData = new FormData()
            formData.append('file', file)

            const { data } = await api.post(`/manager/upload/${type}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            // Update local state with new URL
            const settingKey = type === 'logo' ? 'logo_url' : 'favicon_url'
            setSettings({ ...settings, [settingKey]: data.data.url })
            setMessage({ type: 'success', text: `${type === 'logo' ? 'Logo' : 'Favicon'} uploaded!` })

            // Refresh global settings so Layout updates immediately
            refreshGlobalSettings()
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Upload failed' })
        } finally {
            setUploading({ ...uploading, [type]: false })
        }
    }

    const handleTestSmtp = async () => {
        if (!smtpTest.to) {
            setMessage({ type: 'error', text: 'Please enter a test email' })
            return
        }
        try {
            // Map frontend field names (smtp_*) to backend expected names
            await api.post('/manager/test-smtp', {
                host: settings.smtp_host,
                port: settings.smtp_port,
                user: settings.smtp_user,
                pass: settings.smtp_pass,
                secure: settings.smtp_secure,
                from: settings.smtp_from,
                to: smtpTest.to
            })
            setMessage({ type: 'success', text: 'Test email sent!' })
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Failed to send test email' })
        }
    }

    if (loading) return <div>{t('common.loading')}</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('manager.title')}</h2>
                <p className="text-sm text-gray-600">{t('manager.subtitle')}</p>
            </div>

            {message.text && (
                <div className={`p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {message.text}
                </div>
            )}

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex">
                        {['general', 'notifications', 'security'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`${activeTab === tab
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    } w-1/4 py-4 px-1 text-center border-b-2 font-medium text-sm`}
                            >
                                {t(`manager.${tab}`)}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">{t('manager.branding')}</h3>

                            {/* Site Name */}
                            <div className="max-w-lg">
                                <label htmlFor="site_name" className="block text-sm font-medium text-gray-700">Site Name</label>
                                <div className="mt-1">
                                    <input type="text" name="site_name" id="site_name" value={settings.site_name || ''} onChange={handleChange}
                                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                                </div>
                            </div>

                            {/* Logo Upload */}
                            <div className="border-t pt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('manager.logoUrl')}</label>
                                <div className="flex items-start space-x-6">
                                    <div className="flex-shrink-0">
                                        {settings.logo_url ? (
                                            <img src={settings.logo_url} alt="Logo" className="h-20 w-auto object-contain border rounded p-2 bg-gray-50" />
                                        ) : (
                                            <div className="h-20 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400">
                                                No Logo
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <input type="file" ref={logoInputRef} accept="image/*" className="hidden"
                                            onChange={(e) => handleFileUpload('logo', e.target.files[0])} />
                                        <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploading.logo}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                                            {uploading.logo ? 'Uploading...' : 'Upload Logo'}
                                        </button>
                                        <p className="mt-2 text-xs text-gray-500">PNG, JPG, GIF, SVG. Max 5MB</p>
                                        <div className="mt-2">
                                            <input type="text" name="logo_url" placeholder="Or enter URL" value={settings.logo_url || ''} onChange={handleChange}
                                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Favicon Upload */}
                            <div className="border-t pt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('manager.faviconUrl')}</label>
                                <div className="flex items-start space-x-6">
                                    <div className="flex-shrink-0">
                                        {settings.favicon_url ? (
                                            <img src={settings.favicon_url} alt="Favicon" className="h-12 w-12 object-contain border rounded p-1 bg-gray-50" />
                                        ) : (
                                            <div className="h-12 w-12 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
                                                No Icon
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-grow">
                                        <input type="file" ref={faviconInputRef} accept="image/*,.ico" className="hidden"
                                            onChange={(e) => handleFileUpload('favicon', e.target.files[0])} />
                                        <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploading.favicon}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                                            {uploading.favicon ? 'Uploading...' : 'Upload Favicon'}
                                        </button>
                                        <p className="mt-2 text-xs text-gray-500">PNG, ICO, SVG. Recommended 32x32 or 64x64</p>
                                        <div className="mt-2">
                                            <input type="text" name="favicon_url" placeholder="Or enter URL" value={settings.favicon_url || ''} onChange={handleChange}
                                                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-medium leading-6 text-gray-900">{t('manager.smtpConfig')}</h3>
                            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">{t('manager.smtpHost')}</label>
                                    <input type="text" name="smtp_host" value={settings.smtp_host || ''} onChange={handleChange}
                                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">{t('manager.smtpPort')}</label>
                                    <input type="text" name="smtp_port" value={settings.smtp_port || ''} onChange={handleChange}
                                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">{t('manager.smtpUser')}</label>
                                    <input type="text" name="smtp_user" value={settings.smtp_user || ''} onChange={handleChange}
                                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-gray-700">{t('manager.smtpPass')}</label>
                                    <input type="password" name="smtp_pass" value={settings.smtp_pass || ''} onChange={handleChange}
                                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-sm font-medium text-gray-700">{t('manager.smtpFrom')}</label>
                                    <input type="text" name="smtp_from" value={settings.smtp_from || ''} onChange={handleChange}
                                        className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md" />
                                </div>
                                <div className="sm:col-span-6">
                                    <div className="flex items-start">
                                        <div className="flex items-center h-5">
                                            <input id="smtp_secure" name="smtp_secure" type="checkbox" checked={settings.smtp_secure === 'true' || settings.smtp_secure === true}
                                                onChange={(e) => setSettings({ ...settings, smtp_secure: e.target.checked })}
                                                className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded" />
                                        </div>
                                        <div className="ml-3 text-sm">
                                            <label htmlFor="smtp_secure" className="font-medium text-gray-700">{t('manager.smtpSecure')}</label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Test Configuration</h4>
                                <div className="flex gap-4">
                                    <input type="email" placeholder={t('manager.testEmail')} value={smtpTest.to} onChange={(e) => setSmtpTest({ to: e.target.value })}
                                        className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md" />
                                    <button type="button" onClick={handleTestSmtp} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
                                        {t('manager.testSmtp')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="space-y-6">
                            <p className="text-gray-500 italic">Security settings coming soon...</p>
                        </div>
                    )}

                    <div className="pt-5 border-t border-gray-200 mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            className="bg-blue-600 border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            {t('common.save')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
