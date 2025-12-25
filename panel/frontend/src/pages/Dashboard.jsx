import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../api'

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#10B981']

export default function Dashboard() {
    const { t } = useTranslation()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => { fetchStats() }, [])

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

            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <StatsCard title={t('dashboard.emailsToday')} value={stats?.emailsToday || 0} subtitle={t('dashboard.last24h')} color="blue" />
                <StatsCard title={t('dashboard.spamBlocked')} value={stats?.spamBlocked || 0} subtitle={t('dashboard.today')} color="red" />
                <StatsCard title={t('dashboard.virusDetected')} value={stats?.virusDetected || 0} subtitle={t('dashboard.thisWeek')} color="yellow" />
                <StatsCard title={t('dashboard.activeTenants')} value={stats?.activeTenants || 0} subtitle={t('dashboard.total')} color="green" />
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <StatsCard title={t('dashboard.totalDomains')} value={stats?.totalDomains || 0} subtitle={t('dashboard.configured')} color="blue" />
                <StatsCard title={t('dashboard.totalUsers')} value={stats?.totalUsers || 0} subtitle={t('dashboard.emailAccounts')} color="green" />
                <StatsCard title={t('dashboard.quarantined')} value={stats?.quarantinedEmails || 0} subtitle={t('dashboard.pendingReview')} color="yellow" />
            </div>

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
                                <Tooltip />
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
                                <Tooltip />
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
                                <Tooltip />
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

            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <p className="text-sm text-blue-700">
                    <strong>{t('dashboard.multiTenantActive')}</strong> {t('dashboard.allFeaturesOperational')}
                </p>
            </div>
        </div>
    )
}

function StatsCard({ title, value, subtitle, color }) {
    const colors = { blue: 'bg-blue-500', red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' }
    return (
        <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
                <div className="flex items-center">
                    <div className={`${colors[color]} rounded-md p-3`}>
                        <svg className="h-6 w-6 text-white" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                        <dl>
                            <dt className="text-sm font-medium text-gray-500 truncate">{title}</dt>
                            <dd className="text-2xl font-semibold text-gray-900">{value.toLocaleString()}</dd>
                        </dl>
                    </div>
                </div>
            </div>
            <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm text-gray-500">{subtitle}</div>
            </div>
        </div>
    )
}
