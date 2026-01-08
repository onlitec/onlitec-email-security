import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function AuditLog() {
    const { t } = useTranslation()
    const [activeTab, setActiveTab] = useState('system') // 'system' or 'message'

    // System Audit State
    const [systemLogs, setSystemLogs] = useState([])
    const [systemStats, setSystemStats] = useState(null)
    const [systemLoading, setSystemLoading] = useState(false)
    const [systemFilter, setSystemFilter] = useState({ action: '', resource_type: '' })
    const [systemPage, setSystemPage] = useState(1)
    const [systemPagination, setSystemPagination] = useState({ total: 0, pages: 0 })

    // Message Audit State
    const [messageLogs, setMessageLogs] = useState([])
    const [messageLoading, setMessageLoading] = useState(false)
    const [messageFilter, setMessageFilter] = useState({ search: '' }) // Search by sender, recipient, subject
    const [messagePage, setMessagePage] = useState(1)
    const [messagePagination, setMessagePagination] = useState({ total: 0, pages: 0 })
    const [proofLoading, setProofLoading] = useState(null) // ID of message currently generating proof

    // Fetch System Logs
    useEffect(() => {
        if (activeTab === 'system') fetchSystemData()
    }, [activeTab, systemFilter, systemPage])

    // Fetch Message Logs
    useEffect(() => {
        if (activeTab === 'message') fetchMessageData()
    }, [activeTab, messageFilter, messagePage])

    const fetchSystemData = async () => {
        setSystemLoading(true)
        try {
            const params = new URLSearchParams({ ...systemFilter, page: systemPage, limit: 50 }).toString()
            const [logsRes, statsRes] = await Promise.all([
                api.get(`/audit?${params}`),
                api.get('/audit/stats')
            ])
            setSystemLogs(logsRes.data.data || [])
            setSystemPagination(logsRes.data.pagination || { total: 0, pages: 0 })
            setSystemStats(statsRes.data.data)
        } catch (err) {
            console.error('Error fetching system audit:', err)
        } finally {
            setSystemLoading(false)
        }
    }

    const fetchMessageData = async () => {
        setMessageLoading(true)
        try {
            const params = new URLSearchParams({
                ...messageFilter,
                page: messagePage,
                limit: 20
            }).toString()
            const logsRes = await api.get(`/logs?${params}`)
            setMessageLogs(logsRes.data.data || [])
            setMessagePagination(logsRes.data.pagination || { total: 0, pages: 0 })
        } catch (err) {
            console.error('Error fetching message audit:', err)
        } finally {
            setMessageLoading(false)
        }
    }

    const handleGenerateProof = async (messageId) => {
        setProofLoading(messageId)
        try {
            const response = await api.post('/audit/proof', { messageId }, { responseType: 'blob' })
            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `proof-${messageId}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (err) {
            console.error('Error generating proof:', err)
            alert('Erro ao gerar comprovante.')
        } finally {
            setProofLoading(null)
        }
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR')

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('audit.title', 'Auditoria')}</h2>
                <p className="text-sm text-gray-600">{t('audit.subtitle', 'Rastreie ações do sistema e verifique o status de mensagens.')}</p>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`${activeTab === 'system'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Auditoria do Sistema
                    </button>
                    <button
                        onClick={() => setActiveTab('message')}
                        className={`${activeTab === 'message'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Auditoria de Mensagens (Comprovantes)
                    </button>
                </nav>
            </div>

            {/* System Audit Content */}
            {activeTab === 'system' && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    {systemStats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg shadow p-4">
                                <h4 className="text-sm font-medium text-gray-500 mb-2">{t('audit.topActions')}</h4>
                                <div className="space-y-1">
                                    {systemStats.byAction?.slice(0, 5).map((a, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-700">{a.action}</span>
                                            <span className="text-gray-500">{a.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4">
                                <h4 className="text-sm font-medium text-gray-500 mb-2">{t('audit.activityByDay')}</h4>
                                <div className="space-y-1">
                                    {systemStats.byDay?.map((d, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-700">{new Date(d.date).toLocaleDateString('pt-BR')}</span>
                                            <span className="text-gray-500">{d.count} {t('audit.actions')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-4">
                                <h4 className="text-sm font-medium text-gray-500 mb-2">{t('audit.topUsers')}</h4>
                                <div className="space-y-1">
                                    {systemStats.byUser?.map((u, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span className="text-gray-700 truncate">{u.email}</span>
                                            <span className="text-gray-500">{u.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System Filters */}
                    <div className="bg-white rounded-lg shadow p-4 flex gap-4">
                        <input type="text" placeholder={t('audit.action')} value={systemFilter.action}
                            onChange={(e) => setSystemFilter({ ...systemFilter, action: e.target.value })}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                        <select value={systemFilter.resource_type} onChange={(e) => setSystemFilter({ ...systemFilter, resource_type: e.target.value })}
                            className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                            <option value="">{t('audit.allResources', 'Todos os Recursos')}</option>
                            <option value="tenant">{t('nav.tenants')}</option>
                            <option value="domain">{t('nav.domains')}</option>
                            <option value="user">{t('nav.users')}</option>
                            <option value="policy">{t('nav.policies')}</option>
                        </select>
                    </div>

                    {/* System Table */}
                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        {systemLoading ? (
                            <div className="text-center py-12">{t('common.loading')}</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.date')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.user')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.action')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.resource')}</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('audit.ip')}</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {systemLogs.map((log) => (
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
                                    {systemLogs.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">{t('audit.noLogs')}</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {systemPagination.pages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button disabled={systemPage <= 1} onClick={() => setSystemPage(p => p - 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">{t('common.previous')}</button>
                            <span className="px-4 py-2">{t('common.page')} {systemPage} {t('common.of')} {systemPagination.pages}</span>
                            <button disabled={systemPage >= systemPagination.pages} onClick={() => setSystemPage(p => p + 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">{t('common.next')}</button>
                        </div>
                    )}
                </div>
            )}

            {/* Message Audit Content */}
            {activeTab === 'message' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-4 flex gap-4">
                        <input
                            type="text"
                            placeholder="Buscar por remetente, destinatário, assunto..."
                            value={messageFilter.search}
                            onChange={(e) => setMessageFilter({ ...messageFilter, search: e.target.value })}
                            className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                    </div>

                    <div className="bg-white shadow rounded-lg overflow-hidden">
                        {messageLoading ? (
                            <div className="text-center py-12">{t('common.loading')}</div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remetente</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Destinatário</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {messageLogs.map((log) => (
                                        <tr key={log.id}>
                                            <td className="px-4 py-3 text-sm text-gray-500">{formatDate(log.created_at)}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{log.sender}</td>
                                            <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{log.recipient}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 text-xs rounded-full ${log.status === 'delivered' || log.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                                        log.status === 'rejected' || log.status === 'spam' || log.status === 'virus' ? 'bg-red-100 text-red-800' :
                                                            'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => handleGenerateProof(log.id)}
                                                    disabled={proofLoading === log.id}
                                                    className="text-blue-600 hover:text-blue-900 text-sm font-medium disabled:opacity-50"
                                                >
                                                    {proofLoading === log.id ? 'Gerando...' : 'Gerar Comprovante'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {messageLogs.length === 0 && <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">Nenhuma mensagem encontrada.</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {messagePagination.pages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button disabled={messagePage <= 1} onClick={() => setMessagePage(p => p - 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">{t('common.previous')}</button>
                            <span className="px-4 py-2">{t('common.page')} {messagePage} {t('common.of')} {messagePagination.pages}</span>
                            <button disabled={messagePage >= messagePagination.pages} onClick={() => setMessagePage(p => p + 1)} className="px-4 py-2 border rounded-md disabled:opacity-50">{t('common.next')}</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
