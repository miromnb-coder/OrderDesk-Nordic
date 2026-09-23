import Link from "next/link";

export const metadata = {
  title: "Privacy — OrderDesk",
  description: "How OrderDesk handles information submitted through the pilot request form.",
};

export default function PrivacyPage() {
  return (
    <main className="legal-shell">
      <div className="legal-card">
        <Link className="legal-back" href="/">← OrderDesk</Link>

        <span className="eyebrow">PRIVACY</span>
        <h1>Privacy notice.</h1>
        <p className="legal-intro">
          This notice explains how information submitted through the OrderDesk website is handled.
        </p>

        <section>
          <h2>Information we collect</h2>
          <p>
            If you request a pilot, we collect the information you submit: work email, company,
            optional name, ERP, and approximate order volume. We also store the time the request was received
            and a simple lead status used to follow up.
          </p>
        </section>

        <section>
          <h2>Why we use it</h2>
          <p>
            We use this information only to evaluate your pilot request, respond to you, and discuss a
            potential OrderDesk pilot. We do not use pilot-request details for unrelated advertising.
          </p>
        </section>

        <section>
          <h2>Where it is stored</h2>
          <p>
            Pilot-request data is stored using Supabase. The website is hosted on Vercel. These providers
            may process data on our behalf as part of operating the website and lead workflow.
          </p>
        </section>

        <section>
          <h2>How long we keep it</h2>
          <p>
            We keep pilot-request information only as long as reasonably needed to handle the inquiry,
            follow up, and maintain necessary business records. Information that is no longer needed should
            be deleted or anonymised.
          </p>
        </section>

        <section>
          <h2>Your choices</h2>
          <p>
            You can ask us to correct or delete information you submitted, subject to any legal requirement
            to retain it. Until a dedicated privacy contact address is published, you can make that request
            by replying to any OrderDesk follow-up email you receive.
          </p>
        </section>

        <section>
          <h2>Cookies and analytics</h2>
          <p>
            This version of the OrderDesk website does not intentionally use advertising cookies or
            behavioural advertising trackers. If analytics or other optional tracking is added later, this
            notice should be updated before it is enabled.
          </p>
        </section>

        <p className="legal-updated">Last updated: 23 September 2026</p>
      </div>
    </main>
  );
}
