import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, DeliveryLocation, DriverState, LocationType } from '../types';
import { LocateFixed, Navigation as NavigationIcon, Compass } from 'lucide-react';
import { ITAJAI_CENTER } from '../constants';

const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

// Custom icons
const hqIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Numbered Marker Creator
const createNumberedIcon = (number: number, isNext: boolean) => {
    const color = isNext ? '#10b981' : '#64748b';
    const size = isNext ? 'w-8 h-8' : 'w-6 h-6';
    const fontSize = isNext ? 'text-sm' : 'text-xs';
    
    return L.divIcon({
        className: 'numbered-marker',
        html: `
            <div class="${size} rounded-full bg-white border-2 flex items-center justify-center shadow-lg transform transition-transform duration-300" style="border-color: ${color}; color: ${color}; font-weight: 800;">
                <span class="${fontSize}">${number}</span>
                ${isNext ? '<div class="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>' : ''}
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
    });
};

const MapFixer: React.FC<{ trigger: any }> = ({ trigger }) => {
    const map = useMap();
    useEffect(() => {
        const resizeInterval = setInterval(() => map.invalidateSize(), 100);
        const timeout = setTimeout(() => {
            clearInterval(resizeInterval);
            map.invalidateSize();
        }, 1000);
        return () => {
            clearInterval(resizeInterval);
            clearTimeout(timeout);
        };
    }, [map, trigger]);
    return null;
};

const createDriverIcon = (colorHex: string, isSelected: boolean) => {
    return new L.DivIcon({
        className: 'driver-marker',
        html: `
            <div style="background-color: ${colorHex};" class="w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center relative transform transition-all duration-500 ${isSelected ? 'scale-125 ring-4 ring-emerald-400/30' : ''}">
                <svg viewBox="0 0 24 24" class="w-6 h-6 fill-white">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    });
};

interface MapProps {
    locations: DeliveryLocation[];
    drivers: DriverState[];
    currentDriverId?: string; 
    isLayoutCompact?: boolean;
}

export const LeafletMap: React.FC<MapProps> = ({ locations, drivers, currentDriverId, isLayoutCompact }) => {
    const activeDriver = drivers.find(d => d.id === currentDriverId);
    
    const centerPos: [number, number] = activeDriver 
        ? [activeDriver.currentCoords.lat, activeDriver.currentCoords.lng]
        : (drivers.length > 0 ? [drivers[0].currentCoords.lat, drivers[0].currentCoords.lng] : [ITAJAI_CENTER.lat, ITAJAI_CENTER.lng]);

    const getDriverColor = (index: number) => ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#9333ea', '#db2777'][index % 6];
    
    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-200">
            <MapContainer center={centerPos} zoom={14} scrollWheelZoom={true} className="w-full h-full" zoomControl={false}>
                <MapFixer trigger={isLayoutCompact} />
                <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Fixed Locations */}
                {locations.map(loc => (
                    <Marker key={loc.id} position={[loc.coords.lat, loc.coords.lng]} icon={loc.type === LocationType.HEADQUARTERS ? hqIcon : L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconSize: [20, 32], iconAnchor: [10, 32] })}>
                        <Popup><span className="font-bold">{loc.name}</span></Popup>
                    </Marker>
                ))}

                {/* Drivers and their numbered routes */}
                {drivers.map((driver, index) => {
                    const isSelected = driver.id === currentDriverId;
                    const color = getDriverColor(index);
                    
                    return (
                        <React.Fragment key={driver.id}>
                            <Marker position={[driver.currentCoords.lat, driver.currentCoords.lng]} icon={createDriverIcon(color, isSelected)} zIndexOffset={isSelected ? 1000 : 500}>
                                <Popup><div className="font-bold">{driver.name}</div></Popup>
                            </Marker>
                            
                            {/* Numbered Route Markers for Current Driver or all if admin */}
                            {driver.route.map((stop, stopIdx) => (
                                <Marker 
                                    key={`${driver.id}-stop-${stop.id}`} 
                                    position={[stop.coords.lat, stop.coords.lng]} 
                                    icon={createNumberedIcon(stopIdx + 1, isSelected && stopIdx === 0)}
                                    zIndexOffset={isSelected ? 2000 : 100}
                                />
                            ))}

                            {driver.route.length > 0 && (
                                <Polyline 
                                    positions={[[driver.currentCoords.lat, driver.currentCoords.lng] as [number, number], ...driver.route.map(r => [r.coords.lat, r.coords.lng] as [number, number])]}
                                    pathOptions={{ color, weight: isSelected ? 5 : 3, opacity: isSelected ? 0.8 : 0.3, dashArray: isSelected ? '10, 10' : '' }}
                                />
                            )}
                        </React.Fragment>
                    );
                })}
            </MapContainer>
        </div>
    );
};
