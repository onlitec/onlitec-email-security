import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../api'

export default function Reports() {
    const { t } = useTranslation()
    const [loading, setLoading] = useState(false)
    const [startDate, setStartDate] = useState(getThirtyDaysAgo())
    const [endDate, setEndDate] = useState(getToday())
    const [email, setEmail] = useState('')
    const [options, setOptions] = useState({
        includeVirus: false,
        includeSpam: false,
        includeSenders: false,
        includeDomains: false
    })
    const [message, setMessage] = useState({ type: '', text: '' })

    function getToday() {
        return new Date().toISOString().split('T')[0]
    }

    function getThirtyDaysAgo() {
        const date = new Date()
        date.setDate(date.getDate() - 30)
        return date.toISOString().split('T')[0]
    }

    const handleOptionChange = (e) => {
        const { name, checked } = e.target
        setOptions(prev => ({ ...prev, [name]: checked }))
    }

    const handleDownload = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage({ type: '', text: '' })
        try {
            const response = await api.post('/reports', {
                startDate,
                endDate,
                options
            }, {
                responseType: 'blob'
            })

            const url = window.URL.createObjectURL(new Blob([response.data]))
            const link = document.createElement('a')
            link.href = url
            link.setAttribute('download', `report-${startDate}-${endDate}.pdf`)
            document.body.appendChild(link)
            link.click()
            link.remove()
        } catch (error) {
            console.error('Error downloading report:', error)
            setMessage({ type: 'error', text: 'Erro ao gerar relatório.' })
        } finally {
            setLoading(false)
        }
    }

    const handleEmail = async (e) => {
        e.preventDefault()
        if (!email) {
            setMessage({ type: 'error', text: 'Por favor, informe um email.' })
            return
        }
        setLoading(true)
        setMessage({ type: '', text: '' })
        try {
            await api.post('/reports/email', {
                startDate,
                endDate,
                email,
                options
            })
            setMessage({ type: 'success', text: 'Relatório enviado com sucesso!' })
        } catch (error) {
            console.error('Error sending report:', error)
            setMessage({ type: 'error', text: 'Erro ao enviar relatório.' })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white shadow px-4 py-5 sm:rounded-lg sm:p-6">
                <div className="md:grid md:grid-cols-3 md:gap-6">
                    <div className="md:col-span-1">
                        <h3 className="text-lg font-medium leading-6 text-gray-900">Relatórios</h3>
                        <p className="mt-1 text-sm text-gray-500">
                            Gere relatórios detalhados sobre o tráfego de emails e ameaças detectadas.
                        </p>
                    </div>
                    <div className="mt-5 md:mt-0 md:col-span-2">
                        <form className="space-y-6">
                            <div className="grid grid-cols-6 gap-6">
                                <div className="col-span-6 sm:col-span-3">
                                    <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                                        Data Inicial
                                    </label>
                                    <input
                                        type="date"
                                        name="start_date"
                                        id="start_date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>

                                <div className="col-span-6 sm:col-span-3">
                                    <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                                        Data Final
                                    </label>
                                    <input
                                        type="date"
                                        name="end_date"
                                        id="end_date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                                    />
                                </div>

                                <div className="col-span-6">
                                    <fieldset>
                                        <legend className="text-base font-medium text-gray-900">Detalhes do Relatório</legend>
                                        <div className="mt-4 space-y-4">
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="includeVirus"
                                                        name="includeVirus"
                                                        type="checkbox"
                                                        checked={options.includeVirus}
                                                        onChange={handleOptionChange}
                                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="includeVirus" className="font-medium text-gray-700">Detalhes de Vírus</label>
                                                    <p className="text-gray-500">Incluir lista das principais ameaças detectadas.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="includeSpam"
                                                        name="includeSpam"
                                                        type="checkbox"
                                                        checked={options.includeSpam}
                                                        onChange={handleOptionChange}
                                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="includeSpam" className="font-medium text-gray-700">Detalhes de Spam</label>
                                                    <p className="text-gray-500">Incluir lista dos principais emissores de spam bloqueados.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="includeSenders"
                                                        name="includeSenders"
                                                        type="checkbox"
                                                        checked={options.includeSenders}
                                                        onChange={handleOptionChange}
                                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="includeSenders" className="font-medium text-gray-700">Relatório de Remetentes</label>
                                                    <p className="text-gray-500">Listar os remetentes com maior volume de envio.</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start">
                                                <div className="flex items-center h-5">
                                                    <input
                                                        id="includeDomains"
                                                        name="includeDomains"
                                                        type="checkbox"
                                                        checked={options.includeDomains}
                                                        onChange={handleOptionChange}
                                                        className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                                                    />
                                                </div>
                                                <div className="ml-3 text-sm">
                                                    <label htmlFor="includeDomains" className="font-medium text-gray-700">Relatório de Domínios</label>
                                                    <p className="text-gray-500">Listar os domínios com maior volume de tráfego.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </fieldset>
                                </div>

                                <div className="col-span-6">
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                        Email para envio (opcional)
                                    </label>
                                    <div className="mt-1 flex rounded-md shadow-sm">
                                        <input
                                            type="email"
                                            name="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="focus:ring-blue-500 focus:border-blue-500 flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-gray-300"
                                            placeholder="seu@email.com"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleEmail}
                                            disabled={loading}
                                            className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm hover:text-gray-700"
                                        >
                                            {loading ? 'Enviando...' : 'Enviar por Email'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={loading}
                                    className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                >
                                    {loading ? 'Gerando...' : 'Baixar PDF'}
                                </button>
                            </div>
                        </form>

                        {message.text && (
                            <div className={`mt-4 p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
