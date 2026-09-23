import { ArrowRightIcon, DatabaseIcon, DocumentIcon, MailIcon } from "@/components/icons";

const stages = [
  { title: "Customer", copy: "PDF / Excel / Email", icon: MailIcon },
  { title: "OrderDesk", copy: "Read → Match → Validate", icon: DocumentIcon },
  { title: "Visma Net", copy: "Customers + Inventory + Sales Orders", icon: DatabaseIcon },
];

export function VismaWorkflow() {
  return (
    <section className="workflow-section section-pad" id="visma-net" aria-labelledby="workflow-title">
      <div className="ambient ambient-workflow" aria-hidden="true" />
      <span className="eyebrow">WORKS WHERE YOU WORK</span>
      <h2 className="section-title" id="workflow-title">Built around your<br />existing Visma Net workflow.</h2>
      <p className="section-lede workflow-lede">
        OrderDesk sits between your customer inbox and Visma Net.<br className="desktop-break" /> Your product catalogue, customers and sales orders remain in your ERP.
      </p>

      <div className="workflow-flow">
        {stages.map(({ title, copy, icon: Icon }, index) => (
          <div className="workflow-fragment" key={title}>
            <article className="workflow-card">
              <span className="workflow-icon"><Icon /></span>
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
            {index < stages.length - 1 && <span className="workflow-arrow" aria-hidden="true"><ArrowRightIcon /></span>}
          </div>
        ))}
      </div>

      <div className="trust-note" id="security">
        <span className="eyebrow">HUMAN-REVIEWED BY DESIGN</span>
        <p>Uncertain matches are surfaced for review before an order is prepared for the target Visma Net workflow.</p>
      </div>
    </section>
  );
}
