import SectionHeader from "@/components/marketing/SectionHeader";
import { SUPPORT_EMAIL } from "@/lib/constants";

/** Illustrative patterns — not verified client outcomes. */
const illustrativeExamples = [
  {
    vertical: "Home Services",
    pattern:
      "Businesses outside the Local 3-Pack often have profile gaps (photos, categories, review responses) suppressing map visibility.",
    focus: "Keyword relevance & profile completeness",
  },
  {
    vertical: "Healthcare",
    pattern:
      "Practices with strong star ratings can still lose map clicks when competitors have richer GBP content and broader service-area coverage.",
    focus: "Content depth & service area",
  },
  {
    vertical: "Legal",
    pattern:
      "High-competition keywords reward consistent posts, Q&A, and review velocity — not just a complete listing at signup.",
    focus: "Ongoing GBP activity",
  },
];

export default function Testimonial() {
  return (
    <section id="testimonials" className="scroll-mt-28 border-b border-[#dadce0] bg-[#f8f9fa] py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeader
          label="What we track"
          labelColor="emerald"
          title={
            <>
              Score, rankings, and revenue —{" "}
              <span className="gradient-text font-semibold">in one loop</span>
            </>
          }
          subtitle="We don't publish client quotes until we have verified permission. Below are illustrative patterns by vertical — your free audit shows your actual numbers."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {illustrativeExamples.map((example) => (
            <article
              key={example.vertical}
              className="rounded-xl border border-[#dadce0] bg-white p-6"
            >
              <span className="rounded-full bg-[#fef7e0] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#e37400]">
                Illustrative example
              </span>
              <h3 className="mt-3 text-lg font-semibold text-[#202124]">{example.vertical}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#5f6368]">{example.pattern}</p>
              <p className="mt-4 text-xs font-medium text-[#1a73e8]">{example.focus}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-[#80868b]">
          Have a Reputation Boost story to share?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#1a73e8] hover:underline">
            Email us
          </a>{" "}
          — we&apos;ll only publish testimonials with your written approval.
        </p>
      </div>
    </section>
  );
}
