import React, { useState } from 'react';
import { DeliveryLocation, DriverState, LocationType } from '../types';
import { LOCATIONS_DB } from '../constants';
import { optimizeRouteOrder, getRouteBriefingAudio } from '../services/geminiService';
import { Truck, Navigation, CheckCircle, Circle, MapPin, Loader2, ExternalLink, Package, Volume2, ShieldAlert } from 'lucide-react';
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
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleStartRoute = async () => {
        setIsOptimizing(true);
        setErrorMsg(null);
        try {
            const selectedLocations = LOCATIONS_DB.filter(l => selectedIds.has(l.id));
            const optimizedIds = await optimizeRouteOrder(driverState.currentCoords, selectedLocations);
            
            const orderedRoute = optimizedIds
                .map(id => selectedLocations.find(l => l.id === id))
                .filter((l): l is DeliveryLocation => !!l);
            
            if (orderedRoute.length === 0) throw new Error("Falha ao gerar rota.");
                
            updateRoute(orderedRoute);
        } catch (e) {
            setErrorMsg("Erro ao otimizar tráfego. Usando ordem padrão.");
            const fallback = LOCATIONS_DB.filter(l => selectedIds.has(l.id));
            updateRoute(fallback);
        } finally {
            setIsOptimizing(false);
        }
    };

    const playBriefing = async () => {
        const base64Audio = await getRouteBriefingAudio(driverState.name, driverState.route);
        if (base64Audio) {
            const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
            audio.play();
        }
    };

    const currentTarget = driverState.route[0];

    return (
        <div className="flex flex-col h-full w-full bg-white">
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <H2Logo className="h-6 w-auto" showText={false} variant="light" />
                    <div className="border-l border-slate-700 pl-3">
                        <h2 className="text-sm font-bold tracking-tight">MOTORISTA</h2>
                        <p className="text-slate-400 text-[10px] font-medium uppercase">{driverState.name}</p>
                    </div>
                </div>
                {driverState.route.length > 0 && (
                    <button onClick={playBriefing} className="bg-emerald-600 p-2 rounded-full hover:bg-emerald-500 transition-colors shadow-lg">
                        <Volume2 className="w-4 h-4 text-white" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
                {errorMsg && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-3 text-amber-800 text-xs font-bold animate-pulse">
                        <ShieldAlert className="w-4 h-4" /> {errorMsg}
                    </div>
                )}

                {driverState.route.length > 0 ? (
                    <div className="space-y-4">
                        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Truck className="w-20 h-20" />
                            </div>
                            <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">Próxima Parada #1</h3>
                            <p className="text-xl font-black mb-1 leading-tight">{currentTarget.name}</p>
                            <p className="text-xs text-slate-400 mb-6 truncate">{currentTarget.address}</p>
                            
                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                <button onClick={toggleMovement} className={`py-4 rounded-xl font-bold text-sm transition-all shadow-lg ${driverState.isMoving ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-emerald-600 text-white shadow-emerald-900/40'}`}>
                                    {driverState.isMoving ? 'Pausar' : 'Iniciar'}
                                </button>
                                <button onClick={completeDelivery} className="py-4 bg-white text-slate-900 rounded-xl font-bold text-sm shadow-lg active:scale-95">
                                    Concluir
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                             <div className="flex items-center justify-between mb-2">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cronograma de Entrega</h4>
                                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-bold">{driverState.route.length} restantes</span>
                             </div>
                             {driverState.route.map((loc, idx) => (
                                <div key={loc.id} className="flex items-center gap-4 bg-white border border-slate-100 p-3 rounded-xl hover:shadow-md transition-all">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-bold text-sm truncate ${idx === 0 ? 'text-slate-900' : 'text-slate-400'}`}>{loc.name}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{loc.address}</p>
                                    </div>
                                    {idx === 0 && <Navigation className="w-4 h-4 text-emerald-500 animate-bounce" />}
                                </div>
                             ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-300">
                            <h3 className="font-bold text-slate-800 mb-1">Montar Rota do Dia</h3>
                            <p className="text-xs text-slate-500 mb-6">Selecione os destinos e a IA fará o resto.</p>
                            
                            <div className="grid grid-cols-1 gap-2">
                                {LOCATIONS_DB.filter(l => l.type !== LocationType.HEADQUARTERS).map(loc => (
                                    <div 
                                        key={loc.id}
                                        onClick={() => toggleSelection(loc.id)}
                                        className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center justify-between transition-all ${selectedIds.has(loc.id) ? 'bg-emerald-50 border-emerald-500 scale-[1.02]' : 'bg-white border-slate-100'}`}
                                    >
                                        <div className="overflow-hidden pr-4">
                                            <p className="font-bold text-sm text-slate-800 truncate">{loc.name}</p>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{loc.type}</p>
                                        </div>
                                        {selectedIds.has(loc.id) ? (
                                            <CheckCircle className="w-6 h-6 text-emerald-600 fill-emerald-100 shrink-0" />
                                        ) : (
                                            <Circle className="w-6 h-6 text-slate-200 shrink-0" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button 
                            disabled={selectedIds.size === 0 || isOptimizing}
                            onClick={handleStartRoute}
                            className="w-full py-5 bg-emerald-600 disabled:bg-slate-200 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            {isOptimizing ? <><Loader2 className="w-6 h-6 animate-spin" /> Analisando Tráfego...</> : <><MapPin className="w-6 h-6" /> Gerar Rota Inteligente</>}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
