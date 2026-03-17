"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import type { FormEvent } from "react";
import { useEffect, useState, useTransition } from "react";
import { Check, Copy, MapPin, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";

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

type PostcardExplorerProps = {
  initialPostcards: Postcard[];
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
  if (postcard.locationLabel) {
    return postcard.locationLabel;
  }

  return [postcard.city, postcard.region, postcard.country].filter(Boolean).join(", ");
}

function formatPlaceType(placeType: PostcardPlaceType) {
  return placeType === "mushroom" ? "Mushroom" : "Flower";
}

function getPostcardTags(postcard: Postcard) {
  return [postcard.city, postcard.region, postcard.country].filter(Boolean);
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
  isCollapsed: boolean;
  onEdit: (postcardId: number) => void;
  postcard: Postcard | null;
};

function MapFocusCard({ isCollapsed, onEdit, postcard }: MapFocusCardProps) {
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

  const locationTags = getPostcardTags(postcard);

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
        <button className="map-focus-edit" onClick={() => onEdit(postcard.id)} type="button">
          <Pencil size={14} />
          Edit
        </button>
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
        {locationTags.length > 0 ? (
          <div className="chip-row map-focus-tags">
            {locationTags.map((tag) => (
              <span className="chip" key={`${postcard.id}-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="map-focus-location">{formatLocation(postcard)}</p>
        )}
      </div>
    </div>
  );
}

export function PostcardExplorer({ initialPostcards }: PostcardExplorerProps) {
  const [postcards, setPostcards] = useState(initialPostcards);
  const [selectedId, setSelectedId] = useState<number | null>(initialPostcards[0]?.id ?? null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isMapMounted, setIsMapMounted] = useState(false);
  const [pendingCoordinates, setPendingCoordinates] = useState<Coordinates | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isHeroCollapsed, setIsHeroCollapsed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [placeFilter, setPlaceFilter] = useState<PlaceFilter>("all");

  const filteredPostcards =
    placeFilter === "all"
      ? postcards
      : postcards.filter((postcard) => postcard.placeType === placeFilter);

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
    if (filteredPostcards.length === 0) {
      setSelectedId(null);
      return;
    }

    if (!filteredPostcards.some((postcard) => postcard.id === selectedId)) {
      setSelectedId(filteredPostcards[0].id);
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

  return (
    <main className="page-shell">
      <section className="map-panel">
        <MapFocusCard
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
        </div>

        <PlaceFilterTabs onChange={setPlaceFilter} value={placeFilter} />

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
        ) : !selectedPostcard ? (
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
                {placeFilter === "all"
                  ? "Your list will fill up as soon as the first postcard is saved."
                  : `No ${formatPlaceType(placeFilter).toLowerCase()} postcards match this filter yet.`}
              </p>
            </div>
          ) : (
            filteredPostcards.map((postcard) => {
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
                      <div className="chip-row">
                        {getPostcardTags(postcard).map((tag) => (
                            <span className="chip" key={`${postcard.id}-${tag}`}>
                              {tag}
                            </span>
                          ))}
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
        </div>
      </aside>
    </main>
  );
}
