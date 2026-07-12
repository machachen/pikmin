"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Check, Copy, Lock, LogOut, MapPin, Pencil, Plus, Search, Sparkles, Trash2, X } from "lucide-react";

import type { Postcard, PostcardPlaceType } from "@/src/lib/types";

const PostcardMap = dynamic(
  () => import("@/src/components/postcard-map").then((module) => module.PostcardMap),
  {
    ssr: false,
    loading: () => <div className="map-loading">Loading the postcard atlas...</div>
  }
);

type Coordinates = {
  latitude: number;
  longitude: number;
};

const LIST_RENDER_LIMIT = 100;

type PostcardExplorerProps = {
  initialPostcards: Postcard[];
  initialCanEdit: boolean;
  authProtected: boolean;
};

function formatCoordinates(postcard: Pick<Postcard, "latitude" | "longitude">) {
  return `${postcard.latitude.toFixed(6)}, ${postcard.longitude.toFixed(6)}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function formatLocation(postcard: Postcard) {
  return [postcard.city, postcard.region, postcard.country].filter(Boolean).join(", ");
}

function formatPlaceType(placeType: PostcardPlaceType) {
  return placeType === "mushroom" ? "Mushroom" : "Flower";
}

function getTopTags(postcard: Postcard, limit = 3) {
  return postcard.tags ? postcard.tags.slice(0, limit) : [];
}

function PlaceTypeIcon({ placeType }: { placeType: PostcardPlaceType }) {
  if (placeType === "mushroom") {
    return (
      <svg aria-hidden="true" className="place-type-icon" viewBox="0 0 24 24">
        <path
          d="M4.5 11.25c0-3.46 3.36-6.25 7.5-6.25s7.5 2.79 7.5 6.25c0 .69-.56 1.25-1.25 1.25H5.75c-.69 0-1.25-.56-1.25-1.25Z"
          fill="currentColor"
        />
        <path
          d="M9.2 12.5h5.6v5.05c0 1.9-1.21 3.2-2.8 3.2s-2.8-1.3-2.8-3.2V12.5Z"
          fill="currentColor"
          opacity="0.9"
        />
        <circle cx="8.15" cy="9.2" r="1.2" fill="currentColor" opacity="0.42" />
        <circle cx="12" cy="8.1" r="1.45" fill="currentColor" opacity="0.42" />
        <circle cx="15.9" cy="9.3" r="1.05" fill="currentColor" opacity="0.42" />
        <path
          d="M7.2 11.9c1.7-1.06 3.33-1.59 4.9-1.59 1.55 0 3.12.48 4.7 1.43"
          fill="none"
          opacity="0.6"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.35"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="place-type-icon" viewBox="0 0 24 24">
      <circle cx="12" cy="6.4" fill="currentColor" r="2.9" />
      <circle cx="17.1" cy="10.2" fill="currentColor" r="2.65" />
      <circle cx="15.2" cy="16.2" fill="currentColor" r="2.65" />
      <circle cx="8.8" cy="16.2" fill="currentColor" r="2.65" />
      <circle cx="6.9" cy="10.2" fill="currentColor" r="2.65" />
      <circle cx="12" cy="11.35" fill="currentColor" opacity="0.42" r="1.95" />
      <rect
        fill="currentColor"
        height="4.8"
        opacity="0.92"
        rx="1.4"
        width="2.2"
        x="10.9"
        y="15.9"
      />
    </svg>
  );
}

type PlaceTypeGlyphProps = {
  placeType: PostcardPlaceType;
  className?: string;
};

function PlaceTypeGlyph({ placeType, className = "" }: PlaceTypeGlyphProps) {
  const classes = ["place-type-glyph", `is-${placeType}`, className].filter(Boolean).join(" ");

  return (
    <span aria-hidden="true" className={classes}>
      <PlaceTypeIcon placeType={placeType} />
    </span>
  );
}

function PlaceTypeBadge({ placeType }: { placeType: PostcardPlaceType }) {
  return (
    <PlaceTypeGlyph
      className="place-type-badge"
      placeType={placeType}
    />
  );
}

type PlaceTypeTabsProps = {
  value: PostcardPlaceType;
  onChange: (value: PostcardPlaceType) => void;
};

function PlaceTypeTabs({ value, onChange }: PlaceTypeTabsProps) {
  return (
    <div className="type-tabs" role="tablist" aria-label="Pikmin place type">
      {(["mushroom", "flower"] as const).map((placeType) => (
        <button
          aria-selected={value === placeType}
          className={`type-tab${value === placeType ? " is-active" : ""}`}
          key={placeType}
          onClick={() => onChange(placeType)}
          role="tab"
          type="button"
        >
          <PlaceTypeGlyph placeType={placeType} />
          {formatPlaceType(placeType)}
        </button>
      ))}
    </div>
  );
}

type PlaceFilter = "all" | PostcardPlaceType;

type PlaceFilterTabsProps = {
  value: PlaceFilter;
  onChange: (value: PlaceFilter) => void;
};

function PlaceFilterTabs({ value, onChange }: PlaceFilterTabsProps) {
  return (
    <div className="filter-tabs" role="tablist" aria-label="Postcard type filter">
      {(["all", "flower", "mushroom"] as const).map((filterValue) => (
        <button
          aria-selected={value === filterValue}
          className={`filter-tab${value === filterValue ? " is-active" : ""}`}
          key={filterValue}
          onClick={() => onChange(filterValue)}
          role="tab"
          type="button"
        >
          {filterValue === "all" ? (
            <span aria-hidden="true" className="filter-tab-glyph is-all">
              <Sparkles size={14} />
            </span>
          ) : (
            <PlaceTypeGlyph placeType={filterValue} />
          )}
          <span>{filterValue === "all" ? "All" : formatPlaceType(filterValue)}</span>
        </button>
      ))}
    </div>
  );
}

type CoordinateCopyButtonProps = {
  postcard: Postcard;
  isCopied: boolean;
  onCopy: (postcard: Postcard) => void;
};

function CoordinateCopyButton({
  postcard,
  isCopied,
  onCopy
}: CoordinateCopyButtonProps) {
  return (
    <button
      className={`coordinate-copy-button${isCopied ? " is-copied" : ""}`}
      onClick={() => onCopy(postcard)}
      type="button"
    >
      <span className="coordinate-copy-text">
        <span className="coordinate-copy-value">{formatCoordinates(postcard)}</span>
      </span>
      <span className="coordinate-copy-state">
        {isCopied ? <Check size={16} /> : <Copy size={16} />}
        {isCopied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}

type AddPostcardFormProps = {
  initialCoordinates: Coordinates | null;
  onCancel: () => void;
  onCreated: (postcard: Postcard) => void;
};

function AddPostcardForm({
  initialCoordinates,
  onCancel,
  onCreated
}: AddPostcardFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState(initialCoordinates?.latitude.toFixed(6) ?? "");
  const [longitude, setLongitude] = useState(initialCoordinates?.longitude.toFixed(6) ?? "");
  const [placeType, setPlaceType] = useState<PostcardPlaceType>("flower");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!initialCoordinates) {
      return;
    }

    setLatitude(initialCoordinates.latitude.toFixed(6));
    setLongitude(initialCoordinates.longitude.toFixed(6));
  }, [initialCoordinates]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!imageFile) {
      setError("Choose a postcard image to use for the map marker.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("placeType", placeType);
    formData.append("image", imageFile);

    try {
      const response = await fetch("/api/postcards", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        error?: string;
        postcard?: Postcard;
      };

      if (!response.ok || !payload.postcard) {
        setError(payload.error ?? "Saving failed. Please try again.");
        return;
      }

      startTransition(() => {
        onCreated(payload.postcard as Postcard);
      });

      setTitle("");
      setDescription("");
      setLatitude("");
      setLongitude("");
      setPlaceType("flower");
      setImageFile(null);
      setPreviewUrl(null);
    } catch {
      setError("The postcard could not be saved right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="composer-card" onSubmit={handleSubmit}>
      <div className="composer-header">
        <div>
          <p className="eyebrow">Add postcard</p>
          <h2>Pin a new bloom spot</h2>
        </div>
        <button className="ghost-button" onClick={onCancel} type="button">
          Close
        </button>
      </div>

      <label className="field">
        <span>Title</span>
        <input
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Sunset shrine postcard"
          required
          type="text"
          value={title}
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A short note about where this postcard came from."
          rows={4}
          value={description}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Latitude</span>
          <input
            inputMode="decimal"
            onChange={(event) => setLatitude(event.target.value)}
            placeholder="35.6586"
            required
            type="text"
            value={latitude}
          />
        </label>

        <label className="field">
          <span>Longitude</span>
          <input
            inputMode="decimal"
            onChange={(event) => setLongitude(event.target.value)}
            placeholder="139.7454"
            required
            type="text"
            value={longitude}
          />
        </label>
      </div>

      <label className="field">
        <span>Type</span>
        <PlaceTypeTabs onChange={setPlaceType} value={placeType} />
      </label>

      <label className="field">
        <span>Image</span>
        <input
          accept="image/*"
          onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          required
          type="file"
        />
      </label>

      <div className="map-tip">
        <MapPin size={16} />
        Click on the map any time to drop fresh coordinates into the form.
      </div>

      {previewUrl ? (
        <div className="composer-preview">
          <Image
            alt="Postcard preview"
            fill
            sizes="320px"
            src={previewUrl}
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="composer-actions">
        <button className="secondary-button" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save postcard"}
        </button>
      </div>
    </form>
  );
}

type EditPostcardFormProps = {
  postcard: Postcard;
  isDeleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onUpdated: (postcard: Postcard) => void;
};

function EditPostcardForm({
  postcard,
  isDeleting,
  onCancel,
  onDelete,
  onUpdated
}: EditPostcardFormProps) {
  const [title, setTitle] = useState(postcard.title);
  const [description, setDescription] = useState(postcard.description);
  const [latitude, setLatitude] = useState(postcard.latitude.toFixed(6));
  const [longitude, setLongitude] = useState(postcard.longitude.toFixed(6));
  const [placeType, setPlaceType] = useState<PostcardPlaceType>(postcard.placeType);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(postcard.imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTitle(postcard.title);
    setDescription(postcard.description);
    setLatitude(postcard.latitude.toFixed(6));
    setLongitude(postcard.longitude.toFixed(6));
    setPlaceType(postcard.placeType);
    setImageFile(null);
    setPreviewUrl(postcard.imageUrl);
    setError(null);
  }, [postcard]);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(postcard.imageUrl);
      return;
    }

    const objectUrl = URL.createObjectURL(imageFile);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [imageFile, postcard.imageUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append("title", title);
    formData.append("description", description);
    formData.append("latitude", latitude);
    formData.append("longitude", longitude);
    formData.append("placeType", placeType);

    if (imageFile) {
      formData.append("image", imageFile);
    }

    try {
      const response = await fetch(`/api/postcards/${postcard.id}`, {
        method: "PATCH",
        body: formData
      });

      const payload = (await response.json()) as {
        error?: string;
        postcard?: Postcard;
      };

      if (!response.ok || !payload.postcard) {
        setError(payload.error ?? "Saving failed. Please try again.");
        return;
      }

      onUpdated(payload.postcard);
    } catch {
      setError("The postcard could not be updated right now.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="composer-card" onSubmit={handleSubmit}>
      <div className="composer-header">
        <div>
          <p className="eyebrow">Edit postcard</p>
          <h2>Update this bloom spot</h2>
        </div>
        <button className="ghost-button" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>

      <label className="field">
        <span>Title</span>
        <input
          onChange={(event) => setTitle(event.target.value)}
          required
          type="text"
          value={title}
        />
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          value={description}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Latitude</span>
          <input
            inputMode="decimal"
            onChange={(event) => setLatitude(event.target.value)}
            required
            type="text"
            value={latitude}
          />
        </label>

        <label className="field">
          <span>Longitude</span>
          <input
            inputMode="decimal"
            onChange={(event) => setLongitude(event.target.value)}
            required
            type="text"
            value={longitude}
          />
        </label>
      </div>

      <label className="field">
        <span>Type</span>
        <PlaceTypeTabs onChange={setPlaceType} value={placeType} />
      </label>

      <label className="field">
        <span>Replace image</span>
        <input accept="image/*" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} type="file" />
      </label>

      {previewUrl ? (
        <div className="composer-preview">
          <Image
            alt={`${postcard.title} preview`}
            fill
            sizes="320px"
            src={previewUrl}
            style={{ objectFit: "cover" }}
            unoptimized
          />
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="composer-actions">
        <button className="danger-button" disabled={isDeleting} onClick={onDelete} type="button">
          <Trash2 size={16} />
          {isDeleting ? "Deleting..." : "Delete postcard"}
        </button>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}

type MapFocusCardProps = {
  canEdit: boolean;
  isCollapsed: boolean;
  onEdit: (postcardId: number) => void;
  postcard: Postcard | null;
};

function MapFocusCard({ canEdit, isCollapsed, onEdit, postcard }: MapFocusCardProps) {
  if (!postcard) {
    return (
      <div className={`map-panel-copy${isCollapsed ? " is-collapsed" : ""}`}>
        <p className="eyebrow">
          <Sparkles size={16} />
          Pikmin Bloom postcard atlas
        </p>
        <h1>
          <span className="hero-title-expanded">Track every postcard drop on one shared map.</span>
          <span className="hero-title-collapsed">Postcard atlas</span>
        </h1>
        <p className="hero-copy">
          Upload an image, pin its latitude and longitude, and the app will turn those
          coordinates into country, region, and city tags for your collection.
        </p>
      </div>
    );
  }

  const topTags = getTopTags(postcard);

  return (
    <div className="map-panel-copy map-focus-card">
      <div className="map-focus-media">
        <Image
          alt={postcard.title}
          fill
          sizes="(max-width: 720px) calc(100vw - 56px), 440px"
          src={postcard.imageUrl}
          style={{ objectFit: "cover" }}
          unoptimized
        />
        {canEdit ? (
          <button className="map-focus-edit" onClick={() => onEdit(postcard.id)} type="button">
            <Pencil size={14} />
            Edit
          </button>
        ) : null}
      </div>
      <div className="map-focus-copy">
        <div className="map-focus-topline">
          <p className="eyebrow map-focus-label">
            <PlaceTypeGlyph className="map-focus-label-icon" placeType={postcard.placeType} />
            {formatPlaceType(postcard.placeType)}
          </p>
        </div>
        <div className="map-focus-title-row">
          <h2 className="map-focus-title">{postcard.title}</h2>
        </div>
        {postcard.description ? <p className="map-focus-description">{postcard.description}</p> : null}
        {formatLocation(postcard) ? (
          <p className="map-focus-location">
            <MapPin size={14} />
            {formatLocation(postcard)}
          </p>
        ) : null}
        {topTags.length > 0 ? (
          <div className="tag-chip-row map-focus-tags">
            {topTags.map((tag) => (
              <span className="tag-chip" key={`${postcard.id}-tag-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PostcardExplorer({
  initialPostcards,
  initialCanEdit,
  authProtected
}: PostcardExplorerProps) {
  const [postcards, setPostcards] = useState(initialPostcards);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isMapMounted, setIsMapMounted] = useState(false);
  const [pendingCoordinates, setPendingCoordinates] = useState<Coordinates | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isHeroCollapsed, setIsHeroCollapsed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<PlaceFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [canEdit, setCanEdit] = useState(initialCanEdit);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const postcard of postcards) {
      if (postcard.country) {
        counts.set(postcard.country, (counts.get(postcard.country) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [postcards]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredPostcards = useMemo(() => {
    return postcards.filter((postcard) => {
      if (placeFilter !== "all" && postcard.placeType !== placeFilter) {
        return false;
      }

      if (countryFilter !== "all" && postcard.country !== countryFilter) {
        return false;
      }

      if (normalizedQuery) {
        const haystack = [
          postcard.title,
          postcard.description,
          postcard.city,
          postcard.region,
          postcard.country,
          postcard.locationLabel,
          ...(postcard.tags ?? [])
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesAllTokens = normalizedQuery
          .split(/\s+/)
          .every((token) => haystack.includes(token));

        if (!matchesAllTokens) {
          return false;
        }
      }

      return true;
    });
  }, [postcards, placeFilter, countryFilter, normalizedQuery]);

  const hasActiveFilters =
    placeFilter !== "all" || countryFilter !== "all" || normalizedQuery.length > 0;

  const visiblePostcards = filteredPostcards.slice(0, LIST_RENDER_LIMIT);

  const selectedPostcard = filteredPostcards.find((postcard) => postcard.id === selectedId) ?? null;

  useEffect(() => {
    if (copiedId === null) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedId(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedId]);

  useEffect(() => {
    setIsMapMounted(true);
  }, []);

  useEffect(() => {
    // If the highlighted postcard is filtered out, clear the selection so the
    // map frames the whole filtered set instead of flying to a stale pin.
    if (selectedId !== null && !filteredPostcards.some((postcard) => postcard.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredPostcards, selectedId]);

  function handleCreate(postcard: Postcard) {
    setPostcards((current) => [postcard, ...current]);
    setSelectedId(postcard.id);
    setPendingCoordinates(null);
    setIsComposerOpen(false);
    setActionError(null);
  }

  function handleMapPick(coordinates: Coordinates) {
    setPendingCoordinates(coordinates);
  }

  async function handleCopyCoordinates(postcard: Postcard) {
    try {
      await copyText(formatCoordinates(postcard));
      setCopiedId(postcard.id);
    } catch {
      setCopiedId(null);
    }
  }

  async function handleDeletePostcard(postcard: Postcard) {
    const shouldDelete = window.confirm(`Delete "${postcard.title}"?`);

    if (!shouldDelete) {
      return;
    }

    setActionError(null);
    setDeletingId(postcard.id);

    try {
      const response = await fetch(`/api/postcards/${postcard.id}`, {
        method: "DELETE"
      });

      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setActionError(payload.error ?? "The postcard could not be deleted.");
        return;
      }

      const nextPostcards = postcards.filter((item) => item.id !== postcard.id);
      setPostcards(nextPostcards);
      setSelectedId((currentSelectedId) =>
        currentSelectedId === postcard.id ? (nextPostcards[0]?.id ?? null) : currentSelectedId
      );
      setEditingId(null);

      if (nextPostcards.length === 0) {
        setIsComposerOpen(true);
      }
    } catch {
      setActionError("The postcard could not be deleted right now.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleMapInteraction() {
    setIsHeroCollapsed(true);
  }

  function handleSelectPostcard(postcardId: number) {
    setEditingId(null);
    setSelectedId(postcardId);
  }

  function handleUpdate(postcard: Postcard) {
    setPostcards((current) => current.map((item) => (item.id === postcard.id ? postcard : item)));
    setSelectedId(postcard.id);
    setEditingId(null);
    setActionError(null);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setLoginError(payload.error ?? "Incorrect password.");
        return;
      }

      setCanEdit(true);
      setIsLoginOpen(false);
      setLoginPassword("");
    } catch {
      setLoginError("Could not sign in right now.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout.
    }

    setCanEdit(false);
    setIsComposerOpen(false);
    setEditingId(null);
  }

  return (
    <main className="page-shell">
      <section className="map-panel">
        <MapFocusCard
          canEdit={canEdit}
          isCollapsed={isHeroCollapsed}
          onEdit={setEditingId}
          postcard={selectedPostcard}
        />

        {isMapMounted ? (
          <PostcardMap
            onInteract={handleMapInteraction}
            onPickCoordinates={handleMapPick}
            onSelect={handleSelectPostcard}
            postcards={filteredPostcards}
            selectedId={selectedId}
          />
        ) : (
          <div className="map-loading">Loading the postcard atlas...</div>
        )}
      </section>

      <aside className="sidebar-panel">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Collection</p>
            <h2>{filteredPostcards.length} postcard spots</h2>
          </div>
          <div className="sidebar-header-actions">
            {canEdit ? (
              <>
                <button
                  className="primary-button"
                  onClick={() => {
                    setEditingId(null);
                    setIsComposerOpen(true);
                  }}
                  type="button"
                >
                  <Plus size={18} />
                  Add
                </button>
                {authProtected ? (
                  <button
                    aria-label="Lock editing"
                    className="lock-button"
                    onClick={handleLogout}
                    title="Lock editing"
                    type="button"
                  >
                    <LogOut size={16} />
                  </button>
                ) : null}
              </>
            ) : (
              <button
                className="secondary-button"
                onClick={() => {
                  setLoginError(null);
                  setIsLoginOpen(true);
                }}
                type="button"
              >
                <Lock size={16} />
                Unlock
              </button>
            )}
          </div>
        </div>

        <PlaceFilterTabs
          onChange={(value) => {
            setPlaceFilter(value);
            setSelectedId(null);
          }}
          value={placeFilter}
        />

        <div className="browse-controls">
          <div className="search-field">
            <Search className="search-field-icon" size={16} />
            <input
              aria-label="Search postcards"
              className="search-input"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title or place..."
              type="text"
              value={searchQuery}
            />
            {searchQuery ? (
              <button
                aria-label="Clear search"
                className="search-clear"
                onClick={() => setSearchQuery("")}
                type="button"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {countryOptions.length > 0 ? (
            <select
              aria-label="Filter by country"
              className="country-select"
              onChange={(event) => {
                setCountryFilter(event.target.value);
                setSelectedId(null);
              }}
              value={countryFilter}
            >
              <option value="all">All countries</option>
              {countryOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name} ({option.count})
                </option>
              ))}
            </select>
          ) : null}

          {hasActiveFilters ? (
            <div className="browse-summary">
              <span>
                {filteredPostcards.length} of {postcards.length} spots
              </span>
              <button
                className="browse-clear"
                onClick={() => {
                  setSearchQuery("");
                  setCountryFilter("all");
                  setPlaceFilter("all");
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          ) : null}
        </div>

        {actionError ? <p className="sidebar-error">{actionError}</p> : null}

        {isComposerOpen ? (
          <AddPostcardForm
            initialCoordinates={pendingCoordinates}
            onCancel={() => {
              setIsComposerOpen(false);
              setPendingCoordinates(null);
            }}
            onCreated={handleCreate}
          />
        ) : null}

        {selectedPostcard && editingId === selectedPostcard.id ? (
          <EditPostcardForm
            isDeleting={deletingId === selectedPostcard.id}
            onCancel={() => setEditingId(null)}
            onDelete={() => handleDeletePostcard(selectedPostcard)}
            onUpdated={handleUpdate}
            postcard={selectedPostcard}
          />
        ) : postcards.length === 0 ? (
          <section className="empty-card">
            <h3>No postcards yet</h3>
            <p>
              Start by adding a postcard on the right, or click anywhere on the map to pre-fill
              the coordinates.
            </p>
          </section>
        ) : null}

        <div className="list-panel">
          {filteredPostcards.length === 0 ? (
            <div className="empty-list">
              <p>
                {postcards.length === 0
                  ? "Your list will fill up as soon as the first postcard is saved."
                  : "No postcards match your search or filters."}
              </p>
            </div>
          ) : (
            visiblePostcards.map((postcard) => {
              return (
                <article
                  className={`postcard-row${selectedId === postcard.id ? " is-active" : ""}`}
                  key={postcard.id}
                >
                  <button
                    className="postcard-row-main"
                    onClick={() => handleSelectPostcard(postcard.id)}
                    type="button"
                  >
                    <div className="postcard-row-image">
                      <Image
                        alt={postcard.title}
                        fill
                        sizes="(max-width: 720px) calc(100vw - 88px), 96px"
                        src={postcard.imageUrl}
                        style={{ objectFit: "cover" }}
                        unoptimized
                      />
                    </div>
                    <div className="postcard-row-copy">
                      <div className="postcard-row-head">
                        <div className="postcard-row-title">
                          <PlaceTypeBadge placeType={postcard.placeType} />
                          <h3>{postcard.title}</h3>
                        </div>
                        <span>{new Date(postcard.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="postcard-row-meta">
                        {formatLocation(postcard) ? (
                          <p className="postcard-row-location">
                            <MapPin size={13} />
                            {formatLocation(postcard)}
                          </p>
                        ) : null}
                        {getTopTags(postcard).length > 0 ? (
                          <div className="tag-chip-row">
                            {getTopTags(postcard).map((tag) => (
                              <span className="tag-chip" key={`${postcard.id}-tag-${tag}`}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </button>

                  <CoordinateCopyButton
                    isCopied={copiedId === postcard.id}
                    onCopy={handleCopyCoordinates}
                    postcard={postcard}
                  />
                </article>
              );
            })
          )}

          {filteredPostcards.length > LIST_RENDER_LIMIT ? (
            <p className="list-truncation">
              Showing the first {LIST_RENDER_LIMIT} of {filteredPostcards.length}. Refine your
              search or country filter to see more.
            </p>
          ) : null}
        </div>
      </aside>

      {isLoginOpen ? (
        <div className="login-overlay" role="dialog" aria-modal="true">
          <form className="login-card" onSubmit={handleLogin}>
            <div className="login-head">
              <p className="eyebrow">
                <Lock size={16} />
                Protected
              </p>
              <h2>Unlock editing</h2>
            </div>
            <p className="login-copy">
              Enter the editing password to add, edit, or delete postcards. Viewing stays open to
              everyone.
            </p>
            <label className="field">
              <span>Password</span>
              <input
                autoFocus
                onChange={(event) => setLoginPassword(event.target.value)}
                type="password"
                value={loginPassword}
              />
            </label>
            {loginError ? <p className="form-error">{loginError}</p> : null}
            <div className="composer-actions">
              <button
                className="secondary-button"
                onClick={() => setIsLoginOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button className="primary-button" disabled={isLoggingIn} type="submit">
                {isLoggingIn ? "Unlocking..." : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
