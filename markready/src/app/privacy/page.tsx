import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — MarkReady",
  description: "Our privacy policy describes what data we collect, how we use it, and your rights.",
};

// Rewritten product-specific privacy policy, accurate as of September 2026.
// Discloses essays and chart images are sent to OpenRouter for AI scoring.
type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };
type Section = { heading: string | null; blocks: Block[] };

const p = (text: string): Block => ({ type: "p", text });
const ul = (...items: string[]): Block => ({ type: "ul", items });

const SECTIONS: Section[] = [
  {
    heading: null,
    blocks: [
      p(`MarkReady ("we", "us", "our") provides AI-powered writing feedback for IELTS exams. This Privacy Policy describes what personal information we collect, how we use it, and your rights regarding it.`),
      p(`By using our service, you agree to this Privacy Policy. If you do not agree, please do not use our service.`),
    ],
  },
  {
    heading: "Information We Collect",
    blocks: [
      p(`We collect the following information from you:`),
      ul(
        `Email address and authentication method (password sign-in, Google OAuth, or email magic link)`,
        `Essays and prompts you submit for scoring`,
        `Chart images you upload for Task 1 Academic feedback`,
        `Band scores we generate and your target band`,
        `Referral source and any stated interest in upgrading`,
        `A ban flag if you violate our terms`,
      ),
    ],
  },
  {
    heading: "LLM Subprocessor: How We Score Your Work",
    blocks: [
      p(`Your essays and uploaded chart images are transmitted to OpenRouter and the underlying AI model provider (currently Anthropic) for scoring analysis.`),
      p(`OpenRouter and the model provider process your submissions to generate band estimates, criterion feedback, and rewrites. They may retain logs for debugging and safety purposes per their own policies. We do not control their retention or secondary use.`),
    ],
  },
  {
    heading: "Other Subprocessors",
    blocks: [
      ul(
        `Supabase: stores your account, essays, and scores in a PostgreSQL database and provides authentication`,
        `Vercel: hosts this application`,
      ),
    ],
  },
  {
    heading: "Cookies and Pixels",
    blocks: [
      p(`We currently use essential authentication cookies only. We may in future use analytics and marketing pixels (e.g., Plausible) to understand usage. A consent mechanism for non-essential cookies will be introduced before any such tracking begins.`),
    ],
  },
  {
    heading: "How We Use Your Information",
    blocks: [
      ul(
        `Provide scores, feedback, and rewrites`,
        `Send you important account and service emails`,
        `Enforce our no-refunds policy and scoring quota`,
        `Prevent fraud and abuse`,
      ),
    ],
  },
  {
    heading: "Mark Packs and Refunds",
    blocks: [
      p(`One mark = one submission scored. You receive 2 free marks lifetime plus 1 free mark per calendar day. Mark packs cost $20 USD for 20 marks, expiring 30 days after purchase.`),
      p(`MarkReady does not offer refunds. See our Refund Policy for details.`),
    ],
  },
  {
    heading: "Important Disclaimers",
    blocks: [
      p(`IELTS is a trademark of British Council, IDP IELTS, and Cambridge Assessment English. MarkReady is unaffiliated. Our scores are AI estimates, not official exam results.`),
    ],
  },
  {
    heading: "Your Rights",
    blocks: [
      p(`You have the right to:`),
      ul(
        `Request access to or a copy of your personal information`,
        `Request deletion of your account and data`,
        `Opt out of non-essential tracking once it is introduced`,
      ),
      p(`Submit requests to getmarkready@gmail.com.`),
    ],
  },
  {
    heading: "Contact",
    blocks: [
      p(`Questions about this policy? Email getmarkready@gmail.com.`),
    ],
  },
];

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
          Mark Ready Privacy Policy.
        </h1>
        <p className="text-sm text-[#5B6266] mb-8">Last updated: 17th September 2026</p>

        <div className="space-y-8 text-[#23282B] text-[15px] leading-relaxed">
          {SECTIONS.map((section, s) => (
            <section key={section.heading ?? s}>
              {section.heading && (
                <h2 className="font-serif text-xl font-semibold mb-2">{section.heading}</h2>
              )}
              <div className="space-y-3">
                {section.blocks.map((block, b) =>
                  block.type === "p" ? (
                    <p key={b}>{block.text}</p>
                  ) : (
                    <ul key={b} className="list-disc pl-5 space-y-2">
                      {block.items.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 pt-6 border-t border-[#E4DFD3] text-sm text-[#5B6266] flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-[#23282B] underline">
            Terms of Service
          </Link>
          <Link href="/refund" className="hover:text-[#23282B] underline">
            Refund Policy
          </Link>
          <Link href="/login" className="hover:text-[#23282B] underline">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
