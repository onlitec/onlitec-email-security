import { useTranslation } from 'react-i18next'

export default function Help() {
    const { t } = useTranslation()

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">{t('help.title')}</h2>
                <p className="text-sm text-gray-600">{t('help.subtitle')}</p>
            </div>

            {/* DNS Configuration */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">📧 {t('help.dnsConfig')}</h3>
                <p className="text-gray-600 mb-4">
                    {t('help.dnsConfigDesc')}
                </p>

                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">1. {t('help.mxRecord')}</h4>
                        <p className="text-sm text-gray-600 mb-2">{t('help.mxRecordDesc')}</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            @ MX 10 mail.onlitec.com.
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">2. {t('help.spfRecord')}</h4>
                        <p className="text-sm text-gray-600 mb-2">{t('help.spfRecordDesc')}</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            @ TXT "v=spf1 include:_spf.onlitec.com ~all"
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">3. {t('help.dkimRecord')}</h4>
                        <p className="text-sm text-gray-600 mb-2">{t('help.dkimRecordDesc')}</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            default._domainkey TXT "v=DKIM1; k=rsa; p=SUA_CHAVE_PUBLICA"
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Client Config */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">💻 {t('help.emailClient')}</h3>
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                    <p className="text-sm text-green-700">
                        <strong>{t('help.noChangesNeeded')}</strong> {t('help.noChangesDesc')}
                    </p>
                </div>
                <p className="text-gray-600 mb-4">
                    {t('help.clientContinue')}
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{t('help.receiving')}</h4>
                        <p className="text-sm text-gray-600">{t('help.imapDesc', 'Use o servidor IMAP da sua hospedagem normalmente')}</p>
                        <div className="mt-2 text-sm font-mono text-gray-700">
                            Servidor: mail.seudominio.com<br />
                            Porta: 993 (SSL)
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">{t('help.sending')}</h4>
                        <p className="text-sm text-gray-600">{t('help.smtpDesc', 'Use o servidor SMTP da sua hospedagem normalmente')}</p>
                        <div className="mt-2 text-sm font-mono text-gray-700">
                            Servidor: mail.seudominio.com<br />
                            Porta: 465 (SSL) ou 587 (TLS)
                        </div>
                    </div>
                </div>
            </div>

            {/* How it works */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🔄 {t('help.howItWorks')}</h3>
                <div className="space-y-3">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">1</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">{t('help.step1')}</p>
                            <p className="text-sm text-gray-600">{t('help.step1Desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">2</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">{t('help.step2')}</p>
                            <p className="text-sm text-gray-600">{t('help.step2Desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">3</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">{t('help.step3')}</p>
                            <p className="text-sm text-gray-600">{t('help.step3Desc')}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium">4</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">{t('help.step4')}</p>
                            <p className="text-sm text-gray-600">{t('help.step4Desc')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hostgator Specific */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🌐 {t('help.hostgatorSetup')}</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>{t('help.hostgator1', 'Faça login no cPanel')}</li>
                    <li>{t('help.hostgator2', 'Vá para')} <strong>Zone Editor</strong></li>
                    <li>{t('help.hostgator3', 'Encontre seu domínio e clique em')} <strong>{t('help.hostgator3action', 'Gerenciar')}</strong></li>
                    <li>{t('help.hostgator4', 'Exclua os registros MX existentes')}</li>
                    <li>{t('help.hostgator5', 'Adicione novo registro MX:')} <code className="bg-gray-100 px-1 rounded">mail.onlitec.com</code> {t('help.hostgator5priority', 'com prioridade 10')}</li>
                    <li>{t('help.hostgator6', 'Salve as alterações')}</li>
                </ol>
                <p className="mt-4 text-sm text-gray-500">
                    {t('help.propagationNote')}
                </p>
            </div>
        </div>
    )
}
