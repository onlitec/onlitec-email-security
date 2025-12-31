import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../api'

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981']

const ICONS = {
    users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
    domains: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9 9m9-9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    tenants: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    spam: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    virus: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    quarantine: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
}

export default function Dashboard() {
    const { t } = useTranslation()
    const [stats, setStats] = useState(null)
    const [servicesStatus, setServicesStatus] = useState(null)
    const [aiStats, setAiStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { fetchStats(); fetchServicesStatus(); fetchAiStats() }, [])

    const fetchStats = async () => {
        try {
            const response = await api.get('/stats')
            if (response.data.success) {
                setStats(response.data.data)
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchServicesStatus = async () => {
        try {
            const response = await api.get('/services/status')
            if (response.data.success) {
                setServicesStatus(response.data.data)
            }
        } catch (error) {
            console.error('Failed to fetch services status:', error)
        }
    }

    const fetchAiStats = async () => {
        try {
            const response = await api.get('/ai/verdicts/stats')
            if (response.data.success) {
                setAiStats(response.data.data.summary)
            }
        } catch (error) {
            console.error('Failed to fetch AI stats:', error)
        }
    }

    const processTrendData = () => {
        if (!stats?.trend) return []
        const grouped = {}
        stats.trend.forEach(item => {
            const date = new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            if (!grouped[date]) {
                grouped[date] = { date, received: 0, delivered: 0, spam: 0, virus: 0 }
            }
            grouped[date].received += parseInt(item.received) || 0
            grouped[date].delivered += parseInt(item.delivered) || 0
            grouped[date].spam += parseInt(item.spam) || 0
            grouped[date].virus += parseInt(item.virus) || 0
        })
        return Object.values(grouped).slice(-7)
    }

    const pieData = stats ? [
        { name: t('dashboard.delivered'), value: stats.trend?.reduce((acc, t) => acc + (parseInt(t.delivered) || 0), 0) || 0 },
        { name: t('dashboard.spam'), value: stats.trend?.reduce((acc, t) => acc + (parseInt(t.spam) || 0), 0) || 0 },
        { name: t('dashboard.virus'), value: stats.virusDetected || 0 }
    ].filter(d => d.value > 0) : []

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    const trendData = processTrendData()

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
                <p className="mt-1 text-sm text-gray-600">{t('dashboard.subtitle')}</p>
            </div>

            {/* Stats Cards - Reorganized Layout */}

            {/* Row 1: Registration/Admin Metrics */}
            <h3 className="text-lg font-medium text-gray-900 mb-2">Cadastros</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title={t('dashboard.totalDomains')}
                    value={stats?.totalDomains || 0}
                    subtitle={t('dashboard.configured')}
                    color="blue"
                    iconPath={ICONS.domains}
                    tooltip="Número total de domínios de email configurados no sistema para receber e enviar mensagens."
                />
                <StatsCard
                    title={t('dashboard.totalTenants', 'Total de Clientes')}
                    value={stats?.totalTenants || 0}
                    subtitle={t('dashboard.total')}
                    color="green"
                    iconPath={ICONS.tenants}
                    tooltip="Total de organizações/empresas cadastradas na plataforma multi-tenant."
                />
                <StatsCard
                    title={t('dashboard.activeTenants')}
                    value={stats?.activeTenants || 0}
                    subtitle={t('dashboard.active', 'Ativos')}
                    color="green"
                    iconPath={ICONS.tenants}
                    tooltip="Clientes com status ativo que podem enviar e receber emails normalmente."
                />
                <StatsCard
                    title={t('dashboard.totalUsers')}
                    value={stats?.totalUsers || 0}
                    subtitle={t('dashboard.emailAccounts')}
                    color="green"
                    iconPath={ICONS.users}
                    tooltip="Total de contas de email (caixas de correio) criadas em todos os domínios."
                />
            </div>

            {/* Row 2: Email Metrics */}
            <h3 className="text-lg font-medium text-gray-900 mb-2 mt-6">Métricas de Email</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard
                    title={t('dashboard.emailsToday')}
                    value={stats?.emailsToday || 0}
                    subtitle={t('dashboard.last24h')}
                    color="blue"
                    iconPath={ICONS.email}
                    tooltip="Quantidade de emails processados nas últimas 24 horas, incluindo recebidos e enviados."
                />
                <StatsCard
                    title={t('dashboard.spamBlocked')}
                    value={stats?.spamBlocked || 0}
                    subtitle={t('dashboard.today')}
                    color="red"
                    iconPath={ICONS.spam}
                    tooltip="Emails identificados como spam e bloqueados hoje. Protege os usuários de mensagens indesejadas."
                />
                <StatsCard
                    title={t('dashboard.virusDetected')}
                    value={stats?.virusDetected || 0}
                    subtitle={t('dashboard.thisWeek')}
                    color="yellow"
                    iconPath={ICONS.virus}
                    tooltip="Anexos maliciosos detectados pelo antivírus ClamAV esta semana. Ameaças neutralizadas."
                />
                <StatsCard
                    title={t('dashboard.quarantined')}
                    value={stats?.quarantinedEmails || 0}
                    subtitle={t('dashboard.pendingReview')}
                    color="yellow"
                    iconPath={ICONS.quarantine}
                    tooltip="Emails retidos em quarentena aguardando revisão manual. Podem ser liberados ou excluídos."
                />
            </div>

            {/* AI Analysis Stats Cards */}
            {aiStats && (
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-4 border border-purple-100 mt-6">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                            <span>🧠</span>
                            <span>Análise de IA</span>
                        </h3>
                        <Link
                            to="/ai-verdicts"
                            className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                        >
                            Ver detalhes →
                        </Link>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        <AIStatCard
                            title="Total (7d)"
                            value={aiStats.total || 0}
                            icon="📊"
                            borderColor="border-blue-400"
                            tooltip="Total de emails analisados pela IA nos últimos 7 dias."
                        />
                        <AIStatCard
                            title="Phishing"
                            value={aiStats.phishing || 0}
                            icon="🎣"
                            borderColor="border-red-400"
                            tooltip="Tentativas de phishing detectadas. Emails que tentam roubar dados pessoais ou credenciais."
                        />
                        <AIStatCard
                            title="Fraude"
                            value={aiStats.fraud || 0}
                            icon="⚠️"
                            borderColor="border-orange-400"
                            tooltip="Emails fraudulentos identificados, incluindo golpes financeiros e engenharia social."
                        />
                        <AIStatCard
                            title="Spam"
                            value={aiStats.spam || 0}
                            icon="📧"
                            borderColor="border-yellow-400"
                            tooltip="Emails de propaganda não solicitada ou conteúdo comercial indesejado."
                        />
                        <AIStatCard
                            title="Legítimos"
                            value={aiStats.legit || 0}
                            icon="✅"
                            borderColor="border-green-400"
                            tooltip="Emails classificados como seguros e legítimos pela análise de IA."
                        />
                        <AIStatCard
                            title="PDFs c/ JS"
                            value={aiStats.pdf_with_js || 0}
                            icon="📄"
                            borderColor="border-purple-400"
                            tooltip="PDFs com código JavaScript embutido detectados. Podem ser usados para ataques."
                        />
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.emailVolume')}</h3>
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <ChartTooltip />
                                <Legend />
                                <Line type="monotone" dataKey="received" stroke="#3B82F6" strokeWidth={2} name={t('dashboard.received')} />
                                <Line type="monotone" dataKey="delivered" stroke="#10B981" strokeWidth={2} name={t('dashboard.delivered')} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">{t('common.noData')}</div>
                    )}
                </div>

                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.spamVirusBlocked')}</h3>
                    {trendData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <ChartTooltip />
                                <Legend />
                                <Bar dataKey="spam" fill="#EF4444" name={t('dashboard.spam')} />
                                <Bar dataKey="virus" fill="#F59E0B" name={t('dashboard.virus')} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">{t('common.noData')}</div>
                    )}
                </div>
            </div>

            {pieData.length > 0 && (
                <div className="bg-white shadow rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.emailDistribution')}</h3>
                    <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <ChartTooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Recent Activity */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">{t('dashboard.recentActivity')}</h3>
                {stats?.recentActivity && stats.recentActivity.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('dashboard.from')}</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('dashboard.to')}</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('dashboard.subject')}</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('common.status')}</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">{t('dashboard.date')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {stats.recentActivity.map((activity, idx) => (
                                    <tr key={idx}>
                                        <td className="px-4 py-2 text-sm text-gray-900 max-w-[150px] truncate">{activity.sender}</td>
                                        <td className="px-4 py-2 text-sm text-gray-500 max-w-[150px] truncate">{activity.recipient}</td>
                                        <td className="px-4 py-2 text-sm text-gray-500 max-w-[200px] truncate">{activity.subject || '-'}</td>
                                        <td className="px-4 py-2">
                                            <span className={`px-2 py-1 text-xs rounded-full ${activity.status === 'delivered' ? 'bg-green-100 text-green-800' : activity.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                {activity.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-500">{new Date(activity.created_at).toLocaleString('pt-BR')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="text-gray-500">{t('common.noData')}</p>
                )}
            </div>

            {/* Services Status Card */}
            {servicesStatus && (
                <div className="bg-white shadow rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">{t('services.title', 'Status dos Serviços')}</h3>
                        <Link
                            to="/services"
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                            {t('common.viewDetails', 'Ver detalhes')} →
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-4">
                        {servicesStatus.services?.map((service) => (
                            <div
                                key={service.name}
                                className={`flex items-center space-x-2 px-3 py-2 rounded-full ${service.status === 'online'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                    }`}
                            >
                                <span>{service.status === 'online' ? '✓' : '✗'}</span>
                                <span className="text-sm font-medium">{service.name}</span>
                            </div>
                        ))}
                    </div>
                    {servicesStatus.overall && (
                        <p className={`mt-3 text-sm ${servicesStatus.overall === 'healthy'
                            ? 'text-green-600'
                            : 'text-yellow-600'
                            }`}>
                            {servicesStatus.overall === 'healthy'
                                ? t('services.allServicesOnline', 'Todos os serviços estão online')
                                : t('services.someServicesOffline', 'Alguns serviços apresentam problemas')
                            }
                        </p>
                    )}
                </div>
            )}

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-sm text-blue-700">
                    <strong>{t('dashboard.multiTenantActive')}</strong> {t('dashboard.allFeaturesOperational')}
                </p>
            </div>
        </div>
    )
}

// Tooltip Component
function Tooltip({ children, text }) {
    const [show, setShow] = useState(false)
    return (
        <div className="relative inline-block w-full" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
            {children}
            {show && text && (
                <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg max-w-xs text-center whitespace-normal">
                    {text}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    )
}

function StatsCard({ title, value, subtitle, color, iconPath, tooltip }) {
    const colors = { blue: 'bg-blue-500', red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' }
    return (
        <Tooltip text={tooltip}>
            <div className="bg-white overflow-hidden shadow rounded-lg cursor-help hover:shadow-md transition-shadow">
                <div className="p-5">
                    <div className="flex items-center">
                        <div className={`${colors[color]} rounded-md p-3`}>
                            <svg className="h-6 w-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                                <path d={iconPath || "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"} />
                            </svg>
                        </div>
                        <div className="ml-5 w-0 flex-1">
                            <dl>
                                <dt className="text-sm font-medium text-gray-500 truncate flex items-center gap-1">
                                    {title}
                                    {tooltip && <span className="text-gray-400 text-xs">ⓘ</span>}
                                </dt>
                                <dd className="text-2xl font-semibold text-gray-900">{(Number(value) || 0).toLocaleString()}</dd>
                            </dl>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-50 px-5 py-3">
                    <div className="text-sm text-gray-500">{subtitle}</div>
                </div>
            </div>
        </Tooltip>
    )
}

// Compact AI Stats Card Component with Tooltip
function AIStatCard({ title, value, icon, borderColor, tooltip }) {
    return (
        <Tooltip text={tooltip}>
            <div className={`bg-white rounded-lg shadow-sm p-3 border-l-4 ${borderColor} hover:shadow-md transition-shadow cursor-help`}>
                <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                            {title}
                            {tooltip && <span className="text-gray-400">ⓘ</span>}
                        </p>
                        <p className="text-xl font-bold text-gray-900">{(Number(value) || 0).toLocaleString()}</p>
                    </div>
                    <span className="text-2xl ml-2 flex-shrink-0">{icon}</span>
                </div>
            </div>
        </Tooltip>
    )
}

