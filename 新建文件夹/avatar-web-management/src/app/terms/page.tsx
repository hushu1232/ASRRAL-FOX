import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service — AstralFox',
  description: 'AstralFox terms of service: usage rules, content ownership, marketplace policies',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#09090F] text-gray-300 py-20 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: 2026-05-29</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">1. Acceptance</h2>
          <p>
            By using AstralFox (&quot;the Service&quot;), you agree to these Terms of Service.
            If you do not agree, do not use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">2. Eligibility</h2>
          <p>You must be at least 13 years old to use the Service. If you are under 18, you must have parental consent.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">3. Account</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>You must provide accurate registration information</li>
            <li>One person per account — shared accounts are prohibited</li>
            <li>We reserve the right to suspend accounts that violate these terms</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">4. User Content & Ownership</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>You retain full ownership of content you upload (images, voice samples, Live2D models, pet configurations)</li>
            <li>You grant us a limited license to host and serve your content for the purpose of providing the Service</li>
            <li>You must own or have rights to all content you upload</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">5. Marketplace Rules</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>All marketplace listings must be your original work or properly licensed</li>
            <li>Prohibited content: NSFW, copyrighted material without license, malware, deceptive listings</li>
            <li>Transaction disputes are handled per our marketplace dispute resolution process</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">6. Acceptable Use</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Reverse engineer, decompile, or extract the Service source code</li>
            <li>Use the Service for illegal activities or to distribute malware</li>
            <li>Bypass rate limits or attempt unauthorized API access</li>
            <li>Upload content that infringes intellectual property rights</li>
            <li>Use AI-generated models to impersonate real individuals without consent</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">7. Service Availability</h2>
          <p>
            We strive for 99.9% uptime but do not guarantee uninterrupted service.
            Scheduled maintenance is announced in advance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">8. Limitation of Liability</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranty. We are not liable for damages
            arising from use or inability to use the Service, to the extent permitted by law.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">9. Termination</h2>
          <p>
            You may delete your account at any time via Settings. We may terminate accounts
            for violation of these terms with 7 days notice where possible.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-white">10. Changes</h2>
          <p>
            We will notify users of material changes to these terms via email at least 14 days
            before they take effect.
          </p>
        </section>
      </div>
    </main>
  );
}
