import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Aliases() {
    const { t } = useTranslation()
    const [aliases, setAliases] = useState([])
    const [tenants, setTenants] = useState([])
    const [domains, setDomains] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [form, setForm] = useState({ email: '', destination: '', tenant_id: '', domain_id: '', is_catch_all: false })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [aliasesRes, tenantsRes, domainsRes] = await Promise.all([
                api.get('/aliases'),
                api.get('/tenants'),
                api.get('/domains')
            ])
            setAliases(aliasesRes.data.data || [])
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
            await api.post('/aliases', form)
            setShowModal(false)
            setForm({ email: '', destination: '', tenant_id: '', domain_id: '', is_catch_all: false })
            fetchData()
        } catch (err) {
            setError(err.response?.data?.error?.message || t('aliases.createFailed', 'Falha ao criar alias'))
        }
    }

    const toggleEnabled = async (alias) => {
        try {
            await api.put(`/aliases/${alias.id}`, { enabled: !alias.enabled })
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('aliases.updateFailed', 'Falha ao atualizar'))
        }
    }

    const handleDelete = async (id) => {
        if (!confirm(t('common.confirmDelete'))) return
        try {
            await api.delete(`/aliases/${id}`)
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
                    <h2 className="text-2xl font-bold text-gray-900">{t('aliases.title')}</h2>
                    <p className="text-sm text-gray-600">{t('aliases.subtitle')}</p>
                </div>
                <button onClick={() => setShowModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    {t('aliases.addAlias')}
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('aliases.email')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('aliases.destination')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.domain')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('quarantine.type')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {aliases.map((alias) => (
                            <tr key={alias.id}>
                                <td className="px-4 py-4 font-medium text-gray-900">{alias.email}</td>
                                <td className="px-4 py-4 text-gray-500">{alias.destination}</td>
                                <td className="px-4 py-4 text-gray-500">{alias.domain_name}</td>
                                <td className="px-4 py-4">
                                    <span className={`px-2 py-1 text-xs rounded-full ${alias.is_catch_all ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {alias.is_catch_all ? t('aliases.catchAll') : t('aliases.forward')}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <button onClick={() => toggleEnabled(alias)}
                                        className={`px-2 py-1 text-xs rounded-full ${alias.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                        {alias.enabled ? t('common.active') : t('common.disabled')}
                                    </button>
                                </td>
                                <td className="px-4 py-4 text-right">
                                    <button onClick={() => handleDelete(alias.id)} className="text-red-600 hover:text-red-900">{t('common.delete')}</button>
                                </td>
                            </tr>
                        ))}
                        {aliases.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-4 text-center text-gray-500">{t('aliases.noAliases')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">{t('aliases.addAlias')}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.tenant')}</label>
                                <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value, domain_id: '' })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                    <option value="">{t('users.selectTenant', 'Selecione o inquilino...')}</option>
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
                                <label className="block text-sm font-medium text-gray-700">{t('aliases.email')}</label>
                                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="alias@dominio.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('aliases.destination')}</label>
                                <input type="text" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}
                                    placeholder="real@email.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required />
                            </div>
                            <div className="flex items-center">
                                <input type="checkbox" checked={form.is_catch_all} onChange={(e) => setForm({ ...form, is_catch_all: e.target.checked })}
                                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                <label className="ml-2 text-sm text-gray-700">{t('aliases.catchAllHelp')}</label>
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
