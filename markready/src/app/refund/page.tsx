import Link from "next/link";

export const metadata = {
  title: "Refund Policy — MarkReady",
};

/** Refund policy as supplied by the founder. */
export default function RefundPage() {
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
          Refund Policy
        </h1>
        <p className="text-[#5B6266] text-[15px] leading-relaxed">
          Strictly no refunds or exchanges or transfer of credits.
        </p>

        <footer className="mt-12 pt-6 border-t border-[#E4DFD3] text-sm text-[#5B6266] flex flex-wrap gap-4">
          <Link href="/terms" className="hover:text-[#23282B] underline">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-[#23282B] underline">
            Privacy Policy
          </Link>
          <Link href="/login" className="hover:text-[#23282B] underline">
            Sign in
          </Link>
        </footer>
      </main>
    </div>
  );
}
