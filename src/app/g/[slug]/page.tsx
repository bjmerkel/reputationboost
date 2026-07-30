import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicProfileGuideClient from "@/components/profile-guide/PublicProfileGuideClient";
import { getPublishedProfileGuideBySlug } from "@/lib/profile-guide/storage";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ src?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublishedProfileGuideBySlug(slug);
  if (!data) {
    return { title: "Profile Guide not found" };
  }

  return {
    title: `${data.guide.display_name} | Profile Guide`,
    description: `Connect with ${data.guide.display_name} — reviews, directions, and more.`,
    robots: { index: true, follow: true },
  };
}

export default async function PublicProfileGuidePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const data = await getPublishedProfileGuideBySlug(slug);

  if (!data) notFound();

  const links = data.links
    .filter((link) => link.enabled && link.url.trim())
    .map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
    }));

  return (
    <PublicProfileGuideClient
      guideId={data.guide.id}
      displayName={data.guide.display_name}
      primaryColor={data.guide.primary_color}
      backgroundColor={data.guide.background_color}
      buttonStyle={data.guide.button_style}
      fontPreset={data.guide.font_preset}
      logoUrl={data.guide.logo_url}
      tagline={data.guide.tagline}
      links={links}
      source={query.src}
    />
  );
}
