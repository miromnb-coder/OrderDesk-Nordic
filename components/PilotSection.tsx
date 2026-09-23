import { PilotButton } from "@/components/PilotButton";
import { CheckIcon } from "@/components/icons";

const features = [
  "Visma Net connection",
  "Email/PDF/Excel orders",
  "Customer & product matching",
  "Human review workflow",
  "Setup together with our team",
];

export function PilotSection() {
  return (
    <aside className="pilot-card" id="pricing" aria-labelledby="pilot-section-title">
      <div className="pilot-badge"><span /> Pilot</div>
      <h2 id="pilot-section-title">Start with a real order.</h2>
      <p className="pilot-price">From <strong>€500 / month</strong></p>
      <ul className="pilot-list">
        {features.map((feature) => <li key={feature}><span><CheckIcon /></span>{feature}</li>)}
      </ul>
      <PilotButton className="button button-dark button-full">Test OrderDesk</PilotButton>
      <p className="pilot-small">We’ll first test OrderDesk with a sample of your existing purchase orders before connecting it to your live workflow.</p>
    </aside>
  );
}
