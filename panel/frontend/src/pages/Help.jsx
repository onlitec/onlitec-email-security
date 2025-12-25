export default function Help() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">Client Setup Guide</h2>
                <p className="text-sm text-gray-600">Instructions for configuring DNS and email clients</p>
            </div>

            {/* DNS Configuration */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">📧 DNS Configuration</h3>
                <p className="text-gray-600 mb-4">
                    Configure your domain's DNS records to route emails through our protection system.
                </p>

                <div className="space-y-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">1. MX Record (Required)</h4>
                        <p className="text-sm text-gray-600 mb-2">Point your MX to our mail server:</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            @ MX 10 mail.onlitec.com.
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">2. SPF Record (Recommended)</h4>
                        <p className="text-sm text-gray-600 mb-2">Add our server to your SPF:</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            @ TXT "v=spf1 include:_spf.onlitec.com ~all"
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">3. DKIM Record (After Generation)</h4>
                        <p className="text-sm text-gray-600 mb-2">Add the DKIM key generated in the Domains page:</p>
                        <div className="bg-gray-900 text-green-400 p-3 rounded font-mono text-sm overflow-x-auto">
                            default._domainkey TXT "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY"
                        </div>
                    </div>
                </div>
            </div>

            {/* Email Client Config */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">💻 Email Client Configuration</h3>
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                    <p className="text-sm text-green-700">
                        <strong>Good news!</strong> No changes needed in Outlook, Thunderbird, or other email clients.
                    </p>
                </div>
                <p className="text-gray-600 mb-4">
                    Clients continue using their original IMAP/SMTP settings (e.g., from Hostgator).
                    Our system only filters incoming mail - it's transparent to end users.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">IMAP (Receiving)</h4>
                        <p className="text-sm text-gray-600">Use your hosting provider's IMAP server as usual</p>
                        <div className="mt-2 text-sm font-mono text-gray-700">
                            Server: mail.yourdomain.com<br />
                            Port: 993 (SSL)
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-2">SMTP (Sending)</h4>
                        <p className="text-sm text-gray-600">Use your hosting provider's SMTP server as usual</p>
                        <div className="mt-2 text-sm font-mono text-gray-700">
                            Server: mail.yourdomain.com<br />
                            Port: 465 (SSL) or 587 (TLS)
                        </div>
                    </div>
                </div>
            </div>

            {/* How it works */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🔄 How It Works</h3>
                <div className="space-y-3">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">1</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">External email arrives</p>
                            <p className="text-sm text-gray-600">Email is sent to your domain's MX (mail.onlitec.com)</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">2</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">Spam & virus filtering</p>
                            <p className="text-sm text-gray-600">Email is analyzed by Rspamd and ClamAV</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">3</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">Relay to destination</p>
                            <p className="text-sm text-gray-600">Clean emails are forwarded to your hosting server (Hostgator, etc.)</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-medium">4</div>
                        <div className="ml-4">
                            <p className="text-gray-900 font-medium">User receives email</p>
                            <p className="text-sm text-gray-600">Email appears in Outlook/Thunderbird as normal</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hostgator Specific */}
            <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">🌐 Hostgator Setup</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                    <li>Login to cPanel</li>
                    <li>Go to <strong>Zone Editor</strong></li>
                    <li>Find your domain and click <strong>Manage</strong></li>
                    <li>Delete existing MX records</li>
                    <li>Add new MX record: <code className="bg-gray-100 px-1 rounded">mail.onlitec.com</code> with priority 10</li>
                    <li>Save changes</li>
                </ol>
                <p className="mt-4 text-sm text-gray-500">
                    Changes may take up to 24-48 hours to propagate globally.
                </p>
            </div>
        </div>
    )
}
