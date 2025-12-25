import { useState, useEffect } from 'react'
import api from '../api'

export default function Settings() {
    const [blacklist, setBlacklist] = useState([])
    const [whitelist, setWhitelist] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(null) // 'blacklist' or 'whitelist'
    const [form, setForm] = useState({ type: 'email', value: '', reason: '' })

    useEffect(() => { fetchLists() }, [])

    const fetchLists = async () => {
        try {
            const [blackRes, whiteRes] = await Promise.all([
                api.get('/blacklist'),
                api.get('/whitelist')
            ])
            setBlacklist(blackRes.data.data || [])
            setWhitelist(whiteRes.data.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            await api.post(`/${showModal}`, form)
            setShowModal(null)
            setForm({ type: 'email', value: '', reason: '' })
            fetchLists()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to add')
        }
    }

    const handleDelete = async (list, id) => {
        if (!confirm('Remove this entry?')) return
        try {
            await api.delete(`/${list}/${id}`)
            fetchLists()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Failed to delete')
        }
    }

    const ListTable = ({ title, data, list, color }) => (
        <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b flex justify-between items-center">
                <h3 className={`text-lg font-medium ${color}`}>{title}</h3>
                <button onClick={() => setShowModal(list)} className={`px-3 py-1 text-sm rounded-md ${list === 'blacklist' ? 'bg-red-600' : 'bg-green-600'} text-white hover:opacity-90`}>
                    Add Entry
                </button>
            </div>
            <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data.map((item) => (
                            <tr key={item.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{item.type}</span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{item.value}</td>
                                <td className="px-6 py-4 text-sm text-gray-500">{item.reason || '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right">
                                    <button onClick={() => handleDelete(list, item.id)} className="text-red-600 hover:text-red-900 text-sm">Remove</button>
                                </td>
                            </tr>
                        ))}
                        {data.length === 0 && (
                            <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No entries</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-600">Manage blacklist and whitelist entries</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                <ListTable title="Blacklist" data={blacklist} list="blacklist" color="text-red-600" />
                <ListTable title="Whitelist" data={whitelist} list="whitelist" color="text-green-600" />
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">Add to {showModal}</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Type</label>
                                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="email">Email</option>
                                    <option value="domain">Domain</option>
                                    <option value="ip">IP Address</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Value</label>
                                <input type="text" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })}
                                    placeholder="spam@example.com or @example.com or 192.168.1.1"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Reason (optional)</label>
                                <input type="text" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(null)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">Cancel</button>
                                <button type="submit" className={`px-4 py-2 text-white rounded-md ${showModal === 'blacklist' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>Add</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
