import Link from "next/link";

export const metadata = {
  title: "Terms of Service — MarkReady",
  description: "Terms of service governing your use of MarkReady's IELTS writing feedback service.",
};

// Rewritten product-specific terms of service, accurate as of September 2026.
type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };
type Section = { heading: string; blocks: Block[] };

const p = (text: string): Block => ({ type: "p", text });
const ul = (...items: string[]): Block => ({ type: "ul", items });

const SECTIONS: Section[] = [
  {
    heading: "Overview",
    blocks: [
      p(`MarkReady provides AI-powered writing feedback for IELTS exams. By using our service, you agree to these terms. If you do not agree, do not use our service.`),
    ],
  },
  {
    heading: "Eligibility",
    blocks: [
      p(`You must be at least 13 years old to use MarkReady. If you are under the age of majority in your jurisdiction, you represent that you have parental or guardian consent.`),
    ],
  },
  {
    heading: "User Conduct",
    blocks: [
      p(`You agree not to:`),
      ul(
        `Use the service for any illegal or unauthorized purpose`,
        `Transmit viruses, malware, or destructive code`,
        `Engage in harassment, abuse, or discrimination`,
        `Attempt to access unauthorized areas or circumvent security`,
      ),
      p(`Violation of these terms may result in immediate termination of your account.`),
    ],
  },
  {
    heading: "Marks and Scoring",
    blocks: [
      p(`Marks are the number of submissions you can score. You receive 2 free marks lifetime plus 1 free mark per calendar day. Mark packs cost $20 USD for 20 marks, expiring 30 days after purchase.`),
      p(`We are not responsible if you exceed your mark allowance or if marks expire. See the [LINK TO REFUND POLICY] for refund and non-renewal policy.`),
    ],
  },
  {
    heading: "Content and Essays",
    blocks: [
      p(`You grant us the right to use your essays and uploaded images to improve our service, including for training and evaluation, with your understanding that they will be sent to OpenRouter and AI model providers for scoring.`),
      p(`You represent that your submitted essays and images are your own work and do not infringe third-party rights.`),
    ],
  },
  {
    heading: "Scores and Disclaimers",
    blocks: [
      p(`MarkReady scores are AI estimates, not official exam results. IELTS is a trademark of British Council, IDP IELTS, and Cambridge Assessment English. MarkReady is unaffiliated and not endorsed by any exam authority.`),
      p(`We do not guarantee accuracy of scores or feedback. Use our estimates as study guidance only, not as official predictions.`),
    ],
  },
  {
    heading: "Limitations of Liability",
    blocks: [
      p(`To the maximum extent permitted by law, MarkReady is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the service.`),
    ],
  },
  {
    heading: "Privacy",
    blocks: [
      p(`Your use of personal information is governed by our [LINK TO PRIVACY POLICY].`),
    ],
  },
  {
    heading: "Termination",
    blocks: [
      p(`We may terminate your account at any time for violation of these terms or for any reason.`),
    ],
  },
  {
    heading: "Changes to Terms",
    blocks: [
      p(`We reserve the right to update these terms at any time. Continued use of the service constitutes acceptance of changes.`),
    ],
  },
  {
    heading: "Contact",
    blocks: [
      p(`Questions about these terms? Email getmarkready@gmail.com.`),
    ],
  },
];

const LINK_CLASS = "text-[#1F5C4E] underline hover:text-[#154136]";

/** The supplied text marks two places for policy links; resolve them to the live pages. */
function withPolicyLinks(text: string): React.ReactNode[] {
  return text.split(/(\[LINK TO REFUND POLICY\]|\[LINK TO PRIVACY POLICY\])/).map((part, i) => {
    if (part === "[LINK TO REFUND POLICY]") {
      return <Link key={i} href="/refund" className={LINK_CLASS}>Refund Policy</Link>;
    }
    if (part === "[LINK TO PRIVACY POLICY]") {
      return <Link key={i} href="/privacy" className={LINK_CLASS}>Privacy Policy</Link>;
    }
    return part;
  });
}

export default function TermsPage() {
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
        <h1 className="font-serif text-3xl font-semibold text-[#23282B] mb-8">
          Terms of Service
        </h1>

        <div className="space-y-8 text-[#23282B] text-[15px] leading-relaxed">
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-serif text-xl font-semibold mb-2">{section.heading}</h2>
              <div className="space-y-3">
                {section.blocks.map((block, b) =>
                  block.type === "p" ? (
                    <p key={b}>{withPolicyLinks(block.text)}</p>
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
          <Link href="/privacy" className="hover:text-[#23282B] underline">
            Privacy Policy
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
