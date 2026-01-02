// NOME DO ARQUIVO: components/LeafletMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DeliveryLocation, DriverState } from '../types';
import { ITAJAI_CENTER } from '../constants';

// --- ÍCONES (Mantidos do seu código original) ---
const hqIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const createNumberedIcon = (number: number, isNext: boolean) => {
    const color = isNext ? '#10b981' : '#64748b'; // Emerald-500 ou Slate-500
    const size = isNext ? 'w-8 h-8' : 'w-6 h-6';
    const fontSize = isNext ? 'text-sm' : 'text-xs';
    
    return L.divIcon({
        className: 'numbered-marker',
        html: `<div class="${size} rounded-full bg-white border-2 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110" style="border-color: ${color}; color: ${color}; font-weight: 800;"><span class="${fontSize}">${number}</span></div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
    });
};

const createDriverIcon = (colorHex: string, isSelected: boolean) => {
    return new L.DivIcon({
        className: 'driver-marker',
        html: `<div style="background-color: ${colorHex};" class="w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center relative transition-all duration-500 ${isSelected ? 'scale-125 ring-4 ring-emerald-400/50 z-50' : 'opacity-90'}">
                <svg viewBox="0 0 24 24" class="w-6 h-6 fill-white drop-shadow-md"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
                ${isSelected ? '<span class="absolute -top-1 -right-1 flex h-3 w-3"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>' : ''}
               </div>`,
        iconSize: [40, 40], iconAnchor: [20, 20],
    });
};

// --- COMPONENTE DE ROTA INTELIGENTE (NOVO) ---
// Busca a geometria real da rua usando OSRM
const SmartRoutePolyline: React.FC<{ driverPos: [number, number], stops: DeliveryLocation[], color: string, isSelected: boolean }> = ({ driverPos, stops, color, isSelected }) => {
    const [routePositions, setRoutePositions] = useState<[number, number][]>([]);
    
    useEffect(() => {
        if (!stops || stops.length === 0) {
            setRoutePositions([]);
            return;
        }

        // Se não estiver selecionado, usa linha reta para economizar performance e API
        if (!isSelected) {
            setRoutePositions([driverPos, ...stops.map(s => [s.coords.lat, s.coords.lng] as [number, number])]);
            return;
        }

        // Debounce simples ou busca direta
        const fetchRoute = async () => {
            try {
                // OSRM aceita coordenadas no formato: lon,lat;lon,lat
                const coordsString = `${driverPos[1]},${driverPos[0]};` + stops.map(s => `${s.coords.lng},${s.coords.lat}`).join(';');
                
                // Usando serviço público do OSRM (Para produção, considere hospedar o seu ou usar Mapbox)
                const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
                const data = await response.json();

                if (data.routes && data.routes[0]) {
                    // OSRM retorna GeoJSON [lon, lat], Leaflet precisa de [lat, lon]
                    const decodedCoords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
                    setRoutePositions(decodedCoords);
                }
            } catch (error) {
                // Fallback para linha reta em caso de erro
                console.warn("Falha ao buscar rota real, usando fallback.");
                setRoutePositions([driverPos, ...stops.map(s => [s.coords.lat, s.coords.lng] as [number, number])]);
            }
        };

        fetchRoute();
    }, [driverPos, stops, isSelected]);

    if (routePositions.length < 2) return null;

    return (
        <>
            {/* Linha de "Sombra" para dar destaque (Borda) */}
            <Polyline 
                positions={routePositions} 
                pathOptions={{ color: 'white', weight: isSelected ? 8 : 0, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} 
            />
            {/* Linha Principal */}
            <Polyline 
                positions={routePositions} 
                pathOptions={{ 
                    color, 
                    weight: isSelected ? 5 : 3, 
                    opacity: isSelected ? 1 : 0.6, 
                    dashArray: isSelected ? undefined : '5, 10', // Tracejado para rotas secundárias
                    lineCap: 'round', 
                    lineJoin: 'round' 
                }} 
            />
        </>
    );
};

const MapController: React.FC<{ center: [number, number], zoom: number, driverId?: string }> = ({ center, zoom, driverId }) => {
    const map = useMap();
    const lastDriverId = useRef<string | undefined>();
    const isFirstLoad = useRef(true);

    useEffect(() => {
        const hasDriverChanged = driverId !== lastDriverId.current;
        if (hasDriverChanged || isFirstLoad.current) {
            map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 });
            lastDriverId.current = driverId;
            isFirstLoad.current = false;
        }
    }, [center, zoom, map, driverId]);

    return null;
};

interface MapProps {
    locations: DeliveryLocation[];
    drivers: DriverState[];
    currentDriverId?: string; 
    isLayoutCompact?: boolean;
}

export const LeafletMap: React.FC<MapProps> = ({ locations, drivers, currentDriverId, isLayoutCompact }) => {
    const activeDriver = drivers.find(d => d.id === currentDriverId);
    const centerPos: [number, number] = activeDriver ? [activeDriver.currentCoords.lat, activeDriver.currentCoords.lng] : [ITAJAI_CENTER.lat, ITAJAI_CENTER.lng];
    const getDriverColor = (index: number) => ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#9333ea', '#db2777'][index % 6];
    
    const mapRef = useRef<L.Map>(null);
    useEffect(() => {
        if (mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 400);
    }, [isLayoutCompact]);

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-200">
            <MapContainer ref={mapRef} center={ITAJAI_CENTER} zoom={13} className="w-full h-full" zoomControl={false} scrollWheelZoom={true}>
                <MapController center={centerPos} zoom={15} driverId={currentDriverId} />
                <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
                {/* Locais Fixos (Pontos de Entrega) */}
                {locations.map(loc => {
                    const isNextStop = activeDriver?.route[0]?.id === loc.id;
                    
                    return (
                        <Marker 
                            key={loc.id} 
                            position={[loc.coords.lat, loc.coords.lng]} 
                            icon={loc.type === 'HEADQUARTERS' ? hqIcon : L.icon({ 
                                iconUrl: isNextStop ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png' : 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', 
                                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] 
                            })}
                            zIndexOffset={isNextStop ? 1000 : 0}
                        >
                            <Popup className="custom-popup">
                                <div className="p-1">
                                    <span className="font-bold text-slate-800 text-sm block">{loc.name}</span>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold">{loc.type}</span>
                                    <p className="text-[10px] text-slate-400 mt-1">{loc.address}</p>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Motoristas e suas Rotas */}
                {drivers.map((driver, index) => {
                    const isSelected = driver.id === currentDriverId;
                    const color = getDriverColor(index);
                    
                    return (
                        <React.Fragment key={driver.id}>
                            {/* Rota Inteligente (Street Routing) */}
                            <SmartRoutePolyline 
                                driverPos={[driver.currentCoords.lat, driver.currentCoords.lng]}
                                stops={driver.route}
                                color={color}
                                isSelected={isSelected}
                            />

                            {/* Marcador do Motorista */}
                            <Marker position={[driver.currentCoords.lat, driver.currentCoords.lng]} icon={createDriverIcon(color, isSelected)} zIndexOffset={isSelected ? 2000 : 500}>
                                <Popup><div className="font-bold text-sm">{driver.name}</div><div className="text-xs text-slate-500">{driver.status}</div></Popup>
                            </Marker>
                            
                            {/* Números das paradas */}
                            {driver.route.map((stop, stopIdx) => (
                                <Marker 
                                    key={`${driver.id}-stop-${stop.id}`} 
                                    position={[stop.coords.lat, stop.coords.lng]} 
                                    icon={createNumberedIcon(stopIdx + 1, isSelected && stopIdx === 0)} 
                                    zIndexOffset={isSelected ? 1500 : 100} 
                                />
                            ))}
                        </React.Fragment>
                    );
                })}
            </MapContainer>
        </div>
    );
};
