import HeroBusinessSearch from "@/components/marketing/HeroBusinessSearch";
import HeroDashboardPreview from "@/components/marketing/HeroDashboardPreview";

export default function Hero() {
  return (
    <section className="border-b border-[#dadce0] bg-white pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <h1 className="animate-fade-up max-w-xl text-[1.75rem] font-normal leading-tight tracking-tight text-[#202124] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
              See What&apos;s Costing You{" "}
              <span className="font-semibold text-[#1a73e8]">Google Maps Customers</span>
            </h1>

            <p className="animate-fade-up animate-delay-100 mt-4 max-w-xl text-lg font-medium leading-snug text-[#3c4043] sm:text-xl">
              Every day you&apos;re outside Google&apos;s Local 3-Pack, Google is sending customers
              to someone else.
            </p>

            <div className="w-full max-w-xl">
              <HeroBusinessSearch />
            </div>
          </div>

          <div className="animate-fade-up animate-delay-200">
            <HeroDashboardPreview />
          </div>
        </div>
      </div>
    </section>
  );
}
