import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

const statusColors = {
    online: 'bg-green-100 text-green-800 border-green-200',
    offline: 'bg-red-100 text-red-800 border-red-200',
    degraded: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    unknown: 'bg-gray-100 text-gray-800 border-gray-200'
}

const statusIcons = {
    online: '🟢',
    offline: '🔴',
    degraded: '🟡',
    unknown: '⚪'
}

const serviceIcons = {
    ClamAV: '🛡️',
    Rspamd: '📧',
    Postfix: '📮',
    Redis: '💾',
    PostgreSQL: '🗄️',
    'AI Engine': '🧠',
    'PDF Analyzer': '📄',
    'URL Intelligence': '🌐'
}

function ServiceCard({ service, isAI = false }) {
    const { t } = useTranslation()
    const status = service.status || 'unknown'

    return (
        <div className={`bg-white rounded-lg shadow-md border-2 ${statusColors[status]} p-6 transition-all hover:shadow-lg ${isAI ? 'ring-2 ring-purple-200' : ''}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <span className="text-3xl">{serviceIcons[service.name] || '⚙️'}</span>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
                        {isAI && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">AI Service</span>}
                    </div>
                </div>
                <span className="text-2xl">{statusIcons[status]}</span>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{t('common.status')}:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                        {t(`services.${status}`, status.charAt(0).toUpperCase() + status.slice(1))}
                    </span>
                </div>

                {service.host && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Host:</span>
                        <span className="text-sm font-mono text-gray-800">{service.host}</span>
                    </div>
                )}

                {service.port && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t('services.port', 'Porta')}:</span>
                        <span className="text-sm font-mono text-gray-800">{service.port}</span>
                    </div>
                )}

                {service.ports && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{t('services.ports', 'Portas')}:</span>
                        <span className="text-sm font-mono text-gray-800">{service.ports.join(', ')}</span>
                    </div>
                )}

                {service.version && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Versão:</span>
                        <span className="text-sm font-mono text-gray-800">{service.version}</span>
                    </div>
                )}

                {service.uptime !== undefined && service.uptime > 0 && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Uptime:</span>
                        <span className="text-sm font-mono text-gray-800">{formatUptime(service.uptime)}</span>
                    </div>
                )}

                {service.modelLoaded !== undefined && (
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Modelo:</span>
                        <span className={`text-sm font-medium ${service.modelLoaded ? 'text-green-600' : 'text-red-600'}`}>
                            {service.modelLoaded ? '✅ Carregado' : '❌ Não carregado'}
                        </span>
                    </div>
                )}

                {service.message && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {service.message}
                    </div>
                )}

                {service.error && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                        ⚠️ {service.error}
                    </div>
                )}
            </div>
        </div>
    )
}

function MetricsCard({ title, metrics }) {
    const { t } = useTranslation()

    if (!metrics || metrics.error) {
        return (
            <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
                <p className="text-gray-500 text-sm">{metrics?.error || t('common.noData')}</p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{title}</h3>
            <div className="space-y-3">
                {Object.entries(metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                        <span className="text-sm font-semibold text-gray-900">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function AIStatusBanner({ aiServices, summary }) {
    const aiOnline = aiServices?.filter(s => s.status === 'online').length || 0
    const aiTotal = aiServices?.length || 0
    const allAIOnline = aiOnline === aiTotal && aiTotal > 0

    return (
        <div className={`p-4 rounded-lg ${allAIOnline ? 'bg-purple-50 border border-purple-200' : 'bg-orange-50 border border-orange-200'}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                        <p className={`font-medium ${allAIOnline ? 'text-purple-800' : 'text-orange-800'}`}>
                            AI Intelligence Layer
                        </p>
                        <p className={`text-sm ${allAIOnline ? 'text-purple-600' : 'text-orange-600'}`}>
                            {aiOnline} de {aiTotal} serviços de IA ativos
                        </p>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${allAIOnline ? 'bg-purple-200 text-purple-800' : 'bg-orange-200 text-orange-800'}`}>
                    {allAIOnline ? '✅ Ativo' : '⚠️ Parcial'}
                </div>
            </div>
        </div>
    )
}

export default function Services() {
    const { t } = useTranslation()
    const [coreServices, setCoreServices] = useState([])
    const [aiServices, setAIServices] = useState([])
    const [metrics, setMetrics] = useState(null)
    const [overall, setOverall] = useState('unknown')
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)
    const [lastUpdate, setLastUpdate] = useState(null)
    const [autoRefresh, setAutoRefresh] = useState(true)

    const fetchStatus = async () => {
        try {
            const { data } = await api.get('/services/status')
            if (data.success) {
                setCoreServices(data.data.coreServices || data.data.services || [])
                setAIServices(data.data.aiServices || [])
                setOverall(data.data.overall || 'unknown')
                setSummary(data.data.summary || null)
                setLastUpdate(new Date())
            }
        } catch (err) {
            console.error('Error fetching services status:', err)
        }
    }

    const fetchMetrics = async () => {
        try {
            const { data } = await api.get('/services/metrics')
            if (data.success) {
                setMetrics(data.data.metrics || null)
            }
        } catch (err) {
            console.error('Error fetching metrics:', err)
        }
    }

    const fetchAll = async () => {
        setLoading(true)
        await Promise.all([fetchStatus(), fetchMetrics()])
        setLoading(false)
    }

    useEffect(() => {
        fetchAll()
    }, [])

    useEffect(() => {
        if (!autoRefresh) return

        const interval = setInterval(() => {
            fetchStatus()
            fetchMetrics()
        }, 30000) // Refresh every 30 seconds

        return () => clearInterval(interval)
    }, [autoRefresh])

    const overallColors = {
        healthy: 'bg-green-50 border-green-500 text-green-700',
        degraded: 'bg-yellow-50 border-yellow-500 text-yellow-700',
        critical: 'bg-red-50 border-red-500 text-red-700',
        unknown: 'bg-gray-50 border-gray-500 text-gray-700'
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('services.title', 'Status dos Serviços')}</h2>
                    <p className="text-sm text-gray-600">{t('services.subtitle', 'Monitoramento em tempo real dos serviços do sistema')}</p>
                </div>
                <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{t('services.autoRefresh', 'Auto-atualizar')}</span>
                    </label>
                    <button
                        onClick={fetchAll}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
                    >
                        <span>🔄</span>
                        <span>{t('services.refresh', 'Atualizar')}</span>
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <p className="text-3xl font-bold text-blue-600">{summary.totalServices}</p>
                        <p className="text-sm text-gray-600">Total de Serviços</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <p className="text-3xl font-bold text-green-600">{summary.online}</p>
                        <p className="text-sm text-gray-600">Online</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <p className="text-3xl font-bold text-red-600">{summary.offline}</p>
                        <p className="text-sm text-gray-600">Offline</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 text-center">
                        <p className="text-3xl font-bold text-purple-600">{summary.aiActive}/{summary.aiTotal}</p>
                        <p className="text-sm text-gray-600">AI Ativos</p>
                    </div>
                </div>
            )}

            {/* Overall Status Banner */}
            <div className={`border-l-4 p-4 rounded-r-lg ${overallColors[overall]}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <span className="text-2xl">
                            {overall === 'healthy' ? '✅' : overall === 'degraded' ? '⚠️' : overall === 'critical' ? '❌' : '❓'}
                        </span>
                        <div>
                            <p className="font-medium">
                                {overall === 'healthy'
                                    ? t('services.allServicesOnline', 'Todos os serviços core estão online')
                                    : overall === 'degraded'
                                        ? t('services.someServicesOffline', 'Alguns serviços apresentam problemas')
                                        : t('services.criticalIssues', 'Problemas críticos detectados')}
                            </p>
                            {lastUpdate && (
                                <p className="text-xs opacity-75">
                                    {t('services.lastUpdate', 'Última atualização')}: {lastUpdate.toLocaleTimeString('pt-BR')}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Services Section */}
            {aiServices && aiServices.length > 0 && (
                <div className="space-y-4">
                    <AIStatusBanner aiServices={aiServices} summary={summary} />

                    <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                        <span>🤖</span>
                        <span>Serviços de Inteligência Artificial</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {aiServices.map((service, index) => (
                            <ServiceCard key={service.name || index} service={service} isAI={true} />
                        ))}
                    </div>
                </div>
            )}

            {/* Core Services Section */}
            <div className="space-y-4">
                <h3 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <span>⚙️</span>
                    <span>Serviços Core</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coreServices.map((service, index) => (
                        <ServiceCard key={service.name || index} service={service} />
                    ))}
                </div>
            </div>

            {/* Metrics Section */}
            {metrics && (
                <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">{t('services.metrics', 'Métricas')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {metrics.postgresql && (
                            <MetricsCard
                                title="PostgreSQL"
                                metrics={{
                                    [t('services.databaseSize', 'Tamanho do Banco')]: formatBytes(metrics.postgresql.databaseSize),
                                    [t('services.activeConnections', 'Conexões Ativas')]: metrics.postgresql.activeConnections
                                }}
                            />
                        )}
                        {metrics.mail && (
                            <MetricsCard
                                title={t('services.mailStats', 'Estatísticas de Email (24h)')}
                                metrics={{
                                    [t('services.totalProcessed', 'Total Processados')]: metrics.mail.totalToday,
                                    [t('services.delivered', 'Entregues')]: metrics.mail.deliveredToday,
                                    [t('services.rejected', 'Rejeitados')]: metrics.mail.rejectedToday,
                                    [t('services.spam', 'Spam')]: metrics.mail.spamToday
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Info Card */}
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mt-6">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <span className="text-blue-400">ℹ️</span>
                    </div>
                    <div className="ml-3">
                        <p className="text-sm text-blue-700">
                            {t('services.infoMessage', 'Os serviços são verificados a cada 30 segundos quando a atualização automática está ativada.')}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Helper function to format uptime
function formatUptime(seconds) {
    if (!seconds) return '0s'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
        return `${hours}h ${minutes}m`
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`
    }
    return `${secs}s`
}
