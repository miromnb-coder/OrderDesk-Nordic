const steps = [
  ["01", "Email arrives", "Your customer sends an order by email, PDF or Excel."],
  ["02", "OrderDesk matches it", "We read, validate and match items to your product data."],
  ["03", "Ready in Visma Net", "Create the sales order after reviewing the exceptions."],
];

export function ProcessStrip() {
  return (
    <section className="process-strip section-pad" id="how-it-works" aria-label="How OrderDesk works">
      {steps.map(([number, title, copy]) => (
        <article className="process-step" key={number}>
          <span className="step-number">{number}</span>
          <h2>{title}</h2>
          <p>{copy}</p>
        </article>
      ))}
    </section>
  );
}
