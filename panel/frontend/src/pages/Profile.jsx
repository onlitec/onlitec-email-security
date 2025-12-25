import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Profile() {
    const { t } = useTranslation()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    useEffect(() => { fetchProfile() }, [])

    const fetchProfile = async () => {
        try {
            const { data } = await api.get('/profile')
            setProfile(data.data)
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handlePasswordChange = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setError(t('profile.passwordMismatch'))
            return
        }

        if (passwordForm.newPassword.length < 8) {
            setError(t('profile.passwordTooShort'))
            return
        }

        try {
            await api.post('/profile/password', {
                currentPassword: passwordForm.currentPassword,
                newPassword: passwordForm.newPassword
            })
            setSuccess(t('profile.passwordChanged'))
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to change password')
        }
    }

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h2>
                <p className="text-sm text-gray-600">{t('profile.subtitle')}</p>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">{t('profile.accountInfo')}</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-500">{t('profile.email')}</label>
                        <div className="mt-1 text-gray-900">{profile?.email}</div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">{t('profile.role')}</label>
                        <div className="mt-1">
                            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{profile?.role}</span>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">{t('profile.memberSince')}</label>
                        <div className="mt-1 text-gray-900">{profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR') : '-'}</div>
                    </div>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">{t('profile.changePassword')}</h3>
                {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                {success && <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4">{success}</div>}
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('profile.currentPassword')}</label>
                        <input type="password" value={passwordForm.currentPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('profile.newPassword')}</label>
                        <input type="password" value={passwordForm.newPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">{t('profile.confirmPassword')}</label>
                        <input type="password" value={passwordForm.confirmPassword}
                            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                    </div>
                    <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        {t('profile.changePassword')}
                    </button>
                </form>
            </div>
        </div>
    )
}
