import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PilotSection } from "@/components/PilotSection";
import { ProcessComparison } from "@/components/ProcessComparison";
import { ProcessStrip } from "@/components/ProcessStrip";
import { RoiCalculator } from "@/components/RoiCalculator";
import { VismaWorkflow } from "@/components/VismaWorkflow";

export default function Home() {
  return (
    <main className="page-shell" id="top">
      <Header />
      <Hero />
      <ProcessStrip />
      <ProcessComparison />
      <VismaWorkflow />
      <section className="roi-pilot-section section-pad">
        <RoiCalculator />
        <PilotSection />
      </section>
      <div className="section-pad final-cta-wrap"><FinalCTA /></div>
      <Footer />
    </main>
  );
}
