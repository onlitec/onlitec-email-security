import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function AdminUsers() {
    const { t } = useTranslation()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showPasswordModal, setShowPasswordModal] = useState(false)
    const [editingUser, setEditingUser] = useState(null)
    const [selectedUserId, setSelectedUserId] = useState(null)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [filters, setFilters] = useState({ role: '', status: '' })
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })

    const [form, setForm] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        full_name: '',
        role: 'viewer',
        status: 'active'
    })

    const [newPassword, setNewPassword] = useState('')

    const roles = ['superadmin', 'admin', 'manager', 'viewer']
    const statuses = ['active', 'inactive', 'suspended']

    useEffect(() => {
        fetchUsers()
    }, [filters, pagination.page])

    const fetchUsers = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (filters.role) params.append('role', filters.role)
            if (filters.status) params.append('status', filters.status)
            params.append('page', pagination.page)
            params.append('limit', 20)

            const { data } = await api.get(`/admin-users?${params.toString()}`)
            setUsers(data.data || [])
            if (data.pagination) {
                setPagination(data.pagination)
            }
        } catch (err) {
            console.error('Error fetching users:', err)
        } finally {
            setLoading(false)
        }
    }

    const openCreateModal = () => {
        setEditingUser(null)
        setForm({
            email: '',
            password: '',
            confirmPassword: '',
            full_name: '',
            role: 'viewer',
            status: 'active'
        })
        setError('')
        setShowModal(true)
    }

    const openEditModal = (user) => {
        setEditingUser(user)
        setForm({
            email: user.email,
            password: '',
            confirmPassword: '',
            full_name: user.full_name || '',
            role: user.role,
            status: user.status
        })
        setError('')
        setShowModal(true)
    }

    const openPasswordModal = (userId) => {
        setSelectedUserId(userId)
        setNewPassword('')
        setError('')
        setShowPasswordModal(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!editingUser && form.password !== form.confirmPassword) {
            setError(t('adminUsers.passwordMismatch', 'Passwords do not match'))
            return
        }

        if (!editingUser && form.password.length < 8) {
            setError(t('adminUsers.passwordTooShort', 'Password must be at least 8 characters'))
            return
        }

        try {
            if (editingUser) {
                await api.put(`/admin-users/${editingUser.id}`, {
                    email: form.email,
                    full_name: form.full_name,
                    role: form.role,
                    status: form.status
                })
                setSuccess(t('adminUsers.userUpdated', 'User updated successfully'))
            } else {
                await api.post('/admin-users', {
                    email: form.email,
                    password: form.password,
                    full_name: form.full_name,
                    role: form.role,
                    status: form.status
                })
                setSuccess(t('adminUsers.userCreated', 'User created successfully'))
            }
            setShowModal(false)
            fetchUsers()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Error saving user')
        }
    }

    const handleResetPassword = async (e) => {
        e.preventDefault()
        setError('')

        if (newPassword.length < 8) {
            setError(t('adminUsers.passwordTooShort', 'Password must be at least 8 characters'))
            return
        }

        try {
            await api.post(`/admin-users/${selectedUserId}/reset-password`, { newPassword })
            setSuccess(t('adminUsers.passwordReset', 'Password reset successfully'))
            setShowPasswordModal(false)
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Error resetting password')
        }
    }

    const handleDelete = async (user) => {
        if (!confirm(t('adminUsers.confirmDelete', 'Are you sure you want to delete this user?'))) return

        try {
            await api.delete(`/admin-users/${user.id}`)
            setSuccess(t('adminUsers.userDeleted', 'User deleted successfully'))
            fetchUsers()
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Error deleting user')
        }
    }

    const getRoleBadgeColor = (role) => {
        switch (role) {
            case 'superadmin': return 'bg-purple-100 text-purple-800'
            case 'admin': return 'bg-blue-100 text-blue-800'
            case 'manager': return 'bg-green-100 text-green-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800'
            case 'inactive': return 'bg-gray-100 text-gray-800'
            case 'suspended': return 'bg-red-100 text-red-800'
            default: return 'bg-gray-100 text-gray-800'
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('adminUsers.title', 'User Management')}</h2>
                    <p className="text-sm text-gray-600">{t('adminUsers.subtitle', 'Manage platform administrative users')}</p>
                </div>
                <button onClick={openCreateModal} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <span>+</span>
                    {t('adminUsers.addUser', 'New User')}
                </button>
            </div>

            {success && <div className="bg-green-50 text-green-600 p-3 rounded-md">{success}</div>}

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow flex gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminUsers.role', 'Role')}</label>
                    <select value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="">{t('common.all', 'All')}</option>
                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('adminUsers.status', 'Status')}</label>
                    <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="">{t('common.all', 'All')}</option>
                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="text-center py-12 text-gray-500">{t('common.loading', 'Loading...')}</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('adminUsers.fullName', 'Name')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('adminUsers.email', 'Email')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('adminUsers.role', 'Role')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('adminUsers.status', 'Status')}</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('adminUsers.lastLogin', 'Last Login')}</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions', 'Actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {users.map(user => (
                                <tr key={user.id}>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{user.full_name || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs rounded-full ${getRoleBadgeColor(user.role)}`}>{user.role}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(user.status)}`}>{user.status}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {user.last_login ? new Date(user.last_login).toLocaleString('pt-BR') : '-'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                        <button onClick={() => openEditModal(user)} className="text-blue-600 hover:text-blue-900">{t('common.edit', 'Edit')}</button>
                                        <button onClick={() => openPasswordModal(user.id)} className="text-yellow-600 hover:text-yellow-900">{t('adminUsers.resetPassword', 'Reset Password')}</button>
                                        <button onClick={() => handleDelete(user)} className="text-red-600 hover:text-red-900">{t('common.delete', 'Delete')}</button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-gray-500">{t('common.noData', 'No data found')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                        <div className="text-sm text-gray-700">
                            {t('common.showing', 'Showing')} {((pagination.page - 1) * 20) + 1} - {Math.min(pagination.page * 20, pagination.total)} {t('common.of', 'of')} {pagination.total}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                                disabled={pagination.page === 1}
                                className="px-3 py-1 border rounded disabled:opacity-50">
                                {t('common.previous', 'Previous')}
                            </button>
                            <button onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                                disabled={pagination.page === pagination.pages}
                                className="px-3 py-1 border rounded disabled:opacity-50">
                                {t('common.next', 'Next')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <h3 className="text-lg font-medium mb-4">
                            {editingUser ? t('adminUsers.editUser', 'Edit User') : t('adminUsers.addUser', 'New User')}
                        </h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('adminUsers.fullName', 'Full Name')}</label>
                                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('adminUsers.email', 'Email')} *</label>
                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            {!editingUser && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">{t('adminUsers.password', 'Password')} *</label>
                                        <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">{t('adminUsers.confirmPassword', 'Confirm Password')} *</label>
                                        <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                    </div>
                                </>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('adminUsers.role', 'Role')}</label>
                                    <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('adminUsers.status', 'Status')}</label>
                                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                        {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                    {t('common.save', 'Save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">{t('adminUsers.resetPassword', 'Reset Password')}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('adminUsers.newPassword', 'New Password')} *</label>
                                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                <p className="mt-1 text-sm text-gray-500">{t('adminUsers.passwordRequirement', 'Minimum 8 characters')}</p>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowPasswordModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">
                                    {t('common.cancel', 'Cancel')}
                                </button>
                                <button type="submit" className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700">
                                    {t('adminUsers.resetPassword', 'Reset Password')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
