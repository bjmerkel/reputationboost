import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import LocalPack from "@/components/LocalPack";
import Features from "@/components/Features";
import HowItWorks from "@/components/HowItWorks";
import Testimonial from "@/components/Testimonial";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LocalPack />
        <Features />
        <HowItWorks />
        <Testimonial />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
