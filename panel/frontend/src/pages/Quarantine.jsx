import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Quarantine() {
    const { t } = useTranslation()
    const [emails, setEmails] = useState([])
    const [loading, setLoading] = useState(true)
    const [selected, setSelected] = useState([])
    const [filter, setFilter] = useState({ search: '', type: '', status: 'quarantined' })

    useEffect(() => { fetchEmails() }, [filter])

    const fetchEmails = async () => {
        try {
            const params = new URLSearchParams(filter).toString()
            const { data } = await api.get(`/quarantine?${params}`)
            setEmails(data.data || [])
        } catch (err) {
            console.error('Error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleRelease = async (id) => {
        if (!confirm(t('quarantine.confirmRelease', 'Liberar este email?'))) return
        try {
            await api.post(`/quarantine/${id}/release`)
            fetchEmails()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('quarantine.releaseFailed', 'Falha ao liberar'))
        }
    }

    const handleDelete = async (id) => {
        if (!confirm(t('quarantine.confirmDelete', 'Excluir este email permanentemente?'))) return
        try {
            await api.delete(`/quarantine/${id}`)
            fetchEmails()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('quarantine.deleteFailed', 'Falha ao excluir'))
        }
    }

    const handleBulkRelease = async () => {
        if (selected.length === 0) return
        if (!confirm(t('quarantine.confirmBulkRelease', `Liberar ${selected.length} emails?`))) return
        try {
            await api.post('/quarantine/bulk-release', { ids: selected })
            setSelected([])
            fetchEmails()
        } catch (err) {
            alert(err.response?.data?.error?.message || t('quarantine.releaseFailed', 'Falha ao liberar'))
        }
    }

    const toggleSelect = (id) => {
        setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
    }

    const formatDate = (date) => new Date(date).toLocaleString('pt-BR')

    if (loading) return <div className="text-center py-12">{t('common.loading')}</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{t('quarantine.title')}</h2>
                    <p className="text-sm text-gray-600">{t('quarantine.subtitle')}</p>
                </div>
                {selected.length > 0 && (
                    <button onClick={handleBulkRelease} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                        {t('quarantine.releaseSelected')} ({selected.length})
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg shadow p-4 flex gap-4">
                <input type="text" placeholder={t('common.search')} value={filter.search}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                <select value={filter.type} onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="">{t('quarantine.allTypes', 'Todos os Tipos')}</option>
                    <option value="spam">Spam</option>
                    <option value="virus">{t('dashboard.virus')}</option>
                    <option value="policy">{t('quarantine.policy', 'Política')}</option>
                </select>
                <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                    className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="quarantined">{t('quarantine.statusQuarantined', 'Em Quarentena')}</option>
                    <option value="released">{t('quarantine.statusReleased', 'Liberados')}</option>
                    <option value="">{t('quarantine.statusAll', 'Todos')}</option>
                </select>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? emails.map(e => e.id) : [])} /></th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.from')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.to')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.subject')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('quarantine.reason', 'Motivo')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('quarantine.score')}</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('dashboard.date')}</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">{t('common.actions')}</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {emails.map((email) => (
                            <tr key={email.id} className={selected.includes(email.id) ? 'bg-blue-50' : ''}>
                                <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(email.id)} onChange={() => toggleSelect(email.id)} /></td>
                                <td className="px-4 py-3 text-sm text-gray-900 max-w-[150px] truncate">{email.sender}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-[150px] truncate">{email.recipient}</td>
                                <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">{email.subject}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 text-xs rounded-full ${email.quarantine_type === 'spam' ? 'bg-yellow-100 text-yellow-800' : email.quarantine_type === 'virus' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {email.quarantine_type || email.reason}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">{email.score !== null ? Number(email.score).toFixed(1) : '-'}</td>
                                <td className="px-4 py-3 text-sm text-gray-500">{formatDate(email.created_at)}</td>
                                <td className="px-4 py-3 text-right text-sm space-x-2">
                                    {email.status === 'quarantined' && (
                                        <button onClick={() => handleRelease(email.id)} className="text-green-600 hover:text-green-900">{t('quarantine.release')}</button>
                                    )}
                                    <button onClick={() => handleDelete(email.id)} className="text-red-600 hover:text-red-900">{t('common.delete')}</button>
                                </td>
                            </tr>
                        ))}
                        {emails.length === 0 && (
                            <tr><td colSpan="8" className="px-4 py-8 text-center text-gray-500">{t('quarantine.noEmails')}</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
