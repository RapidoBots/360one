import { notFound } from "next/navigation";
import { headers } from "next/headers";
// react-phone-number-input's main entry re-exports its React component
// alongside these, which breaks Next's server-side page-data collection when
// imported from a Server Component -- libphonenumber-js/core is the same
// validation logic with none of that, safe here. `Country` from the two
// packages is the same ISO 3166-1 alpha-2 string type.
import { isSupportedCountry, type CountryCode as Country } from "libphonenumber-js/min";
import { prisma } from "@/lib/prisma";
import { BookingWidget } from "./booking-widget";

// Vercel sets this on every request in production (its edge network geo-IP
// lookup) -- absent in local dev or on non-Vercel hosts, where "US" is a
// reasonable fallback. Already ISO 3166-1 alpha-2, the same format the phone
// input's country codes use, so no mapping needed.
async function detectVisitorCountry(): Promise<Country> {
  const country = (await headers()).get("x-vercel-ip-country");
  return country && isSupportedCountry(country) ? (country as Country) : "US";
}

export default async function BookingWidgetPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [restaurant, visitorCountry] = await Promise.all([
    prisma.restaurant.findUnique({ where: { slug } }),
    detectVisitorCountry(),
  ]);

  if (!restaurant) notFound();

  if (restaurant.status !== "ACTIVE") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="max-w-sm text-base text-muted-foreground">
          This restaurant isn&apos;t currently accepting online reservations.
        </p>
      </div>
    );
  }

  return (
    <BookingWidget
      slug={slug}
      restaurantName={restaurant.name}
      timeZone={restaurant.timezone}
      logoUrl={restaurant.logoUrl}
      bannerUrl={restaurant.bannerUrl}
      mapsEmbedUrl={restaurant.mapsEmbedUrl}
      address={restaurant.address}
      phone={restaurant.phone}
      notes={restaurant.notes}
      facebookUrl={restaurant.facebookUrl}
      instagramUrl={restaurant.instagramUrl}
      visitorCountry={visitorCountry}
      successMessage={restaurant.successMessage}
      successButtonText={restaurant.successButtonText}
    />
  );
}
