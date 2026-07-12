"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";

import type { Postcard } from "@/src/lib/types";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type PostcardMapProps = {
  postcards: Postcard[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onPickCoordinates: (coordinates: Coordinates) => void;
  onInteract: () => void;
};

const defaultCenter: [number, number] = [20, 0];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createPostcardIcon(imageUrl: string, isSelected: boolean) {
  return L.divIcon({
    className: "postcard-pin-shell",
    html: `
      <div class="postcard-pin${isSelected ? " is-selected" : ""}">
        <img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" />
      </div>
    `,
    iconSize: [58, 58],
    iconAnchor: [29, 58],
    popupAnchor: [0, -48]
  });
}

function buildPopupHtml(postcard: Postcard) {
  const location = [postcard.city, postcard.region, postcard.country]
    .filter(Boolean)
    .map((part) => escapeHtml(part as string))
    .join(", ");

  return `
    <div class="popup-card">
      <strong>${escapeHtml(postcard.title)}</strong>
      ${location ? `<small>${location}</small>` : ""}
    </div>
  `;
}

function createClusterIcon(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const bucket = count < 10 ? "sm" : count < 100 ? "md" : "lg";
  const size = bucket === "sm" ? 40 : bucket === "md" ? 48 : 56;
  const label = count > 999 ? `${Math.round(count / 100) / 10}k` : `${count}`;

  return L.divIcon({
    html: `<div class="postcard-cluster is-${bucket}"><span>${label}</span></div>`,
    className: "postcard-cluster-shell",
    iconSize: L.point(size, size)
  });
}

function MapViewportController({
  postcards,
  selectedId
}: Pick<PostcardMapProps, "postcards" | "selectedId">) {
  const map = useMap();

  useEffect(() => {
    if (postcards.length === 0) {
      map.setView(defaultCenter, 2, { animate: false });
      return;
    }

    const selectedPostcard = postcards.find((postcard) => postcard.id === selectedId);

    if (selectedPostcard) {
      map.flyTo([selectedPostcard.latitude, selectedPostcard.longitude], 8, {
        duration: 0.75
      });
      return;
    }

    const bounds = L.latLngBounds(
      postcards.map((postcard) => [postcard.latitude, postcard.longitude] as [number, number])
    );

    map.fitBounds(bounds, {
      animate: false,
      maxZoom: 5,
      padding: [56, 56]
    });
  }, [map, postcards, selectedId]);

  return null;
}

function CoordinatePicker({
  onInteract,
  onPickCoordinates
}: Pick<PostcardMapProps, "onInteract" | "onPickCoordinates">) {
  useMapEvents({
    click(event) {
      onInteract();
      onPickCoordinates({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6))
      });
    },
    dragstart() {
      onInteract();
    }
  });

  return null;
}

function PostcardClusterLayer({
  postcards,
  selectedId,
  onSelect
}: Pick<PostcardMapProps, "postcards" | "selectedId" | "onSelect">) {
  const map = useMap();
  const markersRef = useRef<Map<number, L.Marker>>(new Map());
  const postcardsRef = useRef<Postcard[]>(postcards);
  postcardsRef.current = postcards;

  // Build (and rebuild) the cluster group when the set of postcards changes.
  useEffect(() => {
    const group = L.markerClusterGroup({
      chunkedLoading: true,
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: createClusterIcon
    });

    const markers = new Map<number, L.Marker>();
    const layers: L.Marker[] = [];

    for (const postcard of postcards) {
      const marker = L.marker([postcard.latitude, postcard.longitude], {
        icon: createPostcardIcon(postcard.imageUrl, postcard.id === selectedId)
      });
      marker.bindPopup(buildPopupHtml(postcard), { closeButton: false });
      marker.on("click", () => onSelect(postcard.id));
      markers.set(postcard.id, marker);
      layers.push(marker);
    }

    group.addLayers(layers);
    map.addLayer(group);
    markersRef.current = markers;

    return () => {
      map.removeLayer(group);
      group.clearLayers();
      markers.clear();
    };
    // Selection is handled by the effect below so we don't rebuild 1,000+
    // markers every time the highlighted postcard changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, postcards, onSelect]);

  // Cheaply restyle only the selection highlight.
  useEffect(() => {
    for (const postcard of postcardsRef.current) {
      const marker = markersRef.current.get(postcard.id);
      if (marker) {
        marker.setIcon(createPostcardIcon(postcard.imageUrl, postcard.id === selectedId));
      }
    }
  }, [selectedId]);

  return null;
}

export function PostcardMap({
  postcards,
  selectedId,
  onSelect,
  onPickCoordinates,
  onInteract
}: PostcardMapProps) {
  return (
    <div className="map-frame">
      <MapContainer
        center={defaultCenter}
        className="leaflet-map"
        zoom={2}
        zoomControl={false}
        worldCopyJump
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        <MapViewportController postcards={postcards} selectedId={selectedId} />
        <CoordinatePicker onInteract={onInteract} onPickCoordinates={onPickCoordinates} />
        <PostcardClusterLayer postcards={postcards} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
