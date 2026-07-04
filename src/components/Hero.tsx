import HeroBusinessSearch from "@/components/marketing/HeroBusinessSearch";

export default function Hero() {
  return (
    <section className="border-b border-[#dadce0] bg-white pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-16 lg:pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="animate-fade-up max-w-3xl text-[1.75rem] font-normal leading-tight tracking-tight text-[#202124] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            See What&apos;s Costing You{" "}
            <span className="font-semibold text-[#1a73e8]">Google Maps Customers</span>
          </h1>

          <p className="animate-fade-up animate-delay-100 mt-4 max-w-2xl text-lg font-medium leading-snug text-[#3c4043] sm:text-xl">
            Every day you&apos;re outside Google&apos;s Local 3-Pack, competitors are getting the
            calls that could have been yours.
          </p>

          <HeroBusinessSearch />
        </div>
      </div>
    </section>
  );
}
