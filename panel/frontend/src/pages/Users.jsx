import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Users() {
    const { t } = useTranslation()
    const [users, setUsers] = useState([])
    const [tenants, setTenants] = useState([])
    const [domains, setDomains] = useState([])
    const [selectedTenant, setSelectedTenant] = useState('')
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ email: '', password: '', tenant_id: '', domain_id: '', quota_mb: 1024, status: 'active' })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [selectedTenant])

    const fetchData = async () => {
        try {
            const params = {}
            if (selectedTenant) params.tenant_id = selectedTenant

            const [usersRes, tenantsRes, domainsRes] = await Promise.all([
                api.get('/users', { params }),
                api.get('/tenants'),
                api.get('/domains')
            ])
            setUsers(usersRes.data.data || [])
            setTenants(tenantsRes.data.data || [])
            setDomains(domainsRes.data.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')
        try {
            await api.post('/users', form)
            setShowModal(false)
            setForm({ email: '', password: '', tenant_id: '', domain_id: '', quota_mb: 1024, status: 'active' })
            fetchData()
        } catch (err) {
            setError(err.response?.data?.error?.message || t('users.createFailed', 'Falha ao criar usuário'))
        }
    }

    const handleDelete = async (id) => {
        if (!confirm(t('common.confirmDelete'))) return
        try {
            await api.delete(`/users/${id}`)
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('common.deleteFailed', 'Falha ao excluir'))
        }
    }

    const filteredDomains = domains.filter(d => !form.tenant_id || d.tenant_id === form.tenant_id)

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('users.title')}</h2>
                    <p className="text-sm text-gray-600">{t('users.subtitle')}</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    {t('users.addUser')}
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 shadow rounded-lg flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                    <label className="text-sm font-medium text-gray-700">{t('common.filter')}:</label>
                    <select
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                        <option value="">{t('users.allTenants', 'Todos os Clientes')}</option>
                        {tenants.map(tenant => (
                            <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('users.email')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.tenant')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.domain')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('users.quota')}</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{user.email}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.tenant_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">{user.domain_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {user.status === 'active' ? t('common.active') : t('common.inactive')}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                    {user.used_mb || 0} / {user.quota_mb} MB
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900">{t('common.delete')}</button>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr><td colSpan="6" className="px-6 py-4 text-center text-gray-500">{t('users.noUsers')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">{t('users.addUser')}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.tenant')}</label>
                                <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value, domain_id: '' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                    <option value="">{t('users.selectTenant', 'Selecione o cliente...')}</option>
                                    {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.domain')}</label>
                                <select value={form.domain_id} onChange={(e) => setForm({ ...form, domain_id: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                    <option value="">{t('users.selectDomain', 'Selecione o domínio...')}</option>
                                    {filteredDomains.map(d => <option key={d.id} value={d.id}>{d.domain}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('users.email')}</label>
                                <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="usuario@dominio.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('users.password')}</label>
                                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('users.quota')} (MB)</label>
                                <input type="number" value={form.quota_mb} onChange={(e) => setForm({ ...form, quota_mb: parseInt(e.target.value) })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                            </div>
                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('common.cancel')}</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('common.create')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
