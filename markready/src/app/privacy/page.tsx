import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — MarkReady",
};

// Text supplied by the founder (Mark Ready Privacy Policy, 17 September 2026),
// rendered verbatim apart from one line-wrap duplicate removed from the source
// document and a few missing spaces at wrapped words restored.
type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };
type Section = { heading: string | null; blocks: Block[] };

const p = (text: string): Block => ({ type: "p", text });
const ul = (...items: string[]): Block => ({ type: "ul", items });

const SECTIONS: Section[] = [
  {
    heading: null,
    blocks: [
      p(`This Privacy Policy describes how Mark Ready (the "Site", "we", "us", or "our") collects, uses, and discloses your personal information when you visit, use our services, or make a purchase from https://markready-alpha.vercel.app/ (the "Site") or otherwise communicate with us (collectively, the "Services").`),
      p(`For purposes of this Privacy Policy, "you" and "your" means you as the user of the Services, whether you are a customer, website visitor, or another individual whose information we have collected pursuant to this Privacy Policy.`),
      p(`Please read this Privacy Policy carefully. By using and accessing any of the Services, you agree to the collection, use, and disclosure of your information as described in this Privacy Policy. If you do not agree to this Privacy Policy, please do not use or access any of the Services.`),
    ],
  },
  {
    heading: "Changes to This Privacy Policy",
    blocks: [
      p(`We may update this Privacy Policy from time to time, including to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will post the revised Privacy Policy on the Site, update the "Last updated" date and take any other steps required by applicable law.`),
    ],
  },
  {
    heading: "How We Collect and Use Your Personal Information",
    blocks: [
      p(`To provide the Services, we collect and have collected over the past 12 months personal information about you from a variety of sources, as set out below. The information that we collect and use varies depending on how you interact with us.`),
      p(`In addition to the specific uses set out below, we may use information we collect about you to communicate with you, provide the Services, comply with any applicable legal obligations, enforce any applicable terms of service, and to protect or defend the Services, our rights, and the rights of our users or others.`),
    ],
  },
  {
    heading: "What Personal Information We Collect",
    blocks: [
      p(`The types of personal information we obtain about you depends on how you interact with our Site and use our Services. When we use the term "personal information", we are referring to information that identifies, relates to, describes or can be associated with you. The following sections describe the categories and specific types of personal information we collect.`),
    ],
  },
  {
    heading: "Information We Collect Directly from You",
    blocks: [
      p(`Information that you directly submit to us through our Services may include:`),
      ul(
        `Basic contact details including your name, address, phone number, email.`,
        `Order information including your name, billing address, shipping address, payment confirmation, email address, phone number.`,
        `Account information including your username, password, security questions.`,
        `Shopping information including the items you view, put in your cart or add to your wishlist.`,
        `Customer support information including the information you choose to include in communications with us, for example, when sending a message through the Services.`,
      ),
      p(`Some features of the Services may require you to directly provide us with certain information about yourself. You may elect not to provide this information, but doing so may prevent you from using or accessing these features.`),
    ],
  },
  {
    heading: "Information We Collect through Cookies",
    blocks: [
      p(`We also automatically collect certain information about your interaction with the Services ("Usage Data"). To do this, we may use cookies, pixels and similar technologies ("Cookies"). Usage Data may include information about how you access and use our Site and your account, including device information, browser information, information about your network connection, your IP address and other information regarding your interaction with the Services.`),
    ],
  },
  {
    heading: "Information We Obtain from Third Parties",
    blocks: [
      p(`Finally, we may obtain information about you from third parties, including from vendors and service providers who may collect information on our behalf, such as:`),
      ul(
        `Companies who support our Site and Services.`,
        `Our payment processors, who collect payment information (e.g., bank account, credit or debit card information, billing address) to process your payment in order to fulfill your orders and provide you with products or services you have requested, in order to perform our contract with you.`,
        `When you visit our Site, open or click on emails we send you, or interact with our Services or advertisements, we, or third parties we work with, may automatically collect certain information using online tracking technologies such as pixels, web beacons, software developer kits, third-party libraries, and cookies.`,
      ),
      p(`Any information we obtain from third parties will be treated in accordance with this Privacy Policy. We are not responsible or liable for the accuracy of the information provided to us by third parties and are not responsible for any third party's policies or practices. For more information, see the section below, Third Party Websites and Links.`),
    ],
  },
  {
    heading: "How We Use Your Personal Information",
    blocks: [
      ul(
        `Providing Products and Services. We use your personal information to provide you with the Services in order to perform our contract with you, including to process your payments, fulfill your orders, to send notifications to you related to you account, purchases, returns, exchanges or other transactions, to create, maintain and otherwise manage your account, to arrange for shipping, facilitate any returns and exchanges and to enable you to post reviews.`,
        `Marketing and Advertising. We use your personal information for marketing and promotional purposes, such as to send marketing, advertising and promotional communications by email, text message or postal mail, and to show you advertisements for products or services. This may include using your personal information to better tailor the Services and advertising on our Site and other websites.`,
        `Security and Fraud Prevention. We use your personal information to detect, investigate or take action regarding possible fraudulent, illegal or malicious activity. If you choose to use the Services and register an account, you are responsible for keeping your account credentials safe. We highly recommend that you do not share your username, password, or other access details with anyone else. If you believe your account has been compromised, please contact us immediately.`,
        `Communicating with you. We use your personal information to provide you with customer support and improve our Services. This is in our legitimate interests in order to be responsive to you, to provide effective services to you, and to maintain our business relationship with you.`,
      ),
    ],
  },
  {
    heading: "Cookies",
    blocks: [
      p(`Like many websites, we use Cookies on our Site. We use Cookies to power and improve our Site and our Services (including to remember your actions and preferences), to run analytics and better understand user interaction with the Services (in our legitimate interests to administer, improve and optimize the Services). We may also permit third parties and services providers to use Cookies on our Site to better tailor the services, products and advertising on our Site and other websites.`),
      p(`Most browsers automatically accept Cookies by default, but you can choose to set your browser to remove or reject Cookies through your browser controls. Please keep in mind that removing or blocking Cookies can negatively impact your user experience and may cause some of the Services, including certain features and general functionality, to work incorrectly or no longer be available. Additionally, blocking Cookies may not completely prevent how we share information with third parties such as our advertising partners.`),
    ],
  },
  {
    heading: "How We Disclose Personal Information",
    blocks: [
      p(`In certain circumstances, we may disclose your personal information to third parties for legitimate purposes subject to this Privacy Policy. Such circumstances may include:`),
      ul(
        `With vendors or other third parties who perform services on our behalf (e.g., IT management, payment processing, data analytics, customer support, cloud storage, fulfillment and shipping).`,
        `With business and marketing partners to provide services and advertise to you.`,
        `When you direct, request us or otherwise consent to our disclosure of certain information to third parties, such as to ship you products or through your use of social media widgets or login integrations, with your consent.`,
        `With our affiliates or otherwise within our corporate group, in our legitimate interests to run a successful business.`,
        `In connection with a business transaction such as a merger or bankruptcy, to comply with any applicable legal obligations (including to respond to subpoenas, search warrants and similar requests), to enforce any applicable terms of service, and to protect or defend the Services, our rights, and the rights of our users or others.`,
      ),
      p(`We have, in the past 12 months disclosed the following categories of personal information and sensitive personal information (denoted by *) about users for the purposes set out above in "How we Collect and Use your Personal Information" and "How we Disclose Personal Information":`),
      p(`Category:`),
      ul(
        `Identifiers such as basic contact details and certain order and account information`,
        `Commercial information such as order information, shopping information and customer support information`,
        `Internet or other similar network activity, such as Usage Data`,
      ),
      p(`Categories of Recipients:`),
      ul(
        `Vendors and third parties who perform services on our behalf (such as Internet service providers, payment processors, fulfillment partners, customer support partners and data analytics providers)`,
        `Business and marketing partners`,
        `Affiliates`,
      ),
      p(`We do not use or disclose sensitive personal information for the purposes of inferring characteristics about you.`),
    ],
  },
  {
    heading: "User Generated Content",
    blocks: [
      p(`The Services may enable you to post product reviews and other user-generated content. If you choose to submit user generated content to any public area of the Services, this content will be public and accessible by anyone.`),
      p(`We do not control who will have access to the information that you choose to make available to others, and cannot ensure that parties who have access to such information will respect your privacy or keep it secure. We are not responsible for the privacy or security of any information that you make publicly available, or for the accuracy, use or misuse of any information that you disclose or receive from third parties.`),
    ],
  },
  {
    heading: "Third Party Websites and Links",
    blocks: [
      p(`Our Site may provide links to websites or other online platforms operated by third parties. If you follow links to sites not affiliated or controlled by us, you should review their privacy and security policies and other terms and conditions. We do not guarantee and are not responsible for the privacy or security of such sites, including the accuracy, completeness, or reliability of information found on these sites. Information you provide on public or semi-public venues, including information you share on third-party social networking platforms may also be viewable by other users of the Services and/or users of those third-party platforms without limitation as to its use by us or by a third party. Our inclusion of such links does not, by itself, imply any endorsement of the content on such platforms or of their owners or operators, except as disclosed on the Services.`),
    ],
  },
  {
    heading: "Children's Data",
    blocks: [
      p(`The Services are not intended to be used by children, and we do not knowingly collect any personal information about children. If you are the parent or guardian of a child who has provided us with their personal information, you may contact us using the contact details set out below to request that it be deleted.`),
      p(`As of the Effective Date of this Privacy Policy, we do not have actual knowledge that we "share" or "sell" (as those terms are defined in applicable law) personal information of individuals under 16 years of age.`),
    ],
  },
  {
    heading: "Security and Retention of Your Information",
    blocks: [
      p(`Please be aware that no security measures are perfect or impenetrable, and we cannot guarantee "perfect security." In addition, any information you send to us may not be secure while in transit. We recommend that you do not use unsecure channels to communicate sensitive or confidential information to us.`),
      p(`How long we retain your personal information depends on different factors, such as whether we need the information to maintain your account, to provide the Services, comply with legal obligations, resolve disputes or enforce other applicable contracts and policies.`),
    ],
  },
  {
    heading: "Your Rights and Choices",
    blocks: [
      p(`Depending on where you live, you may have some or all of the rights listed below in relation to your personal information. However, these rights are not absolute, may apply only in certain circumstances and, in certain cases, we may decline your request as permitted by law.`),
      ul(
        `Right to Access / Know. You may have a right to request access to personal information that we hold about you, including details relating to the ways in which we use and share your information.`,
        `Right to Delete. You may have a right to request that we delete personal information we maintain about you.`,
        `Right to Correct. You may have a right to request that we correct inaccurate personal information we maintain about you.`,
        `Right of Portability. You may have a right to receive a copy of the personal information we hold about you and to request that we transfer it to a third party, in certain circumstances and with certain exceptions.`,
        `Right to Opt out of Sale or Sharing or Targeted Advertising. You may have a right to direct us not to "sell" or "share" your personal information or to opt out of the processing of your personal information for purposes considered to be "targeted advertising", as defined in applicable privacy laws. Please note that if you visit our Site with the Global Privacy Control opt-out preference signal enabled, depending on where you are, we will automatically treat this as a request to opt-out of the "sale" or "sharing" of information for the device and browser that you use to visit the Site.`,
        `Right to Limit and/or Opt out of Use and Disclosure of Sensitive Personal Information. You may have a right to direct us to limit our use and/or disclosure of sensitive personal information to only what is necessary to perform the Services or provide the goods reasonably expected by an average individual.`,
        `Restriction of Processing: You may have the right to ask us to stop or restrict our processing of personal information.`,
        `Withdrawal of Consent: Where we rely on consent to process your personal information, you may have the right to withdraw this consent.`,
        `Appeal: You may have a right to appeal our decision if we decline to process your request. You can do so by replying directly to our denial.`,
        `Managing Communication Preferences: We may send you promotional emails, and you may opt out of receiving these at any time by using the unsubscribe option displayed in our emails to you. If you opt out, we may still send you non-promotional emails, such as those about your account or orders that you have made.`,
      ),
      p(`You may exercise any of these rights where indicated on our Site or by contacting us using the contact details provided below.`),
      p(`We will not discriminate against you for exercising any of these rights. We may need to collect information from you to verify your identity, such as your email address or account information, before providing a substantive response to the request.`),
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
