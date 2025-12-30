// NOME DO ARQUIVO: components/DriverView.tsx
import React, { useState } from 'react';
import { DeliveryLocation, DriverState, LocationType } from '../types';
import { LOCATIONS_DB } from '../constants';
import { optimizeRouteOrder, getRouteBriefingAudio } from '../services/geminiService';
import { Truck, Navigation, CheckCircle, Circle, MapPin, Loader2, Volume2, ShieldAlert, Coffee, PlayCircle } from 'lucide-react';
import { H2Logo } from './Logo';

interface DriverViewProps {
    driverState: DriverState;
    updateRoute: (newRoute: DeliveryLocation[]) => Promise<void>; // Retorna Promise
    toggleStatus: () => void;
    completeDelivery: () => void;
}

export const DriverView: React.FC<DriverViewProps> = ({ 
    driverState, 
    updateRoute, 
    toggleStatus,
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
        if (selectedIds.size === 0) return;

        setIsOptimizing(true);
        setErrorMsg(null);
        
        try {
            const selectedLocations = LOCATIONS_DB.filter(l => selectedIds.has(l.id));
            
            // 1. Tenta Otimizar com IA
            let orderedRoute: DeliveryLocation[] = [];
            try {
                const optimizedIds = await optimizeRouteOrder(driverState.currentCoords, selectedLocations);
                orderedRoute = optimizedIds
                    .map(id => selectedLocations.find(l => l.id === id))
                    .filter((l): l is DeliveryLocation => !!l);
            } catch (aiError) {
                console.warn("IA falhou, usando ordem padrão:", aiError);
                orderedRoute = selectedLocations;
            }

            // Fallback se a lista vier vazia
            if (orderedRoute.length === 0) {
                orderedRoute = selectedLocations;
            }

            // 2. Limpeza de Dados (Sanitização)
            // Remove 'undefined' que causa erro no Firebase
            const cleanRoute = JSON.parse(JSON.stringify(orderedRoute));

            // 3. Atualiza o Banco de Dados
            await updateRoute(cleanRoute);

        } catch (e: any) {
            console.error("Erro no fluxo de rota:", e);
            let msg = "Erro ao iniciar rota. Tente novamente.";
            if (e.code === 'permission-denied') msg = "Erro de Permissão: Regras do Firebase bloqueando.";
            if (e.message) msg = `Erro: ${e.message}`;
            setErrorMsg(msg);
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
    const isBreak = driverState.status === 'BREAK';

    // RENDERIZAÇÃO: ROTA ATIVA
    if (driverState.route.length > 0) {
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
                    <button onClick={playBriefing} className="bg-emerald-600 p-2 rounded-full hover:bg-emerald-500 transition-colors shadow-lg">
                        <Volume2 className="w-4 h-4 text-white" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
                    <div className={`rounded-2xl p-5 shadow-xl relative overflow-hidden transition-colors duration-500 ${isBreak ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            {isBreak ? <Coffee className="w-20 h-20" /> : <Truck className="w-20 h-20" />}
                        </div>
                        
                        {isBreak ? (
                            <div className="text-center py-4">
                                <h3 className="text-2xl font-black uppercase tracking-widest mb-1">EM INTERVALO</h3>
                                <p className="text-white/80 text-sm mb-4">Sua localização está pausada.</p>
                            </div>
                        ) : (
                            <>
                                <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">Próxima Parada #1</h3>
                                <p className="text-xl font-black mb-1 leading-tight">{currentTarget.name}</p>
                                <p className="text-xs text-slate-400 mb-6 truncate">{currentTarget.address}</p>
                            </>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            <button 
                                onClick={toggleStatus} 
                                className={`py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 ${
                                    isBreak 
                                    ? 'bg-white text-amber-600 hover:bg-amber-50' 
                                    : 'bg-amber-500 text-white hover:bg-amber-400'
                                }`}
                            >
                                {isBreak ? <><PlayCircle className="w-4 h-4" /> Retornar</> : <><Coffee className="w-4 h-4" /> Intervalo</>}
                            </button>
                            
                            <button 
                                onClick={completeDelivery} 
                                disabled={isBreak}
                                className="py-4 bg-white text-slate-900 disabled:opacity-50 disabled:bg-slate-200 rounded-xl font-bold text-sm shadow-lg active:scale-95"
                            >
                                Concluir
                            </button>
                        </div>
                    </div>

                    {!isBreak && (
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
                    )}
                </div>
            </div>
        );
    }

    // RENDERIZAÇÃO: SELEÇÃO DE ROTA (INICIAL)
    return (
        <div className="flex flex-col h-full w-full bg-white">
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <H2Logo className="h-6 w-auto" showText={false} variant="light" />
                    <div className="border-l border-slate-700 pl-3">
                        <h2 className="text-sm font-bold tracking-tight">NOVO TURNO</h2>
                        <p className="text-slate-400 text-[10px] font-medium uppercase">{driverState.name}</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
                {errorMsg && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-800 text-xs font-bold animate-pulse">
                        <ShieldAlert className="w-5 h-5 shrink-0" /> 
                        {errorMsg}
                    </div>
                )}

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
                    {isOptimizing ? <><Loader2 className="w-6 h-6 animate-spin" /> Processando...</> : <><MapPin className="w-6 h-6" /> Iniciar Rota ({selectedIds.size})</>}
                </button>
            </div>
        </div>
    );
};