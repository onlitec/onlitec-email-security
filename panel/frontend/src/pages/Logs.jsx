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
    const [selected, setSelected] = useState([])

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

    const handleApprove = async (id) => {
        if (!confirm(t('logs.confirmApprove', 'Deseja adicionar este remetente à lista de permissões?'))) return
        try {
            await api.post(`/logs/${id}/approve`)
            alert(t('logs.approved', 'Remetente liberado!'))
        } catch (err) {
            alert(err.response?.data?.error?.message || t('logs.approveFailed', 'Falha ao aprovar'))
        }
    }

    const handleReject = async (id) => {
        if (!confirm(t('logs.confirmReject', 'Deseja bloquear este remetente?'))) return
        try {
            await api.post(`/logs/${id}/reject`)
            alert(t('logs.rejected', 'Remetente bloqueado!'))
        } catch (err) {
            alert(err.response?.data?.error?.message || t('logs.rejectFailed', 'Falha ao rejeitar'))
        }
    }

    const handleBulkAction = async (action) => {
        if (selected.length === 0) return
        const msg = action === 'approve' ? 'Aprovar' : 'Rejeitar';
        if (!confirm(t(`logs.confirmBulk${action}`, `${msg} remetentes de ${selected.length} logs?`))) return
        try {
            for (const id of selected) {
                await api.post(`/logs/${id}/${action}`)
            }
            setSelected([])
            alert(t('logs.bulkSuccess', 'Ação em massa concluída!'))
        } catch (err) {
            alert(err.response?.data?.error?.message || t('logs.bulkActionFailed', 'Falha na ação em massa'))
        }
    }

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
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
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('logs.title')}</h2>
                    <p className="text-sm text-gray-600">{t('logs.subtitle')}</p>
                </div>
                <div className="flex gap-2">
                    {selected.length > 0 && (
                        <>
                            <button onClick={() => handleBulkAction('approve')} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
                                {t('logs.approveSelected', 'Aprovar')} ({selected.length})
                            </button>
                            <button onClick={() => handleBulkAction('reject')} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm">
                                {t('logs.rejectSelected', 'Rejeitar')} ({selected.length})
                            </button>
                        </>
                    )}
                </div>
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
                            <th className="px-4 py-3 text-left">
                                <input type="checkbox" onChange={(e) => {
                                    if (e.target.checked) setSelected(logs.map(l => l.id))
                                    else setSelected([])
                                }} checked={selected.length === logs.length && logs.length > 0} className="rounded border-gray-300" />
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.from')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.to')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.subject')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('quarantine.score')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.date')}</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions', 'Ações')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {logs.map((log) => (
                            <tr key={log.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3">
                                    <input type="checkbox" checked={selected.includes(log.id)}
                                        onChange={() => toggleSelect(log.id)} className="rounded border-gray-300" />
                                </td>
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
                                <td className="px-4 py-3 text-right text-sm space-x-2">
                                    <button onClick={() => handleApprove(log.id)} className="text-green-600 hover:text-green-900" title={t('logs.approve', 'Aprovar')}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </button>
                                    <button onClick={() => handleReject(log.id)} className="text-red-600 hover:text-red-900" title={t('logs.reject', 'Rejeitar')}>
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </td>
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
