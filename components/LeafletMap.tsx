import React, { useEffect, useRef, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates, DeliveryLocation, DriverState, LocationType } from '../types';
import { LocateFixed, Navigation as NavigationIcon, Compass } from 'lucide-react';
import { ITAJAI_CENTER } from '../constants';

// Standard icons
const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: iconUrl,
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const hqIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png',
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const theaterIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Helper to calculate bearing between two points
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

const calculateBearing = (start: Coordinates, end: Coordinates): number => {
    const startLat = toRad(start.lat);
    const startLng = toRad(start.lng);
    const destLat = toRad(end.lat);
    const destLng = toRad(end.lng);

    const y = Math.sin(destLng - startLng) * Math.cos(destLat);
    const x = Math.cos(startLat) * Math.sin(destLat) -
              Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    
    let brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
};

// Create a custom Truck Icon using SVG inside a DivIcon
// Note: We removed the 'custom-driver-icon' CSS class to rely purely on JS interpolation for movement
const createDriverIcon = (colorHex: string, isSelected: boolean = false, isNavMode: boolean = false) => {
    // Solid professional look
    // If selected (current user), adds a distinctive border, ring, and scale up
    const borderClass = isSelected ? 'border-amber-400 ring-4 ring-amber-400/40 z-50' : 'border-white';
    // In Nav Mode, we don't scale up as much to keep center clear, and we might rotate the icon to fixed UP position later?
    // Actually, in CSS rotation of map, markers rotate WITH map. 
    // To keep car pointing UP while map rotates, we need to counter-rotate the icon or use a fixed overlay.
    // For now, let's keep the standard look but make it clear.
    const scaleClass = isSelected ? 'scale-125' : 'scale-100';
    const shadowClass = isSelected ? 'shadow-2xl' : 'shadow-lg';
    
    // If Nav Mode (Map rotating), we want the truck to look like it's driving "UP" the screen.
    // Since the map is rotated -Bearing, the map's North is tilted.
    // The truck icon is painted on the map tile.
    
    return new L.DivIcon({
        className: '', // Empty class name to avoid CSS transition conflicts
        html: `
            <div style="background-color: ${colorHex};" class="w-10 h-10 rounded-full border-2 ${borderClass} ${shadowClass} flex items-center justify-center relative transform transition-transform duration-300 ${scaleClass}">
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="white" stroke="none">
                    <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
                </svg>
                ${isSelected ? '<div class="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white animate-pulse"></div>' : ''}
                <div class="absolute -bottom-1 w-2 h-2 bg-white rotate-45 transform origin-center border-r border-b border-gray-300"></div>
            </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 44], // Anchored at bottom center
        popupAnchor: [0, -40]
    });
};

interface MapProps {
    locations: DeliveryLocation[];
    drivers: DriverState[];
    currentDriverId?: string; 
}

// --- SMOOTH MARKER COMPONENT ---
// This handles the animation frame loop to interpolate position
const SmoothDriverMarker: React.FC<{
    position: [number, number];
    icon: L.DivIcon;
    zIndexOffset: number;
    rotation?: number; // Counter-rotation for nav mode
    children?: React.ReactNode;
}> = ({ position, icon, zIndexOffset, rotation = 0, children }) => {
    const markerRef = useRef<L.Marker>(null);
    const prevPos = useRef(position);
    const requestRef = useRef<number | null>(null);

    // We store the initial position in state to pass to the Marker component ONCE.
    const [initialRenderPos] = useState(position);

    useEffect(() => {
        const start = prevPos.current;
        const end = position;

        // 1. If positions are identical, do nothing
        if (start[0] === end[0] && start[1] === end[1]) return;

        // 2. Calculate distance. If jump is too large (e.g. initial load or teleport), skip animation
        const dist = Math.sqrt(Math.pow(end[0] - start[0], 2) + Math.pow(end[1] - start[1], 2));
        if (dist > 0.01) { // Approx 1km jump
            if (markerRef.current) markerRef.current.setLatLng(end);
            prevPos.current = end;
            return;
        }

        // 3. Animation Loop
        const startTime = performance.now();
        const duration = 1500; // 1.5 seconds to interpolate (matches GPS throttle roughly)

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Linear interpolation for reliable tracking
            const lat = start[0] + (end[0] - start[0]) * progress;
            const lng = start[1] + (end[1] - start[1]) * progress;

            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
                
                // Note: We don't rotate the marker instance itself here via Leaflet API
                // because we are rotating the DIV inside the icon definition or the map container.
            }

            if (progress < 1) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                prevPos.current = end;
            }
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
        };
    }, [position[0], position[1]]);

    return (
        <Marker 
            ref={markerRef} 
            position={initialRenderPos} // Only used for mounting
            icon={icon} 
            zIndexOffset={zIndexOffset}
        >
            {children}
        </Marker>
    );
};

// Custom Control Component for "My Location" & "Navigation Mode"
const MapControls: React.FC<{ 
    coords: Coordinates; 
    isNavMode: boolean;
    toggleNavMode: () => void;
}> = ({ coords, isNavMode, toggleNavMode }) => {
    const map = useMap();

    const handleCenter = () => {
        if (coords.lat !== 0 && coords.lng !== 0) {
            map.flyTo([coords.lat, coords.lng], isNavMode ? 17 : 15, {
                animate: true,
                duration: 1.0
            });
        }
    };

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control flex flex-col gap-3 mb-24 mr-4 pointer-events-auto">
                <button 
                    onClick={toggleNavMode}
                    className={`w-12 h-12 flex items-center justify-center shadow-lg border-2 rounded-full transition-all active:scale-95 ${isNavMode ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                    title="Modo Navegação (Girar Mapa)"
                >
                    {isNavMode ? <NavigationIcon className="w-6 h-6 fill-current" /> : <Compass className="w-6 h-6" />}
                </button>

                <button 
                    onClick={handleCenter}
                    className="bg-white hover:bg-slate-50 text-slate-700 w-12 h-12 flex items-center justify-center shadow-lg border-2 border-slate-300 rounded-full transition-transform active:scale-95"
                    title="Minha Localização"
                >
                    <LocateFixed className="w-6 h-6 text-emerald-600" />
                </button>
            </div>
        </div>
    );
};

export const LeafletMap: React.FC<MapProps> = ({ locations, drivers, currentDriverId }) => {
    // Determine map center securely
    const activeDriver = drivers.find(d => d.id === currentDriverId);
    
    // State for Map Rotation
    const [rotation, setRotation] = useState(0);
    const [isNavMode, setIsNavMode] = useState(false);
    const prevCoordsRef = useRef<Coordinates | null>(null);

    // Calculate Bearing and Rotation when driver moves
    useEffect(() => {
        if (!activeDriver) return;
        
        const current = activeDriver.currentCoords;
        const previous = prevCoordsRef.current;

        if (previous && (current.lat !== previous.lat || current.lng !== previous.lng)) {
            // Only update bearing if moving fast enough to be significant
            // Approx check: 0.00001 deg is ~1 meter.
            const dist = Math.sqrt(Math.pow(current.lat - previous.lat, 2) + Math.pow(current.lng - previous.lng, 2));
            
            if (dist > 0.00005) { // Moved > 5 meters
                const bearing = calculateBearing(previous, current);
                // Smooth rotation updates could be added here, currently instant step
                setRotation(bearing);
            }
        }
        prevCoordsRef.current = current;
    }, [activeDriver?.currentCoords]);

    // Default center priority: Active Driver -> First Driver -> Itajaí Center
    const centerPos: [number, number] = activeDriver 
        ? [activeDriver.currentCoords.lat, activeDriver.currentCoords.lng]
        : (drivers.length > 0 
            ? [drivers[0].currentCoords.lat, drivers[0].currentCoords.lng] 
            : [ITAJAI_CENTER.lat, ITAJAI_CENTER.lng]);

    const getIconForType = (type: LocationType) => {
        switch (type) {
            case LocationType.HEADQUARTERS: return hqIcon;
            case LocationType.THEATER: return theaterIcon;
            default: return DefaultIcon;
        }
    }

    const getDriverColor = (index: number) => {
        const colors = ['#2563eb', '#f97316', '#16a34a', '#dc2626', '#9333ea', '#db2777']; 
        return colors[index % colors.length];
    }
    
    return (
        <div className="w-full h-full relative overflow-hidden bg-slate-200">
             {/* 
                Map Container Wrapper for Rotation
                We rotate the DIV containing the map. 
                When rotated, corners would be cut off if width/height were 100%.
                So we scale it up (1.5x) when in Nav Mode to ensure coverage.
             */}
            <div 
                className="w-full h-full transition-transform duration-700 ease-in-out"
                style={{
                    transform: isNavMode ? `scale(1.5) rotate(${-rotation}deg)` : 'rotate(0deg)',
                    transformOrigin: 'center center'
                }}
            >
                <MapContainer 
                    center={centerPos} 
                    zoom={13} 
                    scrollWheelZoom={true} 
                    className="w-full h-full z-0"
                    zoomControl={false} // Disable default top-left zoom to look cleaner
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    {/* Controls (Rendered as children of Map but fixed via CSS) */}
                    {activeDriver && (
                        <MapControls 
                            coords={activeDriver.currentCoords} 
                            isNavMode={isNavMode}
                            toggleNavMode={() => setIsNavMode(!isNavMode)}
                        />
                    )}

                    {/* Static Locations */}
                    {locations.map(loc => (
                        <Marker 
                            key={loc.id} 
                            position={[loc.coords.lat, loc.coords.lng]} 
                            icon={getIconForType(loc.type)}
                        >
                            {/* Counter-rotate popups/markers if needed, but for simplicity we let them spin with map */}
                            <Popup>
                                <div className="p-1">
                                    <strong className="block text-sm mb-1">{loc.name}</strong>
                                    <span className="text-xs text-slate-500">{loc.address}</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Drivers and Routes */}
                    {drivers.map((driver, index) => {
                        const isSelected = driver.id === currentDriverId;
                        return (
                            <React.Fragment key={driver.id}>
                                {/* Driver Marker - Uses SmoothDriverMarker for interpolation */}
                                <SmoothDriverMarker
                                    position={[driver.currentCoords.lat, driver.currentCoords.lng]}
                                    icon={createDriverIcon(getDriverColor(index), isSelected, isNavMode)}
                                    zIndexOffset={isSelected ? 10000 : 1000}
                                    rotation={isNavMode && isSelected ? rotation : 0} // Could be used to keep icon UP
                                >
                                     <Popup>
                                        <div className="p-1 min-w-[120px]">
                                            <strong className="block text-sm mb-1 text-slate-900 flex items-center gap-1">
                                                {driver.name}
                                                {isSelected && <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-200">VOCÊ</span>}
                                            </strong>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${driver.isMoving ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {driver.isMoving ? 'Em Movimento' : 'Parado'}
                                            </span>
                                            {driver.route.length > 0 && (
                                                <div className="mt-2 text-xs text-slate-500 border-t pt-1">
                                                    Destino: <b>{driver.route[0].name}</b>
                                                </div>
                                            )}
                                        </div>
                                    </Popup>
                                </SmoothDriverMarker>

                                {/* Route Line */}
                                {driver.route.length > 0 && (
                                    <Polyline 
                                        positions={[
                                            [driver.currentCoords.lat, driver.currentCoords.lng] as [number, number],
                                            ...driver.route.map(r => [r.coords.lat, r.coords.lng] as [number, number])
                                        ]}
                                        pathOptions={{ 
                                            color: getDriverColor(index), 
                                            weight: isSelected ? 5 : 3, 
                                            opacity: isSelected ? 0.9 : 0.5, 
                                            dashArray: driver.isMoving ? undefined : '5, 10' 
                                        }}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
            
            {/* Overlay Compass for Admin/User context when Nav Mode is ON (Optional visual aid) */}
            {isNavMode && (
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-black/50 backdrop-blur text-white px-3 py-1 rounded-full text-xs font-bold z-50 pointer-events-none flex items-center gap-2">
                    <NavigationIcon className="w-3 h-3" />
                    <span>MODO NAVEGAÇÃO</span>
                </div>
            )}
        </div>
    );
};