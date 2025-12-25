import { useState, useEffect } from 'react'
import api from '../api'

export default function Users() {
    const [users, setUsers] = useState([])
    const [tenants, setTenants] = useState([])
    const [domains, setDomains] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ email: '', password: '', tenant_id: '', domain_id: '', quota_mb: 1024, status: 'active' })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [usersRes, tenantsRes, domainsRes] = await Promise.all([
                api.get('/users'),
                api.get('/tenants'),
                api.get('/domains')
            ])
            setUsers(usersRes.data.data || [])
            setTenants(tenantsRes.data.data || [])
            setDomains(domainsRes.data.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await api.post('/users', form)
            setShowModal(false)
            setForm({ email: '', password: '', tenant_id: '', domain_id: '', quota_mb: 1024, status: 'active' })
            fetchData()
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to create user')
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this user?')) return
        try {
            await api.delete(`/users/${id}`)
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to delete')
        }
    }

    const filteredDomains = domains.filter(d => !form.tenant_id || d.tenant_id === form.tenant_id)

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Email Users</h2>
                    <p className="text-sm text-gray-600">Manage email accounts and SMTP credentials</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Add User
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quota</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.tenant_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.domain_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                    {user.used_mb || 0} / {user.quota_mb} MB
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No users found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">Add Email User</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tenant</label>
                                <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value, domain_id: '' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                    <option value="">Select tenant...</option>
                                    {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Domain</label>
                                <select value={form.domain_id} onChange={(e) => setForm({ ...form, domain_id: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                    <option value="">Select domain...</option>
                                    {filteredDomains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Email (local part)</label>
                                <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="user@domain.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Password</label>
                                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quota (MB)</label>
                                <input type="number" value={form.quota_mb} onChange={(e) => setForm({ ...form, quota_mb: parseInt(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
