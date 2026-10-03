'use client';

import { useEffect, useRef, useState } from 'react';

export type VenueSelection = {
  venue_id: string | null;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
};

declare global {
  interface Window { google?: any; }
}

let mapsPromise: Promise<void> | null = null;
function loadMaps(key: string) {
  if (window.google?.maps?.importLibrary) return Promise.resolve();
  if (!mapsPromise) mapsPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-google-maps]');
    if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Google Maps could not be loaded.')), { once: true }); return; }
    const script = document.createElement('script');
    script.dataset.googleMaps = 'true';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps could not be loaded. Check your API key and Google Cloud setup.'));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export function GoogleVenuePicker({ cityName, value, onChange }: { cityName: string; value: VenueSelection; onChange: (value: VenueSelection) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapHost = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;
  const [mapsError, setMapsError] = useState('');
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    let alive = true;
    if (!key) return;
    loadMaps(key).then(async () => {
      if (!alive || !host.current || !mapHost.current) return;
      await window.google!.maps.importLibrary('places');
      await window.google!.maps.importLibrary('maps');
      const center = value.latitude != null && value.longitude != null ? { lat: value.latitude, lng: value.longitude } : { lat: 20.5937, lng: 78.9629 };
      map.current = new window.google!.maps.Map(mapHost.current, { center, zoom: value.latitude != null ? 15 : 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      if (value.latitude != null && value.longitude != null) setMarker(value.latitude, value.longitude, false);
      const autocomplete = new window.google!.maps.places.PlaceAutocompleteElement({ includedRegionCodes: ['in'], ...(cityName ? { locationBias: undefined } : {}) });
      autocomplete.setAttribute('placeholder', cityName ? `Search venues in ${cityName}` : 'Search venues and addresses');
      host.current.replaceChildren(autocomplete);
      autocomplete.addEventListener('gmp-select', async (event: any) => {
        const place = event.placePrediction.toPlace();
        await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
        const location = place.location;
        if (!location) return;
        const lat = location.lat(), lng = location.lng();
        onChangeRef.current({ venue_id: null, name: place.displayName ?? '', address: place.formattedAddress ?? '', latitude: lat, longitude: lng, google_place_id: place.id ?? null });
        map.current.setCenter({ lat, lng }); map.current.setZoom(16); setMarker(lat, lng, true);
      });
      map.current.addListener('click', (event: any) => { if (event.latLng) setMarker(event.latLng.lat(), event.latLng.lng(), true); });
    }).catch((error: unknown) => { if (alive) setMapsError(error instanceof Error ? error.message : 'Google Maps could not be loaded.'); });
    function setMarker(lat: number, lng: number, updateValue: boolean) {
      const position = { lat, lng };
      if (!marker.current) {
        marker.current = new window.google!.maps.Marker({ map: map.current, position, draggable: true });
        marker.current.addListener('dragend', (event: any) => {
          const nextLat = event.latLng.lat(), nextLng = event.latLng.lng();
          onChangeRef.current({ ...valueRef.current, latitude: nextLat, longitude: nextLng, venue_id: null });
        });
      } else marker.current.setPosition(position);
      if (updateValue) onChangeRef.current({ ...valueRef.current, latitude: lat, longitude: lng, venue_id: null });
    }
    return () => { alive = false; };
  // Keep the Maps instance stable; selected places update the map directly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return <div className="venue-picker">
    {key ? <>
      <div ref={host} className="venue-autocomplete" />
      {mapsError && <p className="field-help" role="alert">{mapsError} You can enter venue details below.</p>}
      <div ref={mapHost} className="venue-map" aria-label="Selected venue map preview" />
      <p className="field-help">Select a result to place the pin, then drag it or click the map to adjust its location.</p>
    </> : <p className="field-help" role="status">Google Maps is not configured yet. Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable place search; venue details can still be entered below.</p>}
  </div>;
}
