import { SignOutButton } from "@/components/SignOutButton";

export const metadata = {
  title: "You're on the waitlist — MarkReady",
};

/**
 * Shown to the `waitlist` cohort (signup 101+). They have a real account, so
 * when capacity opens we can move them to `founding` and they simply get in —
 * no re-signup needed.
 */
export default function WaitlistPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF8F3] px-4 py-12">
      <div className="mb-8 text-center">
        <span className="font-serif text-2xl font-semibold text-[#23282B]">MarkReady</span>
      </div>

      <div className="w-full max-w-md bg-white border border-[#E4DFD3] rounded-2xl p-8 text-center">
        <h1 className="font-serif text-xl font-semibold text-[#23282B] mb-3">
          You&rsquo;re on the waitlist
        </h1>

        <p className="text-sm text-[#5B6266] mb-4">
          We opened MarkReady to our first 100 users so we can give everyone proper
          attention while we calibrate the scoring. Those places are taken for now.
        </p>

        <p className="text-sm text-[#5B6266] mb-6">
          Your account is ready and waiting. We&rsquo;ll email you the moment a place
          opens up &mdash; you won&rsquo;t need to sign up again.
        </p>

        <div className="pt-4 border-t border-[#E4DFD3]">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
