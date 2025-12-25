import { useState, useEffect } from 'react'
import api from '../api'

export default function Domains() {
    const [domains, setDomains] = useState([])
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showDkimModal, setShowDkimModal] = useState(false)
    const [selectedDomain, setSelectedDomain] = useState(null)
    const [dkimData, setDkimData] = useState(null)
    const [verifying, setVerifying] = useState(null)
    const [form, setForm] = useState({
        domain: '', tenant_id: '', status: 'pending',
        relay_host: '', relay_port: 25, relay_username: '', relay_password: '', relay_use_tls: true
    })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [domainsRes, tenantsRes] = await Promise.all([
                api.get('/domains'),
                api.get('/tenants')
            ])
            setDomains(domainsRes.data.data || [])
            setTenants(tenantsRes.data.data || [])
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
            if (selectedDomain) {
                await api.put(`/domains/${selectedDomain.id}`, form)
            } else {
                await api.post('/domains', form)
            }
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err) {
            setError(err.response?.data?.error?.message || 'Failed to save')
        }
    }

    const resetForm = () => {
        setSelectedDomain(null)
        setForm({ domain: '', tenant_id: '', status: 'pending', relay_host: '', relay_port: 25, relay_username: '', relay_password: '', relay_use_tls: true })
    }

    const handleEdit = (domain) => {
        setSelectedDomain(domain)
        setForm({
            domain: domain.domain,
            tenant_id: domain.tenant_id,
            status: domain.status,
            relay_host: domain.relay_host || '',
            relay_port: domain.relay_port || 25,
            relay_username: domain.relay_username || '',
            relay_password: domain.relay_password || '',
            relay_use_tls: domain.relay_use_tls !== false
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!confirm('Delete this domain?')) return
        try {
            await api.delete(`/domains/${id}`)
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to delete')
        }
    }

    const handleGenerateDkim = async (domain) => {
        try {
            const { data } = await api.post(`/domains/${domain.id}/generate-dkim`)
            if (data.success) {
                setDkimData(data.data)
                setSelectedDomain(domain)
                setShowDkimModal(true)
                fetchData()
            }
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to generate DKIM')
        }
    }

    const handleVerifyDns = async (domain) => {
        setVerifying(domain.id)
        try {
            const { data } = await api.post(`/domains/${domain.id}/verify-dns`)
            if (data.success) {
                alert(`DNS Verification:\n\nMX: ${data.data.verification.mx ? '✓' : '✗'}\nSPF: ${data.data.verification.spf ? '✓' : '✗'}\nDKIM: ${data.data.verification.dkim ? '✓' : '✗'}`)
                fetchData()
            }
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to verify DNS')
        } finally {
            setVerifying(null)
        }
    }

    const StatusBadge = ({ verified, label }) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs rounded ${verified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {verified ? '✓' : '✗'} {label}
        </span>
    )

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">Domains</h2>
                    <p className="text-sm text-gray-600">Manage email domains with relay and DKIM configuration</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    Add Domain
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Domain</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Relay</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DKIM</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {domains.map((domain) => (
                            <tr key={domain.id}>
                                <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{domain.domain}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-gray-500">{domain.tenant_name}</td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${domain.status === 'active' ? 'bg-green-100 text-green-800' : domain.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                        {domain.status}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    {domain.relay_host ? (
                                        <span className="text-green-600">{domain.relay_host}:{domain.relay_port}</span>
                                    ) : (
                                        <span className="text-gray-400">Not configured</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    {domain.dkim_public_key ? (
                                        <StatusBadge verified={true} label="Configured" />
                                    ) : (
                                        <StatusBadge verified={false} label="Not set" />
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm space-x-1">
                                    <button onClick={() => handleEdit(domain)} className="text-blue-600 hover:text-blue-900">Edit</button>
                                    <button onClick={() => handleGenerateDkim(domain)} className="text-purple-600 hover:text-purple-900">DKIM</button>
                                    <button onClick={() => handleVerifyDns(domain)} disabled={verifying === domain.id} className="text-green-600 hover:text-green-900 disabled:opacity-50">
                                        {verifying === domain.id ? '...' : 'Verify'}
                                    </button>
                                    <button onClick={() => handleDelete(domain.id)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))}
                        {domains.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-4 text-center text-gray-500">No domains found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Domain Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-medium mb-4">{selectedDomain ? 'Edit Domain' : 'Add Domain'}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Domain</label>
                                <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                                    placeholder="example.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required disabled={!!selectedDomain} />
                            </div>
                            {!selectedDomain && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Tenant</label>
                                    <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                        <option value="">Select tenant...</option>
                                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="pending">Pending</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <hr className="my-4" />
                            <h4 className="font-medium text-gray-900">Relay Configuration (Email Destination)</h4>
                            <p className="text-xs text-gray-500 mb-2">Configure where filtered emails should be delivered (e.g., Hostgator mail server)</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Relay Host</label>
                                    <input type="text" value={form.relay_host} onChange={(e) => setForm({ ...form, relay_host: e.target.value })}
                                        placeholder="mail.example.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Relay Port</label>
                                    <input type="number" value={form.relay_port} onChange={(e) => setForm({ ...form, relay_port: parseInt(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div className="flex items-center pt-6">
                                    <input type="checkbox" checked={form.relay_use_tls} onChange={(e) => setForm({ ...form, relay_use_tls: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                    <label className="ml-2 text-sm text-gray-700">Use TLS</label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">SMTP Username (optional)</label>
                                    <input type="text" value={form.relay_username} onChange={(e) => setForm({ ...form, relay_username: e.target.value })}
                                        placeholder="user@example.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">SMTP Password (optional)</label>
                                    <input type="password" value={form.relay_password} onChange={(e) => setForm({ ...form, relay_password: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DKIM Modal */}
            {showDkimModal && dkimData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                        <h3 className="text-lg font-medium mb-4">DKIM Keys Generated</h3>
                        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                            <p className="text-sm text-green-700">
                                <strong>Add this DNS record to your domain:</strong>
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Record Type</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">{dkimData.dnsRecord.type}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Record Name</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">{dkimData.dnsRecord.name}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Record Value</label>
                                <textarea className="mt-1 w-full p-2 bg-gray-50 rounded font-mono text-xs h-24" readOnly value={dkimData.dnsRecord.value} />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={() => { setShowDkimModal(false); setDkimData(null) }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Done</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
