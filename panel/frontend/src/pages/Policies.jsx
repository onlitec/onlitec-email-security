import { useState, useEffect } from 'react'
import api from '../api'

export default function Policies() {
    const [policies, setPolicies] = useState([])
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editPolicy, setEditPolicy] = useState(null)
    const [form, setForm] = useState({
        tenant_id: '', name: '', is_default: false,
        greylisting_score: 4.0, add_header_score: 5.0, rewrite_subject_score: 10.0, reject_score: 15.0,
        enable_greylisting: true, enable_bayes: true, enable_dkim_check: true,
        enable_spf_check: true, enable_dmarc_check: true,
        quarantine_spam: true, quarantine_virus: true, quarantine_retention_days: 30
    })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [policiesRes, tenantsRes] = await Promise.all([api.get('/policies'), api.get('/tenants')])
            setPolicies(policiesRes.data.data || [])
            setTenants(tenantsRes.data.data || [])
        } catch (err) { console.error('Error:', err) }
        finally { setLoading(false) }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            if (editPolicy) await api.put(`/policies/${editPolicy.id}`, form)
            else await api.post('/policies', form)
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err) { setError(err.response?.data?.error?.message || 'Failed to save') }
    }

    const resetForm = () => {
        setEditPolicy(null)
        setForm({ tenant_id: '', name: '', is_default: false, greylisting_score: 4.0, add_header_score: 5.0, rewrite_subject_score: 10.0, reject_score: 15.0, enable_greylisting: true, enable_bayes: true, enable_dkim_check: true, enable_spf_check: true, enable_dmarc_check: true, quarantine_spam: true, quarantine_virus: true, quarantine_retention_days: 30 })
    }

    const handleEdit = (policy) => {
        setEditPolicy(policy)
        setForm({ ...policy })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this policy?')) return
        try { await api.delete(`/policies/${id}`); fetchData() }
        catch (err) { alert(err.response?.data?.error?.message || 'Failed to delete') }
    }

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Spam Policies</h2>
                    <p className="text-sm text-gray-600">Configure spam filtering thresholds per tenant</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add Policy</button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reject Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quarantine</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {policies.map((policy) => (
                            <tr key={policy.id}>
                                <td className="px-4 py-4 font-medium text-gray-900">{policy.name}</td>
                                <td className="px-4 py-4 text-gray-500">{policy.tenant_name}</td>
                                <td className="px-4 py-4 text-gray-500">{policy.reject_score}</td>
                                <td className="px-4 py-4">
                                    <span className={`px-2 py-1 text-xs rounded ${policy.quarantine_spam ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        Spam: {policy.quarantine_spam ? 'Yes' : 'No'}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    {policy.is_default && <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Default</span>}
                                </td>
                                <td className="px-4 py-4 text-right space-x-2">
                                    <button onClick={() => handleEdit(policy)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                    <button onClick={() => handleDelete(policy.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {policies.length === 0 && <tr><td colSpan="6" className="px-4 py-4 text-center text-gray-500">No policies found</td></tr>}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-medium mb-4">{editPolicy ? 'Edit Policy' : 'Add Policy'}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {!editPolicy && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Tenant</label>
                                        <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                            <option value="">Select tenant...</option>
                                            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Policy Name</label>
                                    <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                                </div>
                            </div>
                            <h4 className="font-medium text-gray-900 pt-4">Spam Score Thresholds</h4>
                            <div className="grid grid-cols-4 gap-4">
                                <div><label className="block text-xs text-gray-500">Greylist</label><input type="number" step="0.1" value={form.greylisting_score} onChange={(e) => setForm({ ...form, greylisting_score: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                                <div><label className="block text-xs text-gray-500">Add Header</label><input type="number" step="0.1" value={form.add_header_score} onChange={(e) => setForm({ ...form, add_header_score: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                                <div><label className="block text-xs text-gray-500">Rewrite Subject</label><input type="number" step="0.1" value={form.rewrite_subject_score} onChange={(e) => setForm({ ...form, rewrite_subject_score: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                                <div><label className="block text-xs text-gray-500">Reject</label><input type="number" step="0.1" value={form.reject_score} onChange={(e) => setForm({ ...form, reject_score: parseFloat(e.target.value) })} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" /></div>
                            </div>
                            <h4 className="font-medium text-gray-900 pt-4">Features</h4>
                            <div className="grid grid-cols-3 gap-4">
                                {['enable_greylisting', 'enable_bayes', 'enable_dkim_check', 'enable_spf_check', 'enable_dmarc_check', 'quarantine_spam', 'quarantine_virus', 'is_default'].map(field => (
                                    <label key={field} className="flex items-center">
                                        <input type="checkbox" checked={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.checked })} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                        <span className="ml-2 text-sm text-gray-700">{field.replace(/_/g, ' ').replace('enable ', '')}</span>
                                    </label>
                                ))}
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
