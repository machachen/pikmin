"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents
} from "react-leaflet";

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

function createPostcardIcon(imageUrl: string, isSelected: boolean) {
  return L.divIcon({
    className: "postcard-pin-shell",
    html: `
      <div class="postcard-pin${isSelected ? " is-selected" : ""}">
        <img src="${imageUrl}" alt="" />
      </div>
    `,
    iconSize: [58, 58],
    iconAnchor: [29, 58],
    popupAnchor: [0, -48]
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

export function PostcardMap({
  postcards,
  selectedId,
  onSelect,
  onPickCoordinates,
  onInteract
}: PostcardMapProps) {
  return (
    <div className="map-frame">
      <MapContainer center={defaultCenter} className="leaflet-map" zoom={2} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapViewportController postcards={postcards} selectedId={selectedId} />
        <CoordinatePicker onInteract={onInteract} onPickCoordinates={onPickCoordinates} />

        {postcards.map((postcard) => (
          <Marker
            eventHandlers={{
              click: () => onSelect(postcard.id)
            }}
            icon={createPostcardIcon(postcard.imageUrl, postcard.id === selectedId)}
            key={postcard.id}
            position={[postcard.latitude, postcard.longitude]}
          >
            <Popup>
              <div className="popup-card">
                <strong>{postcard.title}</strong>
                <p>{postcard.description}</p>
                <small>
                  {[postcard.city, postcard.region, postcard.country].filter(Boolean).join(", ")}
                </small>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="map-help">Click anywhere on the map to pre-fill the add form.</div>
    </div>
  );
}
