import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — AstralFox',
  description: 'AstralFox privacy policy: data collection, usage, GDPR rights, and data protection',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#09090F] text-gray-300 py-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: 2026-05-29</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">1. Data We Collect</h2>
          <p>To provide the AstralFox desktop pet and marketplace services, we collect:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account data:</strong> email address, username (required for authentication)</li>
            <li><strong>User content:</strong> uploaded images, voice samples, Live2D models, and pet configurations you create</li>
            <li><strong>Usage data:</strong> login timestamps, feature usage, and crash reports for reliability</li>
            <li><strong>Pet interaction logs:</strong> session duration, voice commands (processed locally on your desktop app)</li>
            <li><strong>Payment metadata:</strong> transaction IDs and timestamps (we do NOT store full payment card details)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">2. How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Service delivery:</strong> Authenticate your account, serve your pet configurations, and enable marketplace transactions</li>
            <li><strong>AI features:</strong> Process uploaded images for Live2D model generation (rigging pipeline)</li>
            <li><strong>Improvement:</strong> Aggregate usage analytics to improve performance and reliability</li>
            <li><strong>Security:</strong> Detect and prevent abuse, fraud, and unauthorized access</li>
          </ul>
          <p>We do NOT sell your personal data to third parties. We do NOT use your data for advertising.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Data Storage & Retention</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>User accounts and content are stored on encrypted infrastructure in the EU region</li>
            <li>Pet session logs are retained for 90 days, then automatically purged</li>
            <li>Audit logs are retained for 365 days for security compliance</li>
            <li>Deleted accounts have all personal data removed within 30 days (backups excluded)</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. Your Rights (GDPR & CCPA)</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Access:</strong> Request a copy of all personal data we hold about you</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your account and all associated data</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format (JSON)</li>
            <li><strong>Restriction:</strong> Limit how we process your data</li>
            <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
          </ul>
          <p>To exercise these rights, email <code className="bg-gray-800 px-2 py-0.5 rounded text-purple-400">privacy@astralfox.app</code> or use the data export/delete tools in your account settings.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">5. Cookies</h2>
          <p>We use only essential cookies:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Authentication token:</strong> Stored in browser localStorage, required for login sessions</li>
            <li><strong>Language preference:</strong> Stored in localStorage to remember your interface language</li>
            <li><strong>Cookie consent:</strong> Records your cookie preferences</li>
          </ul>
          <p>We do NOT use tracking cookies, analytics cookies, or advertising cookies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">6. Third-Party Services</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Live2D Cubism SDK:</strong> Loaded from CDN for rendering Live2D models in your browser</li>
            <li><strong>AI Processing:</strong> Image-to-model generation may use GPU cloud infrastructure</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Contact</h2>
          <p>
            Data Protection Officer: <code className="bg-gray-800 px-2 py-0.5 rounded text-purple-400">dpo@astralfox.app</code>
          </p>
        </section>
      </div>
    </main>
  );
}
