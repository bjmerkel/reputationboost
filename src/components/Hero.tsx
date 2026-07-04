import HeroBusinessSearch from "@/components/marketing/HeroBusinessSearch";

export default function Hero() {
  return (
    <section className="border-b border-[#dadce0] bg-white pt-12 pb-16 lg:pt-16 lg:pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center text-center">
          <div className="animate-fade-up mb-6 inline-flex items-center gap-2 rounded-full border border-[#d2e3fc] bg-[#e8f0fe] px-4 py-1.5 text-sm font-medium text-[#1a73e8]">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1a73e8] opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1a73e8]" />
            </span>
            Free Reputation Boost Score Audit
          </div>

          <h1 className="animate-fade-up animate-delay-100 max-w-4xl text-4xl font-normal leading-tight tracking-tight text-[#202124] sm:text-5xl lg:text-6xl">
            Your Score. Your Plan.{" "}
            <span className="gradient-text font-semibold">Your Revenue.</span>
          </h1>

          <p className="animate-fade-up animate-delay-200 mt-6 max-w-2xl text-lg leading-relaxed text-[#5f6368]">
            Find your business on Google Maps. We audit your profile, AI-pick your
            best keywords, and run a daily loop that measures, improves, and
            recalculates your Reputation Boost Score — so rankings, calls, and
            revenue keep climbing.
          </p>

          <HeroBusinessSearch />
        </div>
      </div>
    </section>
  );
}
