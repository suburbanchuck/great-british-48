'use client';

import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMapsAPI } from '@/lib/googleMaps';

type Prediction = { placeId: string; description: string };

export type PlaceResult = {
  name: string;
  formattedAddress: string;
  coords: { lat: number; lng: number } | null;
};

type GMPlaceResult = {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat(): number; lng(): number } };
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceResult) => void;
  placeholder?: string;
  inputClassName?: string;
};

export default function PlacesAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  inputClassName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const apiLoadedRef = useRef(false);

  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        serviceRef.current = new g.maps.places.AutocompleteService();
        apiLoadedRef.current = true;
      })
      .catch(() => { /* graceful fallback to plain text input */ });

    return () => clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setPredictions([]);
      }
    }
    function onScroll() {
      setShowDropdown(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  function positionDropdown() {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);

    if (!val.trim() || !apiLoadedRef.current || !serviceRef.current) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const { predictions: raw } = await serviceRef.current.getPlacePredictions({
          input: val,
          componentRestrictions: { country: 'gb' },
        }) as { predictions: Array<{ place_id: string; description: string }> };

        const next = (raw ?? []).slice(0, 5).map(p => ({
          placeId: p.place_id,
          description: p.description,
        }));
        setPredictions(next);
        if (next.length > 0) {
          positionDropdown();
          setShowDropdown(true);
        } else {
          setShowDropdown(false);
        }
      } catch {
        setPredictions([]);
        setShowDropdown(false);
      }
    }, 280);
  }

  async function handleSelect(prediction: Prediction) {
    onChange(prediction.description);
    setPredictions([]);
    setShowDropdown(false);

    if (!apiLoadedRef.current) {
      onPlaceSelect({ name: prediction.description, formattedAddress: prediction.description, coords: null });
      return;
    }

    try {
      const result = await new Promise<PlaceResult>(resolve => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = (window as any).google;
        const svc = new g.maps.places.PlacesService(document.createElement('div'));
        svc.getDetails(
          { placeId: prediction.placeId, fields: ['name', 'formatted_address', 'geometry'] },
          (place: GMPlaceResult | null, status: string) => {
            if (status === g.maps.places.PlacesServiceStatus.OK && place) {
              const coords = place.geometry?.location
                ? { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() }
                : null;
              resolve({
                name: place.name || prediction.description,
                formattedAddress: place.formatted_address || prediction.description,
                coords,
              });
            } else {
              resolve({ name: prediction.description, formattedAddress: prediction.description, coords: null });
            }
          },
        );
      });
      onPlaceSelect(result);
    } catch {
      onPlaceSelect({ name: prediction.description, formattedAddress: prediction.description, coords: null });
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => {
          if (predictions.length > 0) {
            positionDropdown();
            setShowDropdown(true);
          }
        }}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />

      {showDropdown && predictions.length > 0 &&
        createPortal(
          <ul
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              zIndex: 9999,
            }}
            className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden"
          >
            {predictions.map(p => (
              <li key={p.placeId} className="border-b border-gray-50 last:border-0">
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); handleSelect(p); }}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors leading-snug"
                >
                  {p.description}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      }
    </div>
  );
}
