import { useState, useEffect } from 'react'
import api from '../api'

export default function AuditLog() {
    const [logs, setLogs] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState({ action: '', resource_type: '' })
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 0 })

    useEffect(() => { fetchData() }, [filter, page])

    const fetchData = async () => {
        try {
            const params = new URLSearchParams({ ...filter, page, limit: 50 }).toString()
            const [logsRes, statsRes] = await Promise.all([
                api.get(`/audit?${params}`),
                api.get('/audit/stats')
            ])
            setLogs(logsRes.data.data || [])
            setPagination(logsRes.data.pagination || { total: 0, pages: 0 })
            setStats(statsRes.data.data)
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR')

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
                <p className="text-sm text-gray-600">Track all administrative actions</p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg shadow p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Top Actions (7 days)</h4>
                        <div className="space-y-1">
                            {stats.byAction?.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{a.action}</span>
                                    <span className="text-gray-500">{a.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Activity by Day</h4>
                        <div className="space-y-1">
                            {stats.byDay?.map((d, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-700">{new Date(d.date).toLocaleDateString('pt-BR')}</span>
                                    <span className="text-gray-500">{d.count} actions</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4">
                        <h4 className="text-sm font-medium text-gray-500 mb-2">Top Users (7 days)</h4>
                        <div className="space-y-1">
                            {stats.byUser?.map((u, i) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span className="text-gray-700 truncate">{u.email}</span>
                                    <span className="text-gray-500">{u.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 flex gap-4">
                <input type="text" placeholder="Action..." value={filter.action}
                    onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <select value={filter.resource_type} onChange={(e) => setFilter({ ...filter, resource_type: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">All Resources</option>
                    <option value="tenant">Tenants</option>
                    <option value="domain">Domains</option>
                    <option value="user">Users</option>
                    <option value="policy">Policies</option>
                </select>
            </div>

            {/* Logs Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Resource</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.id}>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{log.user_email || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{log.action}</span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{log.resource_type || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{log.ip_address || '-'}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No audit logs</td></tr>}
                    </tbody>
                </table>
            </div>

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">Previous</button>
                    <span className="px-4 py-2">Page {page} of {pagination.pages}</span>
                    <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">Next</button>
                </div>
            )}
        </div>
    )
}
