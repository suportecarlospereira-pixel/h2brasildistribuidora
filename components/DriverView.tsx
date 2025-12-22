import React, { useState } from 'react';
import { DeliveryLocation, DriverState, LocationType } from '../types';
import { LOCATIONS_DB } from '../constants';
import { optimizeRouteOrder } from '../services/geminiService';
import { Truck, Navigation, CheckCircle, Circle, MapPin, Loader2, ExternalLink, Package } from 'lucide-react';
import { H2Logo } from './Logo';

interface DriverViewProps {
    driverState: DriverState;
    updateRoute: (newRoute: DeliveryLocation[]) => void;
    toggleMovement: () => void;
    completeDelivery: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({ 
    driverState, 
    updateRoute, 
    toggleMovement,
    completeDelivery 
}) => {
    const [availableLocations, setAvailableLocations] = useState<DeliveryLocation[]>(
        LOCATIONS_DB.filter(l => l.type !== LocationType.HEADQUARTERS)
    );
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isOptimizing, setIsOptimizing] = useState(false);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleStartRoute = async () => {
        setIsOptimizing(true);
        const selectedLocations = availableLocations.filter(l => selectedIds.has(l.id));
        
        // FIX: Use real driver coordinates as start point instead of assuming HQ
        // This ensures the optimization considers where the driver actually IS right now.
        const startPoint: DeliveryLocation = {
            id: 'current-pos',
            name: 'Minha Localização',
            address: 'Posição GPS',
            type: LocationType.DRIVER,
            coords: driverState.currentCoords,
            status: 'COMPLETED'
        };

        const optimizedIds = await optimizeRouteOrder(startPoint, selectedLocations);
        
        const orderedRoute = optimizedIds
            .map(id => selectedLocations.find(l => l.id === id))
            .filter((l): l is DeliveryLocation => !!l);
            
        updateRoute(orderedRoute);
        setIsOptimizing(false);
    };

    const openGoogleMaps = () => {
        if (driverState.route.length === 0) return;

        // Origem: GPS Atual do Motorista
        const origin = `${driverState.currentCoords.lat},${driverState.currentCoords.lng}`;

        // Limite de lote: Google Maps aceita bem até ~9 waypoints, mas para UX mobile
        // limitamos a 5 paradas intermediárias + 1 destino final (total 6 próximos passos).
        // Isso evita URLs gigantes e foca no trabalho imediato.
        const maxBatchSize = 6;
        const nextStops = driverState.route.slice(0, maxBatchSize);

        // O último ponto desse lote será o "Destino" da navegação
        const destinationStop = nextStops[nextStops.length - 1];
        const destination = `${destinationStop.coords.lat},${destinationStop.coords.lng}`;

        // Os pontos entre a origem e o destino são "Waypoints" (Paradas)
        const intermediateStops = nextStops.slice(0, -1);
        
        let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;

        if (intermediateStops.length > 0) {
            const waypoints = intermediateStops
                .map(loc => `${loc.coords.lat},${loc.coords.lng}`)
                .join('|');
            url += `&waypoints=${waypoints}`;
        }
        
        url += `&travelmode=driving`;
        window.open(url, '_blank');
    };

    const currentTarget = driverState.route[0];

    return (
        <div className="flex flex-col h-full w-full bg-white">
            {/* Header */}
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md">
                <div className="flex items-center gap-3 mb-1">
                    <div className="bg-white rounded px-2 py-1">
                        <H2Logo className="h-6 w-auto" showText={false} variant="light" />
                    </div>
                    <div className="border-l border-slate-700 pl-3">
                        <h2 className="text-sm font-bold tracking-tight">MOTORISTA</h2>
                        <p className="text-slate-400 text-xs font-medium truncate max-w-[150px]">{driverState.name}</p>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20 md:pb-4">
                
                {driverState.route.length > 0 ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Active Status Card */}
                        <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-2xl p-5 shadow-sm">
                            <h3 className="font-bold text-emerald-900 mb-3 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Em Rota
                            </h3>
                            <div className="mb-5">
                                <p className="text-sm text-emerald-600 font-medium mb-1">Próximo Destino:</p>
                                <p className="text-xl font-extrabold text-slate-800 leading-tight">{currentTarget.name}</p>
                                <p className="text-sm text-slate-500 mt-1">{currentTarget.address}</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    onClick={toggleMovement}
                                    className={`col-span-1 py-3.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm ${driverState.isMoving ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'}`}
                                >
                                    {driverState.isMoving ? 'Pausar' : 'Iniciar'}
                                </button>
                                <button 
                                    onClick={completeDelivery}
                                    className="col-span-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-blue-200"
                                >
                                    Confirmar Entrega
                                </button>
                                
                                <button 
                                    onClick={openGoogleMaps}
                                    className="col-span-2 mt-2 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-95"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    Abrir GPS (Google Maps)
                                </button>
                            </div>
                        </div>

                        {/* Route List */}
                        <div className="pt-2">
                             <div className="flex items-center gap-2 mb-3">
                                <Package className="w-4 h-4 text-slate-400" />
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fila de Entregas ({driverState.route.length})</h4>
                             </div>
                            <div className="space-y-0 relative before:absolute before:left-[19px] before:top-2 before:bottom-4 before:w-0.5 before:bg-slate-200 ml-1">
                                {driverState.route.map((loc, idx) => (
                                    <div key={loc.id} className="relative pl-10 py-3 group">
                                        <div className={`absolute left-[13px] top-4 w-3.5 h-3.5 rounded-full border-2 z-10 bg-white ${idx === 0 ? 'border-emerald-500 ring-4 ring-emerald-50' : 'border-slate-300'}`}></div>
                                        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm group-hover:border-emerald-200 transition-colors">
                                            <p className={`text-sm font-bold ${idx === 0 ? 'text-emerald-900' : 'text-slate-700'}`}>{loc.name}</p>
                                            <p className="text-xs text-slate-400 truncate">{loc.address}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-1">Planejamento Diário</h3>
                            <p className="text-sm text-slate-500 mb-4">Toque nos locais para adicionar à rota de hoje.</p>
                            
                            <div className="space-y-2 max-h-[40vh] md:max-h-80 overflow-y-auto pr-1">
                                {availableLocations.map(loc => (
                                    <div 
                                        key={loc.id}
                                        onClick={() => toggleSelection(loc.id)}
                                        className={`p-4 rounded-xl border cursor-pointer flex items-center justify-between transition-all active:scale-[0.98] ${selectedIds.has(loc.id) ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-slate-200'}`}
                                    >
                                        <div className="overflow-hidden mr-3">
                                            <p className="font-bold text-sm text-slate-800 truncate">{loc.name}</p>
                                            <p className="text-xs text-slate-500 truncate">{loc.address}</p>
                                        </div>
                                        {selectedIds.has(loc.id) ? (
                                            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 fill-emerald-100" />
                                        ) : (
                                            <Circle className="w-6 h-6 text-slate-300 shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-900 border border-blue-100 flex gap-3 items-start">
                            <div className="bg-blue-100 p-1 rounded text-blue-600 shrink-0">
                                <Loader2 className="w-4 h-4" />
                            </div>
                            <div>
                                <strong className="block font-bold mb-0.5">Otimização Inteligente</strong>
                                A rota será calculada a partir da sua <u>localização atual</u> para economizar tempo.
                            </div>
                        </div>

                        <button 
                            disabled={selectedIds.size === 0 || isOptimizing}
                            onClick={handleStartRoute}
                            className="w-full py-4 bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95"
                        >
                            {isOptimizing ? (
                                <><Loader2 className="w-5 h-5 animate-spin" /> Otimizando...</>
                            ) : (
                                <><MapPin className="w-5 h-5" /> Iniciar Rota Otimizada</>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};