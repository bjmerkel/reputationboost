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

          <p className="animate-fade-up animate-delay-100 mt-4 max-w-xl text-lg font-medium leading-snug text-[#3c4043] sm:text-xl">
            Your competitor is getting the calls meant for you. Find out why.
          </p>

          <HeroBusinessSearch />

          <p className="animate-fade-up animate-delay-200 mt-8 max-w-2xl text-base leading-relaxed text-[#5f6368]">
            Search your business. We&apos;ll analyze your Google Business Profile, identify your
            highest-value keywords, calculate your{" "}
            <span className="font-medium text-[#202124]">Reputation Boost Score</span>, and monitor
            it every night so you always know what to improve next.
          </p>
        </div>
      </div>
    </section>
  );
}
