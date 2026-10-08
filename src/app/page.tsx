import type { Metadata } from "next";
import AnchorNavigation from "@/components/ui/AnchorNavigation";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import Benefits from "@/components/landing/Benefits";
import HowItWorks from "@/components/landing/HowItWorks";
import ProductPhilosophy from "@/components/landing/ProductPhilosophy";
import InterfacePreview from "@/components/landing/InterfacePreview";
import Security from "@/components/landing/Security";
import FAQ from "@/components/landing/FAQ";
import FinalCTA from "@/components/landing/FinalCTA";
import Footer from "@/components/landing/Footer";
export const metadata: Metadata = {
  alternates: { canonical: "https://quickexit.net/" },
};

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <AnchorNavigation />
      <Header />
      <main id="main" tabIndex={-1}>
        <Hero />
        <Benefits />
        <HowItWorks />
        <ProductPhilosophy />
        <InterfacePreview />
        <Security />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
