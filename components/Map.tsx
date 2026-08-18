'use client';

/**
 * Map component using Leaflet + OpenStreetMap
 * Shows pins for nearby nursing rooms and allows selection
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { VenueWithDetails } from '@/lib/supabase';

interface MapProps {
  userLat: number;
  userLng: number;
  /** Timestamp bumped by an explicit user request to recentre. */
  recenterAt?: number;
  venues: VenueWithDetails[];
  selectedVenueId?: string;
  onVenueSelect: (venue: VenueWithDetails) => void;
}

export function Map({
  userLat,
  userLng,
  recenterAt = 0,
  venues,
  selectedVenueId,
  onVenueSelect,
}: MapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<globalThis.Map<string, L.Marker>>(new globalThis.Map());
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Leaflet caches the container size and only rechecks on a window resize, so
  // anything that changes the container's height without resizing the window —
  // expanding the filter strip, for one — leaves the tiles laid out for the old
  // height, with pins drawn outside them.
  useEffect(() => {
    const container = document.getElementById('map');
    if (!container || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Initialize map - Focus on Singapore
  useEffect(() => {
    if (!mapRef.current) {
      mapRef.current = L.map('map', {
        center: [userLat, userLng],
        zoom: 14,
        attributionControl: true,
        maxBounds: [
          [1.15, 103.5], // Southwest corner
          [1.55, 104.1], // Northeast corner
        ],
        maxBoundsViscosity: 1.0, // Prevent dragging outside bounds
        minZoom: 11, // Minimum zoom to see all of Singapore
        maxZoom: 18, // Maximum zoom level
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      // User location marker with pulsing effect
      const userMarkerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
          <defs>
            <filter id="userGlow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            <style>
              @keyframes pulse {
                0%, 100% { r: 10; opacity: 0.8; }
                50% { r: 14; opacity: 0.4; }
              }
            </style>
          </defs>
          <!-- Pulsing outer circle -->
          <circle cx="16" cy="16" r="10" fill="#3b82f6" opacity="0.2"/>
          <!-- Main circle with glow -->
          <circle cx="16" cy="16" r="8" fill="#3b82f6" stroke="white" stroke-width="2" filter="url(#userGlow)"/>
          <!-- Center dot -->
          <circle cx="16" cy="16" r="4" fill="white"/>
        </svg>
      `.trim();

      userMarkerRef.current = L.marker([userLat, userLng], {
        icon: L.icon({
          iconUrl: `data:image/svg+xml;base64,${btoa(userMarkerSvg)}`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
          popupAnchor: [0, -16],
        }),
      })
        .addTo(mapRef.current)
        .bindPopup('📍 Your Location');
    } else {
      // Move the "you are here" marker, but leave the view where the user put it.
      // Recentring here is what made the map snap back on every GPS tick.
      userMarkerRef.current?.setLatLng([userLat, userLng]);
    }
  }, [userLat, userLng]);

  // Recentre only when explicitly asked (location button, postal code search).
  useEffect(() => {
    if (recenterAt && mapRef.current) {
      mapRef.current.setView([userLat, userLng], 15);
    }
    // userLat/userLng intentionally excluded: this must fire on request only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterAt]);

  // Create custom icon with nursing symbol
  const createVenueIcon = (isSelected: boolean, isVerified: boolean) => {
    // Teal for verified rooms, soft coral for community submissions. Coral rather
    // than a hard alert red: an unverified room is a lead worth following, not an error.
    const baseColor = isVerified ? '#0D9488' : '#F87171';
    const glowColor = isSelected ? '#0F766E' : baseColor;

    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.3"/>
          </filter>
          <linearGradient id="pinGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${baseColor};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${baseColor};stop-opacity:0.8" />
          </linearGradient>
        </defs>

        <!-- Glow effect -->
        <circle cx="24" cy="20" r="20" fill="${glowColor}" opacity="0.15" filter="url(#glow)"/>

        <!-- Pin shape with gradient -->
        <path d="M24 0C10.7 0 0 10.7 0 24c0 12.2 10.9 20.8 24 32 13.1-11.2 24-19.8 24-32 0-13.3-10.7-24-24-24z"
              fill="url(#pinGradient)" filter="url(#shadow)"/>

        <!-- White border -->
        <path d="M24 0C10.7 0 0 10.7 0 24c0 12.2 10.9 20.8 24 32 13.1-11.2 24-19.8 24-32 0-13.3-10.7-24-24-24z"
              fill="none" stroke="white" stroke-width="2"/>

        <!-- Nursing symbol: Heart + Medical cross -->
        <g transform="translate(24, 16)">
          <!-- Heart shape -->
          <path d="M0-3 C-3-6 -6-5 -6-2 C-6 0 -3 3 0 5 C3 3 6 0 6-2 C6-5 3-6 0-3Z"
                fill="white" opacity="0.9"/>
          <!-- Cross overlay -->
          <line x1="0" y1="-1" x2="0" y2="2" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="-1" y1="0.5" x2="1" y2="0.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
        </g>

        <!-- Status indicator (top right) -->
        ${isSelected ? '<circle cx="36" cy="6" r="6" fill="#3b82f6" stroke="white" stroke-width="1.5"/>' : ''}
      </svg>
    `.trim();

    return L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgString)}`,
      iconSize: [48, 56],
      iconAnchor: [24, 56],
      popupAnchor: [0, -56],
      className: isSelected ? 'selected-marker' : '',
    });
  };

  // Update venue markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear old markers
    markersRef.current.forEach(marker => {
      mapRef.current!.removeLayer(marker);
    });
    markersRef.current.clear();

    // Add new markers
    venues.forEach(venue => {
      const isSelected = venue.id === selectedVenueId;
      const isVerified = !venue.source || venue.source !== 'USER_SUBMITTED'; // teal if verified, coral if community-submitted

      const marker = L.marker([venue.latitude, venue.longitude], {
        icon: createVenueIcon(isSelected, isVerified),
      })
        .addTo(mapRef.current!)
        .bindPopup(`<strong>${venue.name}</strong><br/>${venue.address}<br/>${(venue.distance_meters / 1000).toFixed(1)}km away`)
        .on('click', () => onVenueSelect(venue));

      // Add hover effect
      marker.on('mouseover', () => {
        marker.setIcon(createVenueIcon(true, isVerified));
      });
      marker.on('mouseout', () => {
        marker.setIcon(createVenueIcon(isSelected, isVerified));
      });

      markersRef.current.set(venue.id, marker);
    });
  }, [venues, selectedVenueId, userLat, userLng, onVenueSelect]);

  return (
    <div id="map" className="absolute inset-0 rounded-lg overflow-hidden pointer-events-auto" style={{ zIndex: 0 }} />
  );
}
