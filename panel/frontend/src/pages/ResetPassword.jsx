import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function ResetPassword() {
    const { t } = useTranslation()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const token = searchParams.get('token')

    const [form, setForm] = useState({ newPassword: '', confirmPassword: '' })
    const [message, setMessage] = useState({ type: '', text: '' })
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.newPassword !== form.confirmPassword) {
            setMessage({ type: 'error', text: t('profile.passwordMismatch') })
            return
        }

        setLoading(true)
        setMessage({ type: '', text: '' })

        try {
            await api.post('/auth/reset-password', { token, newPassword: form.newPassword })
            setMessage({ type: 'success', text: t('auth.resetSuccess') })
            setTimeout(() => navigate('/login'), 2000)
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error?.message || 'Error occurred' })
        } finally {
            setLoading(false)
        }
    }

    if (!token) return <div className="text-center mt-10">Invalid request</div>

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                    {t('auth.resetPassword')}
                </h2>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
                    {message.text && (
                        <div className={`mb-4 p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                            {message.text}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('auth.newPassword')}</label>
                            <input type="password" required value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">{t('auth.confirmPassword')}</label>
                            <input type="password" required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                        </div>

                        <div>
                            <button type="submit" disabled={loading}
                                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                                {loading ? t('common.loading') : t('auth.resetPassword')}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
