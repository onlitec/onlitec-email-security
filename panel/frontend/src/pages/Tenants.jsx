import { useState, useEffect } from 'react'
import api from '../api'

export default function Tenants() {
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editTenant, setEditTenant] = useState(null)
    const [form, setForm] = useState({ name: '', slug: '', contact_email: '', max_domains: 10, max_users: 100, status: 'active' })
    const [error, setError] = useState('')

    useEffect(() => { fetchTenants() }, [])

    const fetchTenants = async () => {
        try {
            const { data } = await api.get('/tenants')
            setTenants(data.data || [])
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
            if (editTenant) {
                await api.put(`/tenants/${editTenant.id}`, form)
            } else {
                await api.post('/tenants', form)
            }
            setShowModal(false)
            setEditTenant(null)
            setForm({ name: '', slug: '', contact_email: '', max_domains: 10, max_users: 100, status: 'active' })
            fetchTenants()
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to save')
        }
    }

    const handleEdit = (tenant) => {
        setEditTenant(tenant)
        setForm({ name: tenant.name, slug: tenant.slug, contact_email: tenant.contact_email || '', max_domains: tenant.max_domains, max_users: tenant.max_users, status: tenant.status })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this tenant?')) return
        try {
            await api.delete(`/tenants/${id}`)
            fetchTenants()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to delete')
        }
    }

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Tenants</h2>
                    <p className="text-sm text-gray-600">Manage multi-tenant organizations</p>
                </div>
                <button onClick={() => { setEditTenant(null); setForm({ name: '', slug: '', contact_email: '', max_domains: 10, max_users: 100, status: 'active' }); setShowModal(true) }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Add Tenant
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domains</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Users</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {tenants.map((tenant) => (
                            <tr key={tenant.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{tenant.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{tenant.slug}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${tenant.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {tenant.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{tenant.domain_count || 0} / {tenant.max_domains}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{tenant.user_count || 0} / {tenant.max_users}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button onClick={() => handleEdit(tenant)} className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                                    <button onClick={() => handleDelete(tenant.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && (
                            <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">No tenants found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">{editTenant ? 'Edit Tenant' : 'Add Tenant'}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Name</label>
                                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Slug</label>
                                <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required disabled={!!editTenant} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                                <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Max Domains</label>
                                    <input type="number" value={form.max_domains} onChange={(e) => setForm({ ...form, max_domains: parseInt(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Max Users</label>
                                    <input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: parseInt(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
