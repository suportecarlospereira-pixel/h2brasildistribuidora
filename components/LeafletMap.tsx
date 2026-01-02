// NOME DO ARQUIVO: components/LeafletMap.tsx
import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { DeliveryLocation, DriverState } from '../types';
import { ITAJAI_CENTER } from '../constants';
import { Navigation as NavIcon, LocateFixed } from 'lucide-react';

// --- ESTILOS CSS PARA O MAPA (Pulse Effect) ---
const pulseStyles = `
@keyframes pulse-ring {
  0% { transform: scale(0.33); opacity: 0.8; }
  80%, 100% { opacity: 0; }
}
@keyframes pulse-dot {
  0% { transform: scale(0.8); }
  50% { transform: scale(1); }
  100% { transform: scale(0.8); }
}
.pulsing-marker { position: relative; }
.pulsing-marker:before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  border-radius: 50%;
  border: 10px solid #10b981; /* Emerald-500 */
  box-shadow: 0 0 15px #10b981;
  animation: pulse-ring 1.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
  z-index: -1;
}
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = pulseStyles;
document.head.appendChild(styleSheet);

// --- FUNÇÃO AUXILIAR: CALCULAR ROTAÇÃO ---
const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const startLatRad = (startLat * Math.PI) / 180;
    const startLngRad = (startLng * Math.PI) / 180;
    const destLatRad = (destLat * Math.PI) / 180;
    const destLngRad = (destLng * Math.PI) / 180;
    const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
    const x = Math.cos(startLatRad) * Math.sin(destLatRad) - Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
    let brng = Math.atan2(y, x);
    brng = (brng * 180) / Math.PI;
    return (brng + 360) % 360;
};

// --- ÍCONES ---
const hqIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

// Ícone Animado para o Destino Atual
const createPulsingTargetIcon = () => {
    return L.divIcon({
        className: 'pulsing-marker',
        html: `<div style="width: 20px; height: 20px; background: #10b981; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10],
    });
};

const createNumberedIcon = (number: number, isNext: boolean) => {
    const color = isNext ? '#10b981' : '#64748b';
    const size = isNext ? 'w-8 h-8' : 'w-6 h-6';
    return L.divIcon({
        className: 'numbered-marker',
        html: `<div class="${size} rounded-full bg-white border-2 flex items-center justify-center shadow-lg transform transition-transform hover:scale-110" style="border-color: ${color}; color: ${color}; font-weight: 800;"><span class="${isNext ? 'text-sm' : 'text-xs'}">${number}</span></div>`,
        iconSize: [32, 32], iconAnchor: [16, 16],
    });
};

const createDriverIcon = (colorHex: string, isSelected: boolean, rotation: number) => {
    return new L.DivIcon({
        className: 'driver-marker',
        html: `
            <div style="transform: rotate(${rotation}deg); transition: transform 0.5s linear;" class="w-12 h-12 flex items-center justify-center relative">
                <div style="background-color: ${colorHex};" class="w-10 h-10 rounded-full border-2 border-white shadow-xl flex items-center justify-center relative transition-all duration-300 ${isSelected ? 'scale-110 ring-4 ring-emerald-400/50 z-50' : 'opacity-90'}">
                    <svg viewBox="0 0 24 24" class="w-6 h-6 fill-white drop-shadow-md" style="transform: rotate(0deg);">
                        <path d="M12 2L4.5 20.29C4.17 21.1 4.96 21.94 5.79 21.65L12 19.5L18.21 21.65C19.04 21.94 19.83 21.1 19.5 20.29L12 2Z" />
                    </svg>
                </div>
            </div>
        `,
        iconSize: [48, 48], iconAnchor: [24, 24],
    });
};

// --- COMPONENTE: ROTA INTELIGENTE ---
const SmartRoutePolyline: React.FC<{ driverPos: [number, number], stops: DeliveryLocation[], color: string, isSelected: boolean }> = ({ driverPos, stops, color, isSelected }) => {
    const [staticRoutePositions, setStaticRoutePositions] = useState<[number, number][]>([]);
    
    useEffect(() => {
        if (!stops || stops.length < 2) { setStaticRoutePositions([]); return; }
        if (!isSelected) { setStaticRoutePositions(stops.map(s => [s.coords.lat, s.coords.lng])); return; }

        const fetchRoute = async () => {
            try {
                const coordsString = stops.map(s => `${s.coords.lng},${s.coords.lat}`).join(';');
                const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`);
                const data = await response.json();
                if (data.routes?.[0]) {
                    setStaticRoutePositions(data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]]));
                }
            } catch (e) { setStaticRoutePositions(stops.map(s => [s.coords.lat, s.coords.lng])); }
        };
        fetchRoute();
    }, [stops, isSelected]);

    if (!isSelected || stops.length === 0) return null;

    return (
        <>
            <Polyline positions={[driverPos, [stops[0].coords.lat, stops[0].coords.lng]]} pathOptions={{ color: color, weight: 3, opacity: 0.8, dashArray: '10, 10', className: 'animate-pulse' }} />
            {staticRoutePositions.length > 0 && (
                <>
                    <Polyline positions={staticRoutePositions} pathOptions={{ color: 'white', weight: 8, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }} />
                    <Polyline positions={staticRoutePositions} pathOptions={{ color, weight: 5, opacity: 1 }} />
                </>
            )}
        </>
    );
};

// --- COMPONENTE: CONTROLADOR DO MAPA ---
const MapController: React.FC<{ center: [number, number], zoom: number, driverId?: string, isFollowing: boolean, onDragStart: () => void }> = ({ center, zoom, driverId, isFollowing, onDragStart }) => {
    const map = useMap();
    useMapEvents({ dragstart: onDragStart, touchstart: onDragStart });
    useEffect(() => { if (isFollowing) map.flyTo(center, zoom, { duration: 1.5, easeLinearity: 0.25 }); }, [center, zoom, map, isFollowing]);
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
    
    const [driverBearings, setDriverBearings] = useState<Record<string, number>>({});
    const prevCoordsRef = useRef<Record<string, {lat: number, lng: number}>>({});
    const [isFollowing, setIsFollowing] = useState(true);

    useEffect(() => {
        const newBearings = { ...driverBearings };
        let changed = false;
        drivers.forEach(driver => {
            const prev = prevCoordsRef.current[driver.id];
            if (prev) {
                const dist = Math.sqrt(Math.pow(driver.currentCoords.lat - prev.lat, 2) + Math.pow(driver.currentCoords.lng - prev.lng, 2));
                if (dist > 0.0001) { 
                    const bearing = calculateBearing(prev.lat, prev.lng, driver.currentCoords.lat, driver.currentCoords.lng);
                    newBearings[driver.id] = bearing;
                    changed = true;
                }
            } else { newBearings[driver.id] = 0; }
            prevCoordsRef.current[driver.id] = driver.currentCoords;
        });
        if (changed) setDriverBearings(newBearings);
    }, [drivers]);

    useEffect(() => { setIsFollowing(true); }, [currentDriverId]);
    
    const mapRef = useRef<L.Map>(null);
    useEffect(() => { if (mapRef.current) setTimeout(() => mapRef.current?.invalidateSize(), 400); }, [isLayoutCompact]);

    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-200">
            <MapContainer ref={mapRef} center={ITAJAI_CENTER} zoom={13} className="w-full h-full" zoomControl={false} scrollWheelZoom={true}>
                <MapController center={centerPos} zoom={16} driverId={currentDriverId} isFollowing={isFollowing && !!activeDriver} onDragStart={() => setIsFollowing(false)} />
                <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
                
                {locations.map(loc => {
                    // Verifica se este local é o destino atual do motorista ativo
                    const isNextStop = activeDriver?.route[0]?.id === loc.id;
                    
                    return (
                        <Marker 
                            key={loc.id} 
                            position={[loc.coords.lat, loc.coords.lng]} 
                            // Se for a próxima parada, usa o ícone pulsante
                            icon={loc.type === 'HEADQUARTERS' ? hqIcon : (isNextStop ? createPulsingTargetIcon() : L.icon({ 
                                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', 
                                iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] 
                            }))}
                            zIndexOffset={isNextStop ? 1000 : 0}
                        >
                            <Popup><div className="font-bold text-sm">{loc.name}</div><div className="text-[10px] uppercase text-slate-500">{loc.address}</div></Popup>
                        </Marker>
                    );
                })}

                {drivers.map((driver, index) => {
                    const isSelected = driver.id === currentDriverId;
                    const color = getDriverColor(index);
                    const rotation = driverBearings[driver.id] || 0;
                    return (
                        <React.Fragment key={driver.id}>
                            <SmartRoutePolyline driverPos={[driver.currentCoords.lat, driver.currentCoords.lng]} stops={driver.route} color={color} isSelected={isSelected} />
                            <Marker position={[driver.currentCoords.lat, driver.currentCoords.lng]} icon={createDriverIcon(color, isSelected, rotation)} zIndexOffset={isSelected ? 2000 : 500}>
                                <Popup><div className="font-bold">{driver.name}</div></Popup>
                            </Marker>
                            {/* Marcadores numerados apenas para as paradas subsequentes (2, 3...) a atual (1) já tem o pulso */}
                            {driver.route.map((stop, stopIdx) => {
                                if (stopIdx === 0 && isSelected) return null; // Não desenha número na primeira parada se estiver focado (já tem pulso)
                                return <Marker key={`${driver.id}-stop-${stop.id}`} position={[stop.coords.lat, stop.coords.lng]} icon={createNumberedIcon(stopIdx + 1, false)} zIndexOffset={isSelected ? 1500 : 100} />
                            })}
                        </React.Fragment>
                    );
                })}
            </MapContainer>
            {activeDriver && !isFollowing && (
                <button onClick={() => setIsFollowing(true)} className="absolute bottom-6 right-6 z-[400] bg-white text-slate-700 p-3 rounded-full shadow-xl border border-slate-100 active:scale-95 transition-all flex items-center gap-2 font-bold text-xs animate-in fade-in slide-in-from-bottom-4">
                    <LocateFixed className="w-4 h-4 text-emerald-600" /> Recentralizar
                </button>
            )}
        </div>
    );
};
