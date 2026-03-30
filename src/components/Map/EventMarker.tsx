'use client';

import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { useMemo, useRef } from 'react';
import type { Event } from '@/types/events';

interface EventMarkerProps {
  event: Event;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-AT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function EventMarker({ event, isSelected, isHovered, onClick }: EventMarkerProps) {
  const markerRef = useRef<L.Marker>(null);

  const icon = useMemo(() => {
    const isActive = isSelected || isHovered;

    if (event.image_url) {
      return L.divIcon({
        className: '',
        html: `<div class="event-marker ${isActive ? 'active' : ''}" style="background-image: url('${event.image_url}')"></div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });
    }

    const letter = event.title.charAt(0).toUpperCase();
    return L.divIcon({
      className: '',
      html: `<div class="event-marker event-marker-no-image ${isActive ? 'active' : ''}">${letter}</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, [event.image_url, event.title, isSelected, isHovered]);

  if (!event.latitude || !event.longitude) return null;

  return (
    <Marker
      ref={markerRef}
      position={[event.latitude, event.longitude]}
      icon={icon}
      eventHandlers={{
        mouseover: () => {
          markerRef.current?.openPopup();
        },
        mouseout: () => {
          // Small delay so user can move mouse to popup
          setTimeout(() => {
            const popup = markerRef.current?.getPopup();
            const popupEl = popup?.getElement();
            if (popupEl && !popupEl.matches(':hover')) {
              markerRef.current?.closePopup();
            }
          }, 300);
        },
      }}
    >
      <Popup closeButton={false} autoPan={false}>
        <div className="w-[260px] event-popup-content">
          {event.image_url && (
            <div
              className="w-full h-[130px] bg-cover bg-center rounded-t-lg"
              style={{ backgroundImage: `url('${event.image_url}')` }}
            />
          )}
          <div className="p-3">
            <h3 className="font-semibold text-sm text-slate-800 mb-1 line-clamp-2">
              {event.title}
            </h3>
            <p className="text-xs text-slate-500 mb-1">
              {formatDate(event.start_date)}
            </p>
            {event.location_name && (
              <p className="text-xs text-slate-500 mb-1.5 truncate">
                {event.location_name}
              </p>
            )}
            {event.price_text && (
              <p className="text-xs font-medium text-blue-600 mb-2">
                {event.price_text}
              </p>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                markerRef.current?.closePopup();
                onClick();
              }}
              className="w-full text-xs bg-blue-600 text-white rounded-lg py-2 hover:bg-blue-700 transition-colors font-medium"
            >
              Details anzeigen
            </button>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
