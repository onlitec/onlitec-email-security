import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

const labelColors = {
    phishing: 'bg-red-100 text-red-800 border-red-300',
    fraud: 'bg-orange-100 text-orange-800 border-orange-300',
    spam: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    legit: 'bg-green-100 text-green-800 border-green-300'
}

const labelIcons = {
    phishing: '🎣',
    fraud: '⚠️',
    spam: '📧',
    legit: '✅'
}

const riskColors = {
    critical: 'text-red-600',
    high: 'text-orange-600',
    medium: 'text-yellow-600',
    low: 'text-green-600'
}

function StatCard({ title, value, icon, color }) {
    return (
        <div className={`bg-white rounded-lg shadow p-4 border-l-4 ${color}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-600">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
                <span className="text-3xl">{icon}</span>
            </div>
        </div>
    )
}

function VerdictRow({ verdict, onClick }) {
    const label = verdict.ai_label || 'unknown'
    const confidence = (verdict.ai_confidence * 100).toFixed(1)

    return (
        <tr
            className="hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onClick(verdict)}
        >
            <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${labelColors[label] || 'bg-gray-100'}`}>
                    <span className="mr-1">{labelIcons[label] || '❓'}</span>
                    {label.toUpperCase()}
                </span>
            </td>
            <td className="px-4 py-3 max-w-xs truncate" title={verdict.subject}>
                {verdict.subject || '(sem assunto)'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 truncate" title={verdict.sender}>
                {verdict.is_whitelisted && <span className="mr-1 text-green-600" title="Liberado">✅</span>}
                {verdict.is_blacklisted && <span className="mr-1 text-red-600" title="Bloqueado">🚫</span>}
                {verdict.sender}
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`font-medium ${verdict.ai_score >= 10 ? 'text-red-600' : verdict.ai_score >= 5 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {verdict.ai_score?.toFixed(1) || '0'}
                </span>
            </td>
            <td className="px-4 py-3 text-center">
                <span className="text-sm">{confidence}%</span>
            </td>
            <td className="px-4 py-3">
                <div className="flex space-x-1">
                    {verdict.pdf_has_js && <span title="PDF com JavaScript">📄⚠️</span>}
                    {verdict.pdf_has_links && <span title="PDF com links">📄🔗</span>}
                    {verdict.url_max_risk === 'critical' && <span title="URL crítica">🔗🔴</span>}
                    {verdict.url_max_risk === 'high' && <span title="URL alto risco">🔗🟠</span>}
                </div>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(verdict.processed_at).toLocaleString('pt-BR')}
            </td>
        </tr>
    )
}

function VerdictModal({ verdict, onClose, onApprove, onReject }) {
    if (!verdict) return null

    const reasons = verdict.ai_reasons || []

    const handleApprove = () => {
        onApprove(verdict)
    }

    const handleReject = () => {
        onReject(verdict)
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <h2 className="text-xl font-bold">Detalhes da Análise IA</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
                    </div>

                    {/* Header Info */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-gray-600">De</p>
                                <p className="font-medium flex items-center">
                                    {verdict.sender}
                                    {verdict.is_whitelisted && <span className="ml-2 text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full border border-green-200">Liberado</span>}
                                    {verdict.is_blacklisted && <span className="ml-2 text-red-600 text-xs bg-red-100 px-2 py-0.5 rounded-full border border-red-200">Bloqueado</span>}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Para</p>
                                <p className="font-medium">{verdict.recipient}</p>
                            </div>
                            <div className="col-span-2">
                                <p className="text-sm text-gray-600">Assunto</p>
                                <p className="font-medium">{verdict.subject}</p>
                            </div>
                        </div>
                    </div>

                    {/* AI Classification */}
                    <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2">🧠 Classificação IA</h3>
                        <div className="flex items-center space-x-4">
                            <span className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-medium border ${labelColors[verdict.ai_label] || 'bg-gray-100'}`}>
                                <span className="mr-2 text-2xl">{labelIcons[verdict.ai_label] || '❓'}</span>
                                {(verdict.ai_label || 'unknown').toUpperCase()}
                            </span>
                            <div>
                                <p className="text-sm text-gray-600">Confiança: <span className="font-bold">{(verdict.ai_confidence * 100).toFixed(1)}%</span></p>
                                <p className="text-sm text-gray-600">Score: <span className="font-bold">{verdict.ai_score?.toFixed(1)}</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Reasons */}
                    {reasons.length > 0 && (
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-2">📋 Motivos da Detecção</h3>
                            <ul className="bg-yellow-50 rounded-lg p-4 space-y-2">
                                {reasons.map((reason, idx) => (
                                    <li key={idx} className="flex items-start">
                                        <span className="text-yellow-600 mr-2">⚡</span>
                                        <span>{reason}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* PDF Analysis */}
                    {(verdict.pdf_has_js || verdict.pdf_has_links || verdict.pdf_risk_score > 0) && (
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-2">📄 Análise de PDF</h3>
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">JavaScript</p>
                                        <p className={`font-bold ${verdict.pdf_has_js ? 'text-red-600' : 'text-green-600'}`}>
                                            {verdict.pdf_has_js ? '⚠️ Detectado' : '✅ Não'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Links Externos</p>
                                        <p className={`font-bold ${verdict.pdf_has_links ? 'text-yellow-600' : 'text-green-600'}`}>
                                            {verdict.pdf_has_links ? '🔗 Sim' : '✅ Não'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Risco PDF</p>
                                        <p className="font-bold">{verdict.pdf_risk_score?.toFixed(1) || '0'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* URL Analysis */}
                    {verdict.url_max_risk && (
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-2">🌐 Análise de URLs</h3>
                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Risco Máximo</p>
                                        <p className={`font-bold ${riskColors[verdict.url_max_risk] || 'text-gray-600'}`}>
                                            {verdict.url_max_risk?.toUpperCase()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Score URL</p>
                                        <p className="font-bold">{verdict.url_max_score?.toFixed(1) || '0'}</p>
                                    </div>
                                </div>
                                {verdict.url_risky_urls && verdict.url_risky_urls.length > 0 && (
                                    <div className="mt-2">
                                        <p className="text-sm text-gray-600 mb-1">URLs Suspeitas:</p>
                                        <ul className="text-sm space-y-1">
                                            {verdict.url_risky_urls.map((url, idx) => (
                                                <li key={idx} className="font-mono text-red-600 truncate">{url}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Final Decision */}
                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <p className="text-sm text-gray-600">Ação Final</p>
                                <p className={`text-lg font-bold ${verdict.final_action === 'reject' ? 'text-red-600' :
                                    verdict.final_action === 'quarantine' ? 'text-orange-600' : 'text-green-600'
                                    }`}>
                                    {verdict.final_action?.toUpperCase() || 'N/A'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-600">Score Total</p>
                                <p className="text-2xl font-bold">{verdict.total_score?.toFixed(1) || '0'}</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end border-t pt-4">
                            <button
                                onClick={handleApprove}
                                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 font-medium transition-colors"
                            >
                                Liberar
                            </button>
                            <button
                                onClick={handleReject}
                                className="bg-red-600 text-white px-6 py-2 rounded-md hover:bg-red-700 font-medium transition-colors"
                            >
                                Bloquear
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AIVerdicts() {
    const { t } = useTranslation()
    const [verdicts, setVerdicts] = useState([])
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [selectedVerdict, setSelectedVerdict] = useState(null)
    const [filter, setFilter] = useState('')
    const [page, setPage] = useState(1)
    const [pagination, setPagination] = useState(null)

    const fetchVerdicts = async () => {
        try {
            const params = new URLSearchParams({ page, limit: 20 })
            if (filter) params.append('label', filter)

            const { data } = await api.get(`/ai/verdicts?${params}`)
            if (data.success) {
                setVerdicts(data.data.verdicts)
                setPagination(data.data.pagination)
            }
        } catch (err) {
            console.error('Error fetching verdicts:', err)
        }
    }

    const fetchStats = async () => {
        try {
            const { data } = await api.get('/ai/verdicts/stats')
            if (data.success) {
                setStats(data.data.summary)
            }
        } catch (err) {
            console.error('Error fetching stats:', err)
        }
    }

    const handleApprove = async (verdict) => {
        if (!confirm('Deseja liberar este e-mail? O remetente será adicionado à lista de permissões.')) return
        try {
            if (verdict.quarantine_id) {
                await api.post(`/quarantine/${verdict.quarantine_id}/approve`)
            } else {
                await api.post(`/logs/${verdict.mail_log_id}/approve`)
            }
            setSelectedVerdict(null)
            fetchVerdicts()
            fetchStats()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Falha ao aprovar')
        }
    }

    const handleReject = async (verdict) => {
        if (!confirm('Deseja bloquear este e-mail? O remetente será adicionado à lista de bloqueio.')) return
        try {
            if (verdict.quarantine_id) {
                await api.post(`/quarantine/${verdict.quarantine_id}/reject`)
            } else {
                await api.post(`/logs/${verdict.mail_log_id}/reject`)
            }
            setSelectedVerdict(null)
            fetchVerdicts()
            fetchStats()
        } catch (err) {
            alert(err.response?.data?.error?.message || 'Falha ao rejeitar')
        }
    }

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            await Promise.all([fetchVerdicts(), fetchStats()])
            setLoading(false)
        }
        load()
    }, [page, filter])

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center space-x-2">
                    <span>🧠</span>
                    <span>Análises de IA</span>
                </h2>
                <p className="text-sm text-gray-600">Visualize emails analisados pelos serviços de inteligência artificial</p>
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    <StatCard title="Total (7 dias)" value={stats.total || 0} icon="📊" color="border-blue-500" />
                    <StatCard title="Phishing" value={stats.phishing || 0} icon="🎣" color="border-red-500" />
                    <StatCard title="Fraude" value={stats.fraud || 0} icon="⚠️" color="border-orange-500" />
                    <StatCard title="Spam" value={stats.spam || 0} icon="📧" color="border-yellow-500" />
                    <StatCard title="Legítimos" value={stats.legit || 0} icon="✅" color="border-green-500" />
                    <StatCard title="PDFs c/ JS" value={stats.pdf_with_js || 0} icon="📄" color="border-purple-500" />
                </div>
            )}

            {/* Filters */}
            <div className="flex items-center space-x-4 bg-white rounded-lg shadow p-4">
                <span className="text-sm text-gray-600">Filtrar por:</span>
                <select
                    value={filter}
                    onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                    className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                    <option value="">Todos</option>
                    <option value="phishing">🎣 Phishing</option>
                    <option value="fraud">⚠️ Fraude</option>
                    <option value="spam">📧 Spam</option>
                    <option value="legit">✅ Legítimo</option>
                </select>
                <button
                    onClick={() => { fetchVerdicts(); fetchStats(); }}
                    className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center space-x-2"
                >
                    <span>🔄</span>
                    <span>Atualizar</span>
                </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Classificação</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assunto</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remetente</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Score</th>
                            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Confiança</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Flags</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {verdicts.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                                    <span className="text-4xl">📭</span>
                                    <p className="mt-2">Nenhuma análise de IA encontrada</p>
                                    <p className="text-sm">Os veredictos aparecerão aqui quando emails forem processados</p>
                                </td>
                            </tr>
                        ) : (
                            verdicts.map(verdict => (
                                <VerdictRow
                                    key={verdict.id}
                                    verdict={verdict}
                                    onClick={setSelectedVerdict}
                                />
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-t">
                        <p className="text-sm text-gray-600">
                            Mostrando {((page - 1) * 20) + 1} a {Math.min(page * 20, pagination.total)} de {pagination.total}
                        </p>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 border rounded disabled:opacity-50"
                            >
                                ← Anterior
                            </button>
                            <span className="px-3 py-1">Página {page} de {pagination.totalPages}</span>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="px-3 py-1 border rounded disabled:opacity-50"
                            >
                                Próxima →
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            <VerdictModal
                verdict={selectedVerdict}
                onClose={() => setSelectedVerdict(null)}
                onApprove={handleApprove}
                onReject={handleReject}
            />
        </div>
    )
}
