import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'
import AdminUsers from './AdminUsers'

export default function Profile() {
    const { t } = useTranslation()
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [activeTab, setActiveTab] = useState('account')
    const [roles, setRoles] = useState([])
    const [permissions, setPermissions] = useState(['view_stats', 'view_logs', 'manage_whitelist', 'manage_blacklist', 'manage_tenants', 'manage_domains', 'manage_users', 'view_audit', 'manage_system'])
    const [showRoleModal, setShowRoleModal] = useState(false)
    const [editingRole, setEditingRole] = useState(null)
    const [roleForm, setRoleForm] = useState({ name: '', permissions: {} })
    const [showEmailModal, setShowEmailModal] = useState(false)
    const [emailForm, setEmailForm] = useState({ newEmail: '', currentPassword: '' })

    useEffect(() => {
        fetchProfile()
        if (activeTab === 'roles') fetchRoles()
    }, [activeTab])

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

    const fetchRoles = async () => {
        try {
            const { data } = await api.get('/roles')
            setRoles(data.data || [])
        } catch (err) {
            console.error('Error fetching roles:', err)
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

    const handleEmailChange = async (e) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        try {
            await api.put('/profile/email', emailForm)
            setSuccess(t('profile.emailChanged', 'Email updated successfully'))
            setShowEmailModal(false)
            setEmailForm({ newEmail: '', currentPassword: '' })
            fetchProfile()
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to change email')
        }
    }

    const handleSaveRole = async (e) => {
        e.preventDefault()
        try {
            if (editingRole) {
                await api.put(`/roles/${editingRole.id}`, roleForm)
            } else {
                await api.post('/roles', roleForm)
            }
            setShowRoleModal(false)
            setEditingRole(null)
            setRoleForm({ name: '', permissions: {} })
            fetchRoles()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Error saving role')
        }
    }

    const handleDeleteRole = async (id) => {
        if (!confirm(t('roles.confirmDelete'))) return
        try {
            await api.delete(`/roles/${id}`)
            fetchRoles()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Error deleting role')
        }
    }

    const togglePermission = (perm) => {
        setRoleForm(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [perm]: !prev.permissions[perm]
            }
        }))
    }

    const openRoleModal = (role = null) => {
        if (role) {
            setEditingRole(role)
            setRoleForm({ name: role.name, permissions: role.permissions || {} })
        } else {
            setEditingRole(null)
            setRoleForm({ name: '', permissions: {} })
        }
        setShowRoleModal(true)
    }

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('profile.title')}</h2>
                <p className="text-sm text-gray-600">{t('profile.subtitle')}</p>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="border-b border-gray-200">
                    <nav className="-mb-px flex">
                        <button onClick={() => setActiveTab('account')} className={`${activeTab === 'account' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} w-1/2 py-4 px-1 text-center border-b-2 font-medium text-sm`}>
                            {t('profile.accountInfo')}
                        </button>
                        {(profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'super-admin') && (
                            <button onClick={() => setActiveTab('users')} className={`${activeTab === 'users' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm`}>
                                {t('adminUsers.title', 'Users')}
                            </button>
                        )}
                        {(profile?.role === 'admin' || profile?.role === 'superadmin' || profile?.role === 'super-admin') && (
                            <button onClick={() => setActiveTab('roles')} className={`${activeTab === 'roles' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'} w-1/3 py-4 px-1 text-center border-b-2 font-medium text-sm`}>
                                {t('roles.title')}
                            </button>
                        )}
                    </nav>
                </div>

                <div className="p-6">
                    {activeTab === 'account' && (
                        <div className="space-y-6">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-lg font-medium mb-4">{t('profile.accountInfo')}</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-500">{t('profile.email')}</label>
                                        <div className="mt-1 flex items-center gap-3">
                                            <span className="text-gray-900">{profile?.email}</span>
                                            <button onClick={() => setShowEmailModal(true)} className="text-sm text-blue-600 hover:text-blue-800">
                                                {t('profile.changeEmail', 'Change')}
                                            </button>
                                        </div>
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

                            <div className="border-t pt-6">
                                <h3 className="text-lg font-medium mb-4">{t('profile.changePassword')}</h3>
                                {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                                {success && <div className="bg-green-50 text-green-600 p-3 rounded-md mb-4">{success}</div>}
                                <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
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
                    )}

                    {activeTab === 'users' && (
                        <AdminUsers />
                    )}

                    {activeTab === 'roles' && (
                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium">{t('roles.title')}</h3>
                                <button onClick={() => openRoleModal()} className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700">
                                    {t('roles.addRole')}
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('roles.roleName')}</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('roles.permissions')}</th>
                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {roles.map((role) => (
                                            <tr key={role.id}>
                                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{role.name}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {Object.keys(role.permissions).filter(k => role.permissions[k]).map(perm => (
                                                            <span key={perm} className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">{perm}</span>
                                                        ))}
                                                        {Object.keys(role.permissions).length === 0 && <span className="text-gray-400">-</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                    <button onClick={() => openRoleModal(role)} className="text-blue-600 hover:text-blue-900 mr-4">{t('common.edit')}</button>
                                                    {role.name !== 'admin' && (
                                                        <button onClick={() => handleDeleteRole(role.id)} className="text-red-600 hover:text-red-900">{t('common.delete')}</button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showRoleModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <h3 className="text-lg font-medium mb-4">{editingRole ? t('common.edit') : t('roles.addRole')}</h3>
                        <form onSubmit={handleSaveRole} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('roles.roleName')}</label>
                                <input type="text" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                                    disabled={editingRole?.name === 'admin'}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">{t('roles.permissions')}</label>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border p-2 rounded">
                                    {permissions.map(perm => (
                                        <label key={perm} className="flex items-center space-x-2">
                                            <input type="checkbox" checked={!!roleForm.permissions[perm]} onChange={() => togglePermission(perm)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                            <span className="text-sm text-gray-700">{perm}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowRoleModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('common.cancel')}</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showEmailModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">{t('profile.changeEmail', 'Change Email')}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleEmailChange} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('profile.newEmail', 'New Email')}</label>
                                <input type="email" value={emailForm.newEmail}
                                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('profile.currentPassword')}</label>
                                <input type="password" value={emailForm.currentPassword}
                                    onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                <p className="mt-1 text-sm text-gray-500">{t('profile.passwordRequiredForEmail', 'Password required to confirm email change')}</p>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => { setShowEmailModal(false); setError(''); }} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                                    {t('common.cancel')}
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    {t('profile.changeEmail', 'Change Email')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
