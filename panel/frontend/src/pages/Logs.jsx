import { useState, useEffect } from 'react'
import api from '../api'

export default function Logs() {
    const [logs, setLogs] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState({ search: '', status: '', sender: '', recipient: '' })
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 0 })

    useEffect(() => { fetchLogs() }, [filter, page])
    useEffect(() => { fetchStats() }, [])

    const fetchLogs = async () => {
        try {
            const params = new URLSearchParams({ ...filter, page, limit: 50 }).toString()
            const { data } = await api.get(`/logs?${params}`)
            setLogs(data.data || [])
            setPagination(data.pagination || { total: 0, pages: 0 })
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/logs/stats')
            setStats(data.data)
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR')

    const statusColors = {
        delivered: 'bg-green-100 text-green-800',
        rejected: 'bg-red-100 text-red-800',
        quarantined: 'bg-yellow-100 text-yellow-800',
        deferred: 'bg-orange-100 text-orange-800',
        bounced: 'bg-red-100 text-red-800'
    }

    if (loading) return <div className="text-center py-12">Loading...</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Mail Logs</h2>
                <p className="text-sm text-gray-600">View email delivery and filtering logs</p>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.byStatus?.map(s => (
                        <div key={s.status} className="bg-white rounded-lg shadow p-4">
                            <div className="text-2xl font-bold text-gray-900">{s.count}</div>
                            <div className="text-sm text-gray-500 capitalize">{s.status}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
                <input type="text" placeholder="Search..." value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    className="flex-1 min-w-[200px] rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <input type="text" placeholder="Sender..." value={filter.sender}
                    onChange={(e) => setFilter({ ...filter, sender: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <input type="text" placeholder="Recipient..." value={filter.recipient}
                    onChange={(e) => setFilter({ ...filter, recipient: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">All Status</option>
                    <option value="delivered">Delivered</option>
                    <option value="rejected">Rejected</option>
                    <option value="quarantined">Quarantined</option>
                    <option value="deferred">Deferred</option>
                </select>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">From</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">To</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.id}>
                                <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate">{log.sender}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">{log.recipient}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{log.subject || '-'}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs rounded-full ${statusColors[log.status] || 'bg-gray-100 text-gray-800'}`}>
                                        {log.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{log.spam_score?.toFixed(1) || '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No logs found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Previous</button>
                    <span className="px-4 py-2">Page {page} of {pagination.pages}</span>
                    <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">Next</button>
                </div>
            )}
        </div>
    )
}
