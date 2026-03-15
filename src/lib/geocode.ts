type NominatimResponse = {
  address?: {
    country?: string;
    state?: string;
    region?: string;
    county?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    hamlet?: string;
    suburb?: string;
  };
  display_name?: string;
};

type ReverseGeocodeResult = {
  country: string | null;
  region: string | null;
  city: string | null;
  locationLabel: string | null;
};

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude.toString(),
    lon: longitude.toString(),
    zoom: "13",
    addressdetails: "1"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    {
      headers: {
        "Accept-Language": "en",
        "User-Agent": "pikimin-postcard-atlas/0.1"
      },
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Reverse geocoding failed with status ${response.status}`);
  }

  const payload = (await response.json()) as NominatimResponse;
  const address = payload.address ?? {};

  return {
    country: address.country ?? null,
    region: address.state ?? address.region ?? address.county ?? null,
    city:
      address.city ??
      address.town ??
      address.village ??
      address.municipality ??
      address.hamlet ??
      address.suburb ??
      null,
    locationLabel: payload.display_name ?? null
  };
}
