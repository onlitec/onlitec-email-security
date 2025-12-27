import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Logs() {
    const { t } = useTranslation()
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

    const statusLabels = {
        delivered: t('logs.delivered', 'Entregue'),
        rejected: t('logs.rejected', 'Rejeitado'),
        quarantined: t('logs.quarantined', 'Quarentena'),
        deferred: t('logs.deferred', 'Adiado'),
        bounced: t('logs.bounced', 'Devolvido')
    }

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('logs.title')}</h2>
                <p className="text-sm text-gray-600">{t('logs.subtitle')}</p>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {stats.byStatus?.map(s => (
                        <div key={s.status} className="bg-white rounded-lg shadow p-4">
                            <div className="text-2xl font-bold text-gray-900">{parseInt(s.count) || 0}</div>
                            <div className="text-sm text-gray-500 capitalize">{statusLabels[s.status] || s.status}</div>
                        </div>
                    ))}
                </div>
            )}

            <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
                <input type="text" placeholder={t('common.search')} value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    className="flex-1 min-w-[200px] rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <input type="text" placeholder={t('logs.sender')} value={filter.sender}
                    onChange={(e) => setFilter({ ...filter, sender: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <input type="text" placeholder={t('logs.recipient')} value={filter.recipient}
                    onChange={(e) => setFilter({ ...filter, recipient: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">{t('logs.allStatus', 'Todos os Status')}</option>
                    <option value="delivered">{t('logs.delivered', 'Entregue')}</option>
                    <option value="rejected">{t('logs.rejected', 'Rejeitado')}</option>
                    <option value="quarantined">{t('logs.quarantined', 'Quarentena')}</option>
                    <option value="deferred">{t('logs.deferred', 'Adiado')}</option>
                </select>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.from')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.to')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.subject')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('quarantine.score')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.date')}</th>
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
                                        {statusLabels[log.status] || log.status}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{log.spam_score !== null ? Number(log.spam_score).toFixed(1) : '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                            </tr>
                        ))}
                        {logs.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">{t('logs.noLogs')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">{t('common.previous')}</button>
                    <span className="px-4 py-2">{t('common.page')} {page} {t('common.of')} {pagination.pages}</span>
                    <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">{t('common.next')}</button>
                </div>
            )}
        </div>
    )
}
