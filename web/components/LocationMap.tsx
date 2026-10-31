"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { MerchantProfile } from "@/lib/types";

type Location = NonNullable<MerchantProfile["location"]>;

const pin = (color: string, glyph: string, size = 30) =>
  `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(10,31,60,.45);display:flex;align-items:center;justify-content:center;color:#fff;font:700 13px system-ui">${glyph}</div>`;

/**
 * Where the shop, its devices and the nearest cell site are. Tiles come from OpenStreetMap;
 * the coordinates themselves are simulated sample data.
 */
export function LocationMap({ location, height = "20rem" }: { location: Location; height?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let map: import("leaflet").Map | undefined;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el) return;
      map = L.map(el, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const icon = (color: string, glyph: string, size?: number) =>
        L.divIcon({ html: pin(color, glyph, size), className: "", iconSize: [size ?? 30, size ?? 30], iconAnchor: [(size ?? 30) / 2, (size ?? 30) / 2] });

      const points: [number, number][] = [];
      const shop: [number, number] = [location.shop.lat, location.shop.lng];
      points.push(shop);
      L.marker(shop, { icon: icon("#002e6e", "S", 36), title: "Shop", alt: "Shop location" }).addTo(map).bindPopup(`<strong>Shop</strong><br>${location.shop.label}`);

      const tower: [number, number] = [location.tower.lat, location.tower.lng];
      points.push(tower);
      L.marker(tower, { icon: icon("#5b6b82", "▲", 28), title: "Cell site", alt: "Cell site" }).addTo(map).bindPopup(location.tower.label);

      for (const d of location.devices) {
        const at: [number, number] = [d.lat, d.lng];
        points.push(at);
        const online = d.status === "ONLINE";
        L.marker(at, { icon: icon(online ? "#0b7a50" : "#b42d2d", d.kind === "SOUNDBOX" ? "♪" : "▭", 26), title: d.serial, alt: `${d.kind} ${d.serial}` })
          .addTo(map)
          .bindPopup(`<strong>${d.kind === "SOUNDBOX" ? "Soundbox" : "Card machine"} ${d.serial}</strong><br>${online ? "Online" : "Offline"}`);
        // its link to the cell site: solid when connected, dashed red when not
        L.polyline([at, tower], { color: online ? "#0b7a50" : "#b42d2d", weight: 3, opacity: 0.8, dashArray: online ? undefined : "6 8" }).addTo(map);
      }
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 17 });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [location]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-line">
      <div ref={ref} style={{ height }} role="region" aria-label="Map of the shop, its devices and the nearest cell site" className="bg-surface" />
      <span className="pointer-events-none absolute bottom-7 left-3 z-[500] rounded-full bg-card/95 px-2.5 py-1 text-[11px] font-medium text-muted shadow">Simulated location</span>
    </div>
  );
}
