import { Header } from "../components/Header";
import { Hero } from "../components/Hero";
import { ProblemSection } from "../components/ProblemSection";
import { DemoSection } from "../components/DemoSection";
import { FeaturesSection } from "../components/FeaturesSection";
import { HowItWorksSection } from "../components/HowItWorksSection";
import { UseCasesSection } from "../components/UseCasesSection";
import { SecuritySection } from "../components/SecuritySection";
import { PricingSection } from "../components/PricingSection";
import { FaqSection } from "../components/FaqSection";
import { FinalCtaSection } from "../components/FinalCtaSection";
import { Footer } from "../components/Footer";

export function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <DemoSection />
        <FeaturesSection />
        <HowItWorksSection />
        <UseCasesSection />
        <SecuritySection />
        <PricingSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}
