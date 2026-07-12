export type PostcardPlaceType = "mushroom" | "flower";

export type Postcard = {
  id: number;
  title: string;
  description: string;
  latitude: number;
  longitude: number;
  placeType: PostcardPlaceType;
  imageUrl: string;
  country: string | null;
  region: string | null;
  city: string | null;
  locationLabel: string | null;
  tags: string[] | null;
  createdAt: string;
};

export type CreatePostcardInput = Omit<Postcard, "id" | "createdAt" | "tags">;
export type UpdatePostcardInput = CreatePostcardInput;
