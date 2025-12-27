import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Domains() {
    const { t } = useTranslation()
    const [domains, setDomains] = useState([])
    const [tenants, setTenants] = useState([])
    const [loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [showDkimModal, setShowDkimModal] = useState(false)
    const [selectedDomain, setSelectedDomain] = useState(null)
    const [dkimData, setDkimData] = useState(null)
    const [verifying, setVerifying] = useState(null)
    const [form, setForm] = useState({
        domain: '', tenant_id: '', status: 'pending',
        relay_host: '', relay_port: 25, relay_username: '', relay_password: '', relay_use_tls: true
    })
    const [error, setError] = useState('')

    useEffect(() => { fetchData() }, [])

    const fetchData = async () => {
        try {
            const [domainsRes, tenantsRes] = await Promise.all([
                api.get('/domains'),
                api.get('/tenants')
            ])
            setDomains(domainsRes.data.data || [])
            setTenants(tenantsRes.data.data || [])
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
            if (selectedDomain) {
                await api.put(`/domains/${selectedDomain.id}`, form)
            } else {
                await api.post('/domains', form)
            }
            setShowModal(false)
            resetForm()
            fetchData()
        } catch (err) {
            setError(err.response?.data?.error?.message || t('common.saveFailed', 'Falha ao salvar'))
        }
    }

    const resetForm = () => {
        setSelectedDomain(null)
        setForm({ domain: '', tenant_id: '', status: 'pending', relay_host: '', relay_port: 25, relay_username: '', relay_password: '', relay_use_tls: true })
    }

    const handleEdit = (domain) => {
        setSelectedDomain(domain)
        setForm({
            domain: domain.domain,
            tenant_id: domain.tenant_id,
            status: domain.status,
            relay_host: domain.relay_host || '',
            relay_port: domain.relay_port || 25,
            relay_username: domain.relay_username || '',
            relay_password: domain.relay_password || '',
            relay_use_tls: domain.relay_use_tls !== false
        })
        setShowModal(true)
    }

    const handleDelete = async (id) => {
        if (!confirm(t('common.confirmDelete'))) return
        try {
            await api.delete(`/domains/${id}`)
            fetchData()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('common.deleteFailed', 'Falha ao excluir'))
        }
    }

    const handleGenerateDkim = async (domain) => {
        try {
            const { data } = await api.post(`/domains/${domain.id}/generate-dkim`)
            if (data.success) {
                setDkimData(data.data)
                setSelectedDomain(domain)
                setShowDkimModal(true)
                fetchData()
            }
        } catch (err) {
            alert(err.response?.data?.error?.message || t('domains.dkimFailed', 'Falha ao gerar DKIM'))
        }
    }

    const handleVerifyDns = async (domain) => {
        setVerifying(domain.id)
        try {
            const { data } = await api.post(`/domains/${domain.id}/verify-dns`)
            if (data.success) {
                alert(`${t('domains.dnsVerification', 'Verificação DNS')}:\n\nMX: ${data.data.verification.mx ? '✓' : '✗'}\nSPF: ${data.data.verification.spf ? '✓' : '✗'}\nDKIM: ${data.data.verification.dkim ? '✓' : '✗'}`)
                fetchData()
            }
        } catch (err) {
            alert(err.response?.data?.error?.message || t('domains.verifyFailed', 'Falha na verificação DNS'))
        } finally {
            setVerifying(null)
        }
    }

    const StatusBadge = ({ verified, label }) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs rounded ${verified ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
            {verified ? '✓' : '✗'} {label}
        </span>
    )

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('domains.title')}</h2>
                    <p className="text-sm text-gray-600">{t('domains.subtitle')}</p>
                </div>
                <button onClick={() => { resetForm(); setShowModal(true) }} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                    {t('domains.addDomain')}
                </button>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.domain')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.tenant')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('common.status')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.relay')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('domains.dkim')}</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {domains.map((domain) => (
                            <tr key={domain.id}>
                                <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{domain.domain}</td>
                                <td className="px-4 py-4 whitespace-nowrap text-gray-500">{domain.tenant_name}</td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    <span className={`px-2 py-1 text-xs rounded-full ${domain.status === 'active' ? 'bg-green-100 text-green-800' : domain.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                        {domain.status === 'active' ? t('common.active') : domain.status === 'pending' ? t('common.pending') : t('common.inactive')}
                                    </span>
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-sm">
                                    {domain.relay_host ? (
                                        <span className="text-green-600">{domain.relay_host}:{domain.relay_port}</span>
                                    ) : (
                                        <span className="text-gray-400">{t('domains.notConfigured')}</span>
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap">
                                    {domain.dkim_public_key ? (
                                        <StatusBadge verified={true} label={t('domains.configured')} />
                                    ) : (
                                        <StatusBadge verified={false} label={t('domains.notSet', 'Não definido')} />
                                    )}
                                </td>
                                <td className="px-4 py-4 whitespace-nowrap text-right text-sm space-x-1">
                                    <button onClick={() => handleEdit(domain)} className="text-blue-600 hover:text-blue-900">{t('common.edit')}</button>
                                    <button onClick={() => handleGenerateDkim(domain)} className="text-purple-600 hover:text-purple-900">{t('domains.dkim')}</button>
                                    <button onClick={() => handleVerifyDns(domain)} disabled={verifying === domain.id} className="text-green-600 hover:text-green-900 disabled:opacity-50">
                                        {verifying === domain.id ? '...' : t('domains.verifyDns')}
                                    </button>
                                    <button onClick={() => handleDelete(domain.id)} className="text-red-600 hover:text-red-900">{t('common.delete')}</button>
                                </td>
                            </tr>
                        ))}
                        {domains.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-4 text-center text-gray-500">{t('domains.noDomains')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Domain Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <h3 className="text-lg font-medium mb-4">{selectedDomain ? t('domains.editDomain') : t('domains.addDomain')}</h3>
                        {error && <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">{error}</div>}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.domain')}</label>
                                <input type="text" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}
                                    placeholder="exemplo.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required disabled={!!selectedDomain} />
                            </div>
                            {!selectedDomain && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('domains.tenant')}</label>
                                    <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" required>
                                        <option value="">{t('users.selectTenant', 'Selecione o cliente...')}</option>
                                        {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('common.status')}</label>
                                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                                    <option value="pending">{t('common.pending')}</option>
                                    <option value="active">{t('common.active')}</option>
                                    <option value="inactive">{t('common.inactive')}</option>
                                </select>
                            </div>

                            <hr className="my-4" />
                            <h4 className="font-medium text-gray-900">{t('domains.relayConfig')}</h4>
                            <p className="text-xs text-gray-500 mb-2">{t('domains.relayConfigHelp')}</p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">{t('domains.relayHost')}</label>
                                    <input type="text" value={form.relay_host} onChange={(e) => setForm({ ...form, relay_host: e.target.value })}
                                        placeholder="mail.exemplo.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('domains.relayPort')}</label>
                                    <input type="number" value={form.relay_port} onChange={(e) => setForm({ ...form, relay_port: parseInt(e.target.value) })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div className="flex items-center pt-6">
                                    <input type="checkbox" checked={form.relay_use_tls} onChange={(e) => setForm({ ...form, relay_use_tls: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
                                    <label className="ml-2 text-sm text-gray-700">{t('domains.useTls')}</label>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('domains.relayUsername')}</label>
                                    <input type="text" value={form.relay_username} onChange={(e) => setForm({ ...form, relay_username: e.target.value })}
                                        placeholder="usuario@exemplo.com" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">{t('domains.relayPassword')}</label>
                                    <input type="password" value={form.relay_password} onChange={(e) => setForm({ ...form, relay_password: e.target.value })}
                                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md">{t('common.cancel')}</button>
                                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('common.save')}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DKIM Modal */}
            {showDkimModal && dkimData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                        <h3 className="text-lg font-medium mb-4">{t('domains.dkimGenerated')}</h3>
                        <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                            <p className="text-sm text-green-700">
                                <strong>{t('domains.addDnsRecord')}</strong>
                            </p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.recordType')}</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">{dkimData.dnsRecord.type}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.recordName')}</label>
                                <div className="mt-1 p-2 bg-gray-50 rounded font-mono text-sm">{dkimData.dnsRecord.name}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">{t('domains.recordValue')}</label>
                                <textarea className="mt-1 w-full p-2 bg-gray-50 rounded font-mono text-xs h-24" readOnly value={dkimData.dnsRecord.value} />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button onClick={() => { setShowDkimModal(false); setDkimData(null) }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{t('common.done', 'Concluído')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
