'use client'

import { useEffect, useRef } from 'react'
import { SaleComp } from '@/types/deal'

interface Props {
  comps: SaleComp[]
  selected: Set<number>
  onToggle: (i: number) => void
  subjectLat?: number
  subjectLng?: number
  subjectAddress?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? ''

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  sold:    { bg: '#10b981', color: '#fff', label: 'Sold'    },
  active:  { bg: '#3b82f6', color: '#fff', label: 'Active'  },
  pending: { bg: '#f59e0b', color: '#fff', label: 'Pending' },
}

function zillowUrl(address: string) {
  // Zillow search URL that pre-fills the address
  return `https://www.zillow.com/homes/${encodeURIComponent(address)}_rb/`
}

function satelliteImgUrl(lat: number, lng: number) {
  if (!MAPBOX_TOKEN) return null
  // Mapbox Static Images API — satellite view with a pin, 280×160
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/pin-s+00c8ff(${lng},${lat})/${lng},${lat},17,0/280x160@2x?access_token=${MAPBOX_TOKEN}`
}

function buildPopupHtml(comp: SaleComp, index: number): string {
  const s = STATUS_STYLE[comp.status] ?? STATUS_STYLE.sold
  // Prefer MLS photo, fall back to satellite
  const mlsPhoto = comp.photos?.[0] ?? null
  const imgUrl = mlsPhoto ?? (comp.lat && comp.lng ? satelliteImgUrl(comp.lat, comp.lng) : null)
  const imgLabel = mlsPhoto ? 'MLS Photo' : 'Satellite View'
  const price = comp.status === 'sold' ? comp.salePrice : comp.listPrice
  const priceLabel = comp.status === 'sold' ? 'Sale Price' : 'List Price'
  const ppsf = comp.pricePerSqft > 0 ? comp.pricePerSqft : (price && comp.sqft ? Math.round(price / comp.sqft) : 0)
  const zillow = zillowUrl(comp.address)

  const dateLabel = comp.status === 'sold' ? 'Sold' : 'Listed'
  const dateVal = comp.soldDate
    ? new Date(comp.soldDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:280px;max-width:300px;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
      ${imgUrl ? `
        <div style="position:relative">
          <img src="${imgUrl}" width="280" height="130" style="width:100%;height:130px;object-fit:cover;display:block" onerror="this.parentElement.style.display='none'" />
          <div style="position:absolute;top:8px;left:8px;background:${s.bg};color:${s.color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:0.05em">${s.label}</div>
          <div style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.7);color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px">#${index + 1}</div>
          <div style="position:absolute;bottom:6px;left:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:9px;padding:1px 6px;border-radius:4px">${imgLabel}</div>
        </div>
      ` : `
        <div style="background:#1e293b;padding:6px 10px;display:flex;align-items:center;justify-content:space-between">
          <span style="background:${s.bg};color:${s.color};font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px">${s.label}</span>
          <span style="color:#94a3b8;font-size:10px;font-weight:700">#${index + 1}</span>
        </div>
      `}

      <div style="padding:10px 12px">
        <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:6px;line-height:1.3">${comp.address}</div>

        <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap">
          ${comp.bedrooms   ? `<span style="background:#1e293b;color:#94a3b8;font-size:10px;padding:2px 7px;border-radius:4px">${comp.bedrooms}bd</span>` : ''}
          ${comp.bathrooms  ? `<span style="background:#1e293b;color:#94a3b8;font-size:10px;padding:2px 7px;border-radius:4px">${comp.bathrooms}ba</span>` : ''}
          ${comp.sqft       ? `<span style="background:#1e293b;color:#94a3b8;font-size:10px;padding:2px 7px;border-radius:4px">${comp.sqft.toLocaleString()} sqft</span>` : ''}
          ${comp.yearBuilt  ? `<span style="background:#1e293b;color:#94a3b8;font-size:10px;padding:2px 7px;border-radius:4px">Built ${comp.yearBuilt}</span>` : ''}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px">
          <div>
            <div style="font-size:10px;color:#64748b;margin-bottom:1px">${priceLabel}</div>
            <div style="font-size:18px;font-weight:800;color:#00c8ff">$${(price ?? 0).toLocaleString()}</div>
          </div>
          <div style="text-align:right">
            ${ppsf ? `<div style="font-size:11px;color:#94a3b8">$${ppsf.toLocaleString()}<span style="font-size:9px">/sqft</span></div>` : ''}
            ${comp.distance ? `<div style="font-size:10px;color:#64748b">${comp.distance.toFixed(2)} mi away</div>` : ''}
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:10px;padding:6px 0;border-top:1px solid rgba(255,255,255,0.06);border-bottom:1px solid rgba(255,255,255,0.06)">
          <div style="flex:1">
            <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">${dateLabel}</div>
            <div style="font-size:11px;color:#e2e8f0;font-weight:600">${dateVal}</div>
          </div>
          ${comp.daysOnMarket != null ? `
          <div style="flex:1">
            <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Days on Market</div>
            <div style="font-size:11px;color:#e2e8f0;font-weight:600">${comp.daysOnMarket} days</div>
          </div>` : ''}
          ${comp.hasPool ? `
          <div style="flex:1">
            <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em">Pool</div>
            <div style="font-size:11px;color:#10b981;font-weight:600">Yes</div>
          </div>` : ''}
        </div>

        <a href="${zillow}" target="_blank" rel="noopener noreferrer"
          style="display:flex;align-items:center;justify-content:center;gap:6px;background:#1667b6;color:#fff;font-size:11px;font-weight:700;padding:7px 12px;border-radius:6px;text-decoration:none;letter-spacing:0.02em">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          View on Zillow
        </a>
      </div>
    </div>
  `
}

function buildSubjectPopupHtml(address: string, lat: number, lng: number): string {
  const imgUrl = satelliteImgUrl(lat, lng)
  const zillow = zillowUrl(address)
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-width:280px;max-width:300px;background:#0f172a;border-radius:10px;overflow:hidden;border:1px solid rgba(0,200,255,0.3)">
      ${imgUrl ? `
        <div style="position:relative">
          <img src="${imgUrl}" width="280" height="130" style="width:100%;height:130px;object-fit:cover;display:block" onerror="this.parentElement.style.display='none'" />
          <div style="position:absolute;top:8px;left:8px;background:linear-gradient(135deg,#00c8ff,#0099cc);color:#000;font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px">SUBJECT</div>
        </div>
      ` : ''}
      <div style="padding:10px 12px">
        <div style="font-size:12px;font-weight:700;color:#f1f5f9;margin-bottom:8px">${address}</div>
        <a href="${zillow}" target="_blank" rel="noopener noreferrer"
          style="display:flex;align-items:center;justify-content:center;gap:6px;background:#1667b6;color:#fff;font-size:11px;font-weight:700;padding:7px 12px;border-radius:6px;text-decoration:none">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          View on Zillow
        </a>
      </div>
    </div>
  `
}

// Leaflet needs to be loaded client-side only
export default function CompMap({ comps, selected, onToggle, subjectLat, subjectLng, subjectAddress }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapRef.current) return
    let active = true

    import('leaflet').then(L => {
      if (!active || !mapRef.current) return

      const container = mapRef.current as any
      if (container && container._leaflet_id) {
        container._leaflet_id = undefined
      }
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        markersRef.current = []
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const centerComp = comps.find(c => c.lat && c.lng)
      const centerLat = subjectLat ?? centerComp?.lat ?? 32.7767
      const centerLng = subjectLng ?? centerComp?.lng ?? -96.7970

      const map = L.map(mapRef.current!, { zoomControl: true, scrollWheelZoom: true })
      leafletMapRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Subject property pin
      if (subjectLat && subjectLng) {
        const subjectIcon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 10px rgba(0,200,255,0.55))">
            <div style="background:linear-gradient(135deg,#00c8ff,#0099cc);width:40px;height:40px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;display:flex;align-items:center;justify-content:center">
              <svg style="transform:rotate(45deg)" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z" fill="rgba(255,255,255,0.25)" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
                <rect x="9" y="13" width="6" height="8" rx="0.5" fill="white"/>
              </svg>
            </div>
          </div>`,
          iconSize: [40, 48],
          iconAnchor: [20, 48],
        })
        const popupHtml = subjectAddress
          ? buildSubjectPopupHtml(subjectAddress, subjectLat, subjectLng)
          : '<b style="color:#0f172a">Subject Property</b>'

        L.marker([subjectLat, subjectLng], { icon: subjectIcon })
          .addTo(map)
          .bindPopup(popupHtml, { maxWidth: 320, className: 'dealmind-popup' })
      }

      // Comp markers
      comps.forEach((comp, i) => {
        if (!comp.lat || !comp.lng) return
        const isSelected = selected.has(i)
        const icon = makeIcon(L, isSelected, i + 1)
        const marker = L.marker([comp.lat, comp.lng], { icon })
          .addTo(map)
          .bindPopup(buildPopupHtml(comp, i), { maxWidth: 320, className: 'dealmind-popup' })
          .on('click', () => onToggle(i))
        markersRef.current.push(marker)
      })

      // Fit bounds to all markers
      const allCoords: [number, number][] = [
        ...(subjectLat && subjectLng ? [[subjectLat, subjectLng] as [number, number]] : []),
        ...comps.filter(c => c.lat && c.lng).map(c => [c.lat!, c.lng!] as [number, number]),
      ]
      if (allCoords.length > 0) {
        map.fitBounds(allCoords, { padding: [40, 40] })
      } else {
        map.setView([centerLat, centerLng], 13)
      }
    })

    return () => {
      active = false
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
      markersRef.current = []
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update marker icons when selection changes
  useEffect(() => {
    if (!leafletMapRef.current) return
    import('leaflet').then(L => {
      markersRef.current.forEach((marker, i) => {
        marker.setIcon(makeIcon(L, selected.has(i), i + 1))
      })
    })
  }, [selected])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .dealmind-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          border: none !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
          border-radius: 10px !important;
          padding: 0 !important;
        }
        .dealmind-popup .leaflet-popup-content {
          margin: 0 !important;
          width: auto !important;
        }
        .dealmind-popup .leaflet-popup-tip-container {
          display: none;
        }
        .dealmind-popup .leaflet-popup-close-button {
          color: #94a3b8 !important;
          font-size: 18px !important;
          top: 6px !important;
          right: 8px !important;
          z-index: 10;
        }
      `}</style>
      <div ref={mapRef} style={{ height: 420, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }} />
    </>
  )
}

function makeIcon(L: any, isSelected: boolean, num: number) {
  const bg = isSelected ? '#00c8ff' : '#64748b'
  const color = isSelected ? '#000' : '#fff'
  return L.divIcon({
    className: '',
    html: `<div style="background:${bg};color:${color};width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${num}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}
