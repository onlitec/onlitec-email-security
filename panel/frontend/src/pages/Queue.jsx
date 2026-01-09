import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Queue() {
    const { t } = useTranslation()
    const [emails, setEmails] = useState([])
    const [stats, setStats] = useState({ total: 0, deferred: 0, active: 0, hold: 0 })
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState({ search: '', status: '' })
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState({ total: 0, pages: 0 })
    const [selected, setSelected] = useState([])
    const [detailModal, setDetailModal] = useState(null)
    const [detailContent, setDetailContent] = useState('')
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => { fetchQueue() }, [filter, page])

    const fetchQueue = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams({ ...filter, page, limit: 50 }).toString()
            const { data } = await api.get(`/queue?${params}`)
            setEmails(data.data || [])
            setStats(data.stats || { total: 0, deferred: 0, active: 0, hold: 0 })
            setPagination(data.pagination || { total: 0, pages: 0 })
        } catch (err) {
            console.error('Error fetching queue:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleViewDetails = async (id) => {
        try {
            setDetailModal(id)
            setDetailContent('Carregando...')
            const { data } = await api.get(`/queue/${id}`)
            setDetailContent(data.data?.content || 'Sem conteúdo')
        } catch (err) {
            setDetailContent('Erro ao carregar detalhes: ' + (err.response?.data?.error?.message || err.message))
        }
    }

    const handleAction = async (id, action, confirmMsg) => {
        if (!confirm(confirmMsg)) return
        setActionLoading(true)
        try {
            await api.post(`/queue/${id}/${action}`)
            alert('Ação executada com sucesso!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleDelete = async (id) => {
        if (!confirm('Deseja excluir este email da fila?')) return
        setActionLoading(true)
        try {
            await api.delete(`/queue/${id}`)
            alert('Email removido da fila!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleBulkDelete = async () => {
        if (selected.length === 0) return
        if (!confirm(`Deseja excluir ${selected.length} emails selecionados?`)) return
        setActionLoading(true)
        try {
            for (const id of selected) {
                await api.delete(`/queue/${id}`)
            }
            setSelected([])
            alert('Emails removidos!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleFlushAll = async () => {
        if (!confirm('Deseja forçar a entrega de todos os emails na fila?')) return
        setActionLoading(true)
        try {
            await api.post('/queue/flush-all')
            alert('Tentativa de entrega iniciada para todos os emails!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteAll = async () => {
        if (!confirm('⚠️ ATENÇÃO: Isso removerá TODOS os emails da fila. Confirma?')) return
        if (!confirm('Tem certeza absoluta? Esta ação não pode ser desfeita!')) return
        setActionLoading(true)
        try {
            await api.delete('/queue/all')
            alert('Fila limpa!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const handleDeleteBounces = async () => {
        if (!confirm('Deseja excluir todos os bounces (MAILER-DAEMON) da fila?')) return
        setActionLoading(true)
        try {
            await api.post('/queue/delete-by-sender', { sender: 'MAILER-DAEMON' })
            alert('Bounces removidos!')
            fetchQueue()
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error?.message || err.message))
        } finally {
            setActionLoading(false)
        }
    }

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const toggleSelectAll = () => {
        if (selected.length === emails.length) {
            setSelected([])
        } else {
            setSelected(emails.map(e => e.id))
        }
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR')
    const formatSize = (bytes) => bytes > 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${bytes} B`

    const queueColors = {
        deferred: 'bg-yellow-100 text-yellow-800',
        active: 'bg-blue-100 text-blue-800',
        hold: 'bg-gray-100 text-gray-800'
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">📬 {t('queue.title', 'Fila de Emails')}</h1>
                <div className="flex gap-2">
                    <button onClick={fetchQueue} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200" disabled={loading}>
                        🔄 Atualizar
                    </button>
                    <button onClick={handleFlushAll} className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600" disabled={actionLoading}>
                        📤 Forçar Entrega (Todos)
                    </button>
                    <button onClick={handleDeleteBounces} className="px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600" disabled={actionLoading}>
                        🗑️ Limpar Bounces
                    </button>
                    <button onClick={handleDeleteAll} className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600" disabled={actionLoading}>
                        ❌ Limpar Tudo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
                    <div className="text-sm text-gray-500">Total na Fila</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg shadow border-l-4 border-yellow-500">
                    <div className="text-2xl font-bold text-yellow-700">{stats.deferred}</div>
                    <div className="text-sm text-yellow-600">Adiados</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg shadow border-l-4 border-blue-500">
                    <div className="text-2xl font-bold text-blue-700">{stats.active}</div>
                    <div className="text-sm text-blue-600">Ativos</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow border-l-4 border-gray-500">
                    <div className="text-2xl font-bold text-gray-700">{stats.hold}</div>
                    <div className="text-sm text-gray-600">Em Espera</div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 bg-white p-4 rounded-lg shadow">
                <input
                    type="text"
                    placeholder="Buscar por remetente, destinatário, ID..."
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2"
                    value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                />
                <select
                    className="border border-gray-300 rounded-lg px-4 py-2"
                    value={filter.status}
                    onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                >
                    <option value="">Todos os Status</option>
                    <option value="deferred">Adiado</option>
                    <option value="active">Ativo</option>
                    <option value="hold">Em Espera</option>
                </select>
            </div>

            {/* Bulk Actions */}
            {selected.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg flex items-center justify-between">
                    <span className="text-blue-700">{selected.length} email(s) selecionado(s)</span>
                    <button onClick={handleBulkDelete} className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600" disabled={actionLoading}>
                        🗑️ Excluir Selecionados
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                {loading ? (
                    <div className="text-center py-12">{t('common.loading', 'Carregando...')}</div>
                ) : emails.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">✅ Fila vazia - Nenhum email pendente</div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3">
                                    <input type="checkbox" checked={selected.length === emails.length && emails.length > 0} onChange={toggleSelectAll} />
                                </th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">De</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Para</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tamanho</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motivo</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {emails.map((email) => (
                                <tr key={email.id} className={selected.includes(email.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                                    <td className="px-3 py-3">
                                        <input type="checkbox" checked={selected.includes(email.id)} onChange={() => toggleSelect(email.id)} />
                                    </td>
                                    <td className="px-4 py-3 text-sm font-mono text-gray-600">{email.id.substring(0, 10)}...</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={email.sender}>
                                        {email.sender === 'MAILER-DAEMON' ? <span className="text-orange-600">⚠️ BOUNCE</span> : email.sender}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={email.recipient}>{email.recipient}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatSize(email.size)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${queueColors[email.queue] || 'bg-gray-100'}`}>
                                            {email.queue}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-red-600 max-w-[250px] truncate" title={email.reason}>{email.reason || '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(email.arrivalTime)}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <div className="flex gap-1">
                                            <button onClick={() => handleViewDetails(email.id)} className="p-1 text-blue-600 hover:bg-blue-100 rounded" title="Ver Detalhes">
                                                👁️
                                            </button>
                                            <button onClick={() => handleAction(email.id, 'flush', 'Forçar entrega?')} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Forçar Entrega" disabled={actionLoading}>
                                                📤
                                            </button>
                                            <button onClick={() => handleDelete(email.id)} className="p-1 text-red-600 hover:bg-red-100 rounded" title="Excluir" disabled={actionLoading}>
                                                🗑️
                                            </button>
                                            {email.queue !== 'hold' ? (
                                                <button onClick={() => handleAction(email.id, 'hold', 'Pausar entrega?')} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="Pausar" disabled={actionLoading}>
                                                    ⏸️
                                                </button>
                                            ) : (
                                                <button onClick={() => handleAction(email.id, 'release', 'Liberar entrega?')} className="p-1 text-green-600 hover:bg-green-100 rounded" title="Liberar" disabled={actionLoading}>
                                                    ▶️
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">
                        ← Anterior
                    </button>
                    <span className="px-3 py-1">{page} / {pagination.pages}</span>
                    <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">
                        Próximo →
                    </button>
                </div>
            )}

            {/* Detail Modal */}
            {detailModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setDetailModal(null)}>
                    <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Detalhes do Email - {detailModal}</h2>
                            <button onClick={() => setDetailModal(null)} className="text-gray-500 hover:text-gray-700">✕</button>
                        </div>
                        <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                            {detailContent}
                        </pre>
                    </div>
                </div>
            )}
        </div>
    )
}
