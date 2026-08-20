import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { CommandCentre } from "@/components/CommandCentre";
import { Lifecycle } from "@/components/Lifecycle";
import { Platform } from "@/components/Platform";
import { Truth } from "@/components/Truth";
import { UseCases } from "@/components/UseCases";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <CommandCentre />
        <Lifecycle />
        <Platform />
        <Truth />
        <UseCases />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
