import { useState, useCallback } from 'react';
import { useLoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';

const DEFAULT_CENTER = { lat: 0.3476, lng: 32.5825 }; // Kampala
const MAP_CONTAINER_CLASS = 'w-full rounded-xl overflow-hidden border-2 border-border h-[300px]';

interface LocationPickerProps {
  onLocationChange: (lat: number, lng: number, address: string) => void;
}

export function LocationPicker({ onLocationChange }: LocationPickerProps) {
  const [markerPos, setMarkerPos] = useState(DEFAULT_CENTER);
  const [address, setAddress] = useState('');
  const [addressStatus, setAddressStatus] = useState<'loading' | 'done' | 'error'>('loading');

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  });

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      setAddressStatus('loading');
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === 'OK' && results?.[0]) {
          const resolved = results[0].formatted_address;
          setAddress(resolved);
          setAddressStatus('done');
          onLocationChange(lat, lng, resolved);
        } else {
          const fallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setAddress(fallback);
          setAddressStatus('error');
          onLocationChange(lat, lng, fallback);
        }
      });
    },
    [onLocationChange]
  );

  const onMapLoad = useCallback(
    (map: google.maps.Map) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            const newPos = { lat: latitude, lng: longitude };
            setMarkerPos(newPos);
            map.panTo(newPos);
            reverseGeocode(latitude, longitude);
          },
          () => reverseGeocode(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      } else {
        reverseGeocode(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
      }
    },
    [reverseGeocode]
  );

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  if (loadError) {
    return (
      <div className="w-full rounded-xl border-2 border-border h-[300px] flex items-center justify-center text-sm text-muted-foreground">
        Failed to load map
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full rounded-xl border-2 border-border h-[300px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <GoogleMap
        mapContainerClassName={MAP_CONTAINER_CLASS}
        center={DEFAULT_CENTER}
        zoom={16}
        onLoad={onMapLoad}
        options={{ clickableIcons: false }}
      >
        <Marker position={markerPos} draggable onDragEnd={onMarkerDragEnd} />
      </GoogleMap>
      <div className="text-sm text-muted-foreground flex items-start gap-2 min-h-[1.5rem]">
        {addressStatus === 'loading' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0 mt-0.5" />
            <span>Finding address…</span>
          </>
        ) : (
          <span className="line-clamp-2" title={address}>
            📍 {address || 'Drag the pin to set your location'}
          </span>
        )}
      </div>
    </div>
  );
}
