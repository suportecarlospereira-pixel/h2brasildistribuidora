// NOME DO ARQUIVO: components/LeafletMap.tsx
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DeliveryLocation, DriverState, LocationType } from '../types';
import { ITAJAI_CENTER } from '../constants';

const shadowUrl = '[https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png](https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png)';

// --- CONTROLLER INTELIGENTE ---
// Só move a câmera se o motorista selecionado MUDAR. 
// Isso evita que o mapa fique "dançando" enquanto você tenta ver outra coisa.
const MapController: React.FC<{ center: [number, number], zoom: number, driverId?: string }> = ({ center, zoom, driverId }) => {
    const map = useMap();
    const lastDriverId = useRef<string | undefined>();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        const hasDriverChanged = driverId !== lastDriverId.current;
        
        if (hasDriverChanged || isFirstLoad.current) {
            // Animação suave
            map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 });
            lastDriverId.current = driverId;
            isFirstLoad.current = false;
        }
    }, [center, zoom, map, driverId]);

    return null;
};

// ÍCONES OTIMIZADOS
const hqIcon = new L.Icon({
    iconUrl: '[https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png](https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png)',
    shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const createNumberedIcon = (number: number, isNext: boolean) => {
    const color = isNext ? '#10b981' : '#64748b';
    const size = isNext ? 'w-8 h-8' : 'w-6 h-6';
    return L.divIcon({
        className: 'numbered-marker',
        html: `
            <div class="${size} rounded-full bg-white border-2 flex items-center justify-center shadow-lg transform transition-transform" style="border-color: ${color}; color: ${color}; font-weight: 800;">
                <span class="${isNext ? 'text-sm' : 'text-xs'}">${number}</span>
            </div>
        `,
        iconSize: [32, 32], iconAnchor: [16, 16],
    });
};

const createDriverIcon = (colorHex: string, isSelected: boolean) => {
    return new L.DivIcon({
        className: 'driver-marker',
        html: `
            <div style="background-color: ${colorHex};" class="w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center relative transition-transform ${isSelected ? 'scale-110 ring-4 ring-emerald-400/50' : ''}">
                <svg viewBox="0 0 24 24" class="w-6 h-6 fill-white">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
            </div>
        `,
        iconSize: [40, 40], iconAnchor: [20, 20],
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
    
    // Define o centro: Ou o motorista selecionado, ou o centro da cidade
    const centerPos: [number, number] = activeDriver 
        ? [activeDriver.currentCoords.lat, activeDriver.currentCoords.lng]
        : [ITAJAI_CENTER.lat, ITAJAI_CENTER.lng];

    const getDriverColor = (index: number) => ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#9333ea', '#db2777'][index % 6];
    
    // Fix para o mapa renderizar corretamente ao redimensionar a tela
    const mapRef = useRef<L.Map>(null);
    useEffect(() => {
        if (mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 400);
    }, [isLayoutCompact]);

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-200">
            <MapContainer ref={mapRef} center={ITAJAI_CENTER} zoom={13} className="w-full h-full" zoomControl={false}>
                <MapController center={centerPos} zoom={15} driverId={currentDriverId} />
                <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {/* Locais Fixos */}
                {locations.map(loc => (
                    <Marker key={loc.id} position={[loc.coords.lat, loc.coords.lng]} icon={loc.type === LocationType.HEADQUARTERS ? hqIcon : L.icon({ iconUrl: '[https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png](https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png)', iconSize: [20, 32], iconAnchor: [10, 32] })}>
                        <Popup><span className="font-bold">{loc.name}</span></Popup>
                    </Marker>
                ))}

                {/* Motoristas */}
                {drivers.map((driver, index) => {
                    const isSelected = driver.id === currentDriverId;
                    const color = getDriverColor(index);
                    
                    return (
                        <React.Fragment key={driver.id}>
                            <Marker position={[driver.currentCoords.lat, driver.currentCoords.lng]} icon={createDriverIcon(color, isSelected)} zIndexOffset={isSelected ? 1000 : 500}>
                                <Popup><div className="font-bold">{driver.name}</div></Popup>
                            </Marker>
                            
                            {driver.route.map((stop, stopIdx) => (
                                <Marker key={`${driver.id}-stop-${stop.id}`} position={[stop.coords.lat, stop.coords.lng]} icon={createNumberedIcon(stopIdx + 1, isSelected && stopIdx === 0)} zIndexOffset={isSelected ? 2000 : 100} />
                            ))}

                            {driver.route.length > 0 && (
                                <Polyline positions={[[driver.currentCoords.lat, driver.currentCoords.lng] as [number, number], ...driver.route.map(r => [r.coords.lat, r.coords.lng] as [number, number])]} pathOptions={{ color, weight: isSelected ? 5 : 3, opacity: isSelected ? 0.8 : 0.4, dashArray: isSelected ? '10, 10' : '' }} />
                            )}
                        </React.Fragment>
                    );
                })}
            </MapContainer>
        </div>
    );
};
