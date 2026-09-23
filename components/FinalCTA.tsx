import { PilotButton } from "@/components/PilotButton";

export function FinalCTA() {
  return (
    <section className="final-cta" aria-labelledby="final-cta-title">
      <div className="final-cta-copy">
        <span className="eyebrow eyebrow-light">REAL ORDERS. REAL RESULTS.</span>
        <h2 id="final-cta-title">See what OrderDesk does with your purchase orders.</h2>
        <p>Send us 5–10 anonymised historical orders. We’ll show you how they would be processed before you change anything in your current workflow.</p>
      </div>
      <div className="final-cta-action">
        <PilotButton className="button button-light">Test my orders</PilotButton>
        <span>No credit card required.</span>
      </div>
    </section>
  );
}
