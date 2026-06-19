import { useEffect, useState } from 'react';
import { parseCoords, reverseGeocode } from '@/utils/geocode';

/**
 * Renders a stored location string as a human-readable place name. If the value is
 * raw "lat,lng" it reverse-geocodes (cached) in the background; otherwise it shows
 * the text as-is. Admins should never see coordinates.
 */
export default function ReadableLocation({ value, className }: { value?: string | null; className?: string }) {
  const coords = parseCoords(value);
  const [text, setText] = useState<string>(coords ? 'Locating…' : (value || '—'));

  useEffect(() => {
    let cancelled = false;
    const c = parseCoords(value);
    if (c) {
      reverseGeocode(c[0], c[1]).then(s => { if (!cancelled) setText(s); });
    } else {
      setText(value || '—');
    }
    return () => { cancelled = true; };
  }, [value]);

  return <span className={className}>{text}</span>;
}
