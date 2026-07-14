import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — MarkReady",
};

const EFFECTIVE_DATE = "July 14, 2026";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <header className="border-b border-[#E4DFD3] bg-[#FAF8F3]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-[#23282B]">
            MarkReady
          </Link>
          <Link href="/login" className="text-sm text-[#1F5C4E] hover:text-[#154136]">
            Sign in
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="font-serif text-3xl font-semibold text-[#23282B] mb-2">
          Privacy Policy
        </h1>
        <p className="text-sm text-[#5B6266] mb-8">Effective date: {EFFECTIVE_DATE}</p>

        <div className="space-y-8 text-[#23282B] text-[15px] leading-relaxed">
          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">1. What we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Account information:</strong> your email address, used to sign in and
                identify your account.
              </li>
              <li>
                <strong>Your submissions:</strong> the writing-task questions, essays, and
                (for Task 1 Academic) chart images you submit, together with the AI-generated
                scores and feedback. These are stored so you can review your history and
                track progress.
              </li>
              <li>
                <strong>Usage data:</strong> timestamps of your evaluations, used to enforce
                the daily evaluation limit and prevent abuse.
              </li>
              <li>
                <strong>Cookies:</strong> essential authentication cookies only, used to keep
                you signed in. We do not use advertising or analytics tracking cookies.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">2. How we use your data</h2>
            <p>
              We use your data solely to provide the service: scoring your writing, showing
              your progress dashboard, keeping you signed in, and enforcing fair-use limits.
              We do not sell your data, show ads, or use your data for marketing.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">
              3. Who processes your data
            </h2>
            <p className="mb-2">
              MarkReady runs on trusted third-party infrastructure. Your data is processed
              by:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Supabase</strong> — authentication and database hosting (your account
                and stored submissions).
              </li>
              <li>
                <strong>Vercel</strong> — application hosting.
              </li>
              <li>
                <strong>AI model providers (via OpenRouter)</strong> — when you request a
                score, the text of your question and essay (and any chart image) is sent to
                an AI language model to generate the evaluation. It is used to produce your
                feedback, not to build advertising profiles.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">4. Retention and deletion</h2>
            <p>
              Your submissions and scores are kept while your account exists so your progress
              history works. You can request deletion of individual submissions or your
              entire account at any time by emailing us (see Contact below); we will delete
              the data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">5. Your rights</h2>
            <p>
              Depending on where you live, you may have the right to access, correct, export,
              or delete your personal data. To exercise any of these rights, email us at the
              address below and we will respond within 30 days.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">6. Security</h2>
            <p>
              Your data is stored with row-level access controls so that only your own
              account can read your submissions. Connections to the service are encrypted
              with HTTPS.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">7. Trademark notice</h2>
            <p>
              IELTS™ is a registered trademark of the British Council, IDP: IELTS Australia,
              and Cambridge University Press &amp; Assessment. MarkReady is an independent
              study tool and is not affiliated with, endorsed by, or connected to any
              official examination body.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">8. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected
              by updating the effective date above.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-xl font-semibold mb-2">9. Contact</h2>
            <p>
              Privacy questions or data requests? Use the feedback link inside the app after
              signing in.
            </p>
          </section>
        </div>

        <footer className="mt-12 pt-6 border-t border-[#E4DFD3] text-sm text-[#5B6266] flex gap-4">
          <Link href="/terms" className="hover:text-[#23282B] underline">
            Terms of Service
          </Link>
          <Link href="/login" className="hover:text-[#23282B] underline">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
