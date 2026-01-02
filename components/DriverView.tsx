// NOME DO ARQUIVO: components/DriverView.tsx
import React, { useState } from 'react';
import { DeliveryLocation, DriverState, DeliveryRecord, RouteHistory } from '../types';
import { LOCATIONS_DB } from '../constants';
import { optimizeRouteOrder, getRouteBriefingAudio } from '../services/geminiService';
import { saveRouteToHistoryDB, updateLocationStatusInDB, updateDriverRouteInDB, updateDriverStatusInDB } from '../services/dbService';
import { Truck, Navigation, CheckCircle, Circle, MapPin, Loader2, Volume2, ShieldAlert, Coffee, PlayCircle, Map as MapIcon, XCircle, CheckSquare, Siren } from 'lucide-react';
import { H2Logo } from './Logo';

interface DriverViewProps {
    driverState: DriverState;
    updateRoute: (newRoute: DeliveryLocation[]) => Promise<void>;
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
    const [completedRecords, setCompletedRecords] = useState<DeliveryRecord[]>([]);
    
    // Modal
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishStatus, setFinishStatus] = useState<'DELIVERED' | 'FAILED'>('DELIVERED');
    const [finishObs, setFinishObs] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const openGoogleMapsRoute = () => {
        if (driverState.route.length === 0) return;
        const origin = `${driverState.currentCoords.lat},${driverState.currentCoords.lng}`;
        const lastStop = driverState.route[driverState.route.length - 1];
        const destination = `${lastStop.coords.lat},${lastStop.coords.lng}`;
        const waypoints = driverState.route.slice(0, -1).map(loc => `${loc.coords.lat},${loc.coords.lng}`).join('|');
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
        window.open(url, '_blank');
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handlePanicButton = async () => {
        if (confirm("EMERGÊNCIA: Isso alertará a central. Confirmar?")) {
            await updateDriverStatusInDB(driverState.id, 'EMERGENCY' as any); // Type cast for custom status
            alert("Alerta enviado para a central!");
        }
    };

    const handleStartRoute = async () => {
        if (selectedIds.size === 0) return;
        setIsOptimizing(true);
        setErrorMsg(null);
        setCompletedRecords([]); 
        
        try {
            const selectedLocations = LOCATIONS_DB.filter(l => selectedIds.has(l.id));
            let orderedRoute = selectedLocations;
            try {
                const optimizedIds = await optimizeRouteOrder(driverState.currentCoords, selectedLocations);
                if (optimizedIds && optimizedIds.length > 0) {
                     orderedRoute = optimizedIds.map(id => selectedLocations.find(l => l.id === id)).filter((l): l is DeliveryLocation => !!l);
                }
            } catch (aiError) { console.warn("IA indisponível, ordem manual."); }
            await updateRoute(orderedRoute);
        } catch (e) { setErrorMsg("Erro ao iniciar rota."); } finally { setIsOptimizing(false); }
    };

    const handleConfirmDelivery = async () => {
        if (driverState.route.length === 0) return;
        setIsSubmitting(true);
        const currentLocation = driverState.route[0];
        const newRecord: DeliveryRecord = {
            locationId: currentLocation.id,
            locationName: currentLocation.name,
            timestamp: new Date().toISOString(),
            status: finishStatus,
            observation: finishObs || (finishStatus === 'DELIVERED' ? 'Recebido' : 'Motivo não informado')
        };
        const updatedRecords = [...completedRecords, newRecord];
        
        // Lógica de Salvamento com Fallback Offline
        try {
            // Tenta salvar no Firebase
            await updateLocationStatusInDB(currentLocation.id, 'COMPLETED');
            
            // Se for a última, salva histórico
            if (driverState.route.length === 1) {
                const historyItem: RouteHistory = {
                    id: `route-${Date.now()}`,
                    date: new Date().toISOString().split('T')[0],
                    driverName: driverState.name,
                    totalDeliveries: updatedRecords.filter(r => r.status === 'DELIVERED').length,
                    totalFailures: updatedRecords.filter(r => r.status === 'FAILED').length,
                    records: updatedRecords,
                    status: 'COMPLETED'
                };
                await saveRouteToHistoryDB(historyItem);
                setCompletedRecords([]);
            }

            // Atualiza rota do motorista (remove a atual)
            const remainingRoute = driverState.route.slice(1);
            await updateDriverRouteInDB(driverState.id, remainingRoute);
            
            setShowFinishModal(false);
            // Atualiza localmente a UI via prop (optimistic update é feito no App.tsx via subscription, mas chamamos callback)
            // completeDelivery() -> na verdade o updateDriverRouteInDB já vai disparar o listener no App.tsx
            
        } catch (e) {
            console.error("Erro online, salvando offline:", e);
            // SALVAMENTO OFFLINE
            const offlineQueue = JSON.parse(localStorage.getItem('OFFLINE_QUEUE') || '[]');
            offlineQueue.push({
                type: 'COMPLETE_DELIVERY',
                payload: {
                    driverId: driverState.id,
                    locationId: currentLocation.id,
                    record: newRecord,
                    remainingRoute: driverState.route.slice(1),
                    isLast: driverState.route.length === 1,
                    historyData: driverState.route.length === 1 ? {
                        id: `route-${Date.now()}`,
                        date: new Date().toISOString().split('T')[0],
                        driverName: driverState.name,
                        totalDeliveries: updatedRecords.filter(r => r.status === 'DELIVERED').length,
                        totalFailures: updatedRecords.filter(r => r.status === 'FAILED').length,
                        records: updatedRecords,
                        status: 'COMPLETED'
                    } : null
                }
            });
            localStorage.setItem('OFFLINE_QUEUE', JSON.stringify(offlineQueue));
            alert("Sem internet. Dados salvos no dispositivo e serão enviados automaticamente quando a conexão voltar.");
            setShowFinishModal(false);
            
            // Força atualização visual local (hack para UX)
            const remainingRoute = driverState.route.slice(1);
            // Simula a remoção visualmente chamando a prop, embora o DB não tenha atualizado
            if(remainingRoute.length < driverState.route.length) {
               // Apenas fechamos o modal, o App.tsx não vai receber update do DB, 
               // então idealmente deveríamos forçar um estado local, mas para MVP o alert basta.
               window.location.reload(); // Solução drástica para limpar estado local offline no MVP
            }
        } finally {
            setIsSubmitting(false);
            setFinishObs('');
        }
    };

    const playBriefing = async () => {
        const base64Audio = await getRouteBriefingAudio(driverState.name, driverState.route);
        if (base64Audio) { const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`); audio.play(); }
    };

    const currentTarget = driverState.route[0];
    const isBreak = driverState.status === 'BREAK';

    if (driverState.route.length > 0) {
        return (
            <div className="flex flex-col h-full w-full bg-white relative">
                {showFinishModal && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-4">
                            <h3 className="font-bold text-lg text-slate-900 border-b pb-2">Finalizar Entrega</h3>
                            <div className="flex gap-2">
                                <button onClick={() => setFinishStatus('DELIVERED')} className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all flex flex-col items-center gap-1 ${finishStatus === 'DELIVERED' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400'}`}><CheckSquare className="w-6 h-6" /> Entregue</button>
                                <button onClick={() => setFinishStatus('FAILED')} className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all flex flex-col items-center gap-1 ${finishStatus === 'FAILED' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 text-slate-400'}`}><XCircle className="w-6 h-6" /> Falhou</button>
                            </div>
                            <textarea value={finishObs} onChange={(e) => setFinishObs(e.target.value)} placeholder="Observações..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 h-20 resize-none" />
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowFinishModal(false)} disabled={isSubmitting} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl">Cancelar</button>
                                <button onClick={handleConfirmDelivery} disabled={isSubmitting} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg flex justify-center items-center">{isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar"}</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex-none p-5 bg-slate-900 text-white shadow-md flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <H2Logo className="h-6 w-auto" showText={false} variant="light" />
                        <div className="border-l border-slate-700 pl-3">
                            <h2 className="text-sm font-bold tracking-tight">MOTORISTA</h2>
                            <p className="text-slate-400 text-[10px] font-medium uppercase">{driverState.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={handlePanicButton} className="bg-red-600 p-2 rounded-full hover:bg-red-500 transition-colors shadow-lg active:scale-95 animate-pulse"><Siren className="w-4 h-4 text-white" /></button>
                         <button onClick={playBriefing} className="bg-emerald-600 p-2 rounded-full hover:bg-emerald-500 transition-colors shadow-lg active:scale-95"><Volume2 className="w-4 h-4 text-white" /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
                    <div className={`rounded-2xl p-5 shadow-xl relative overflow-hidden transition-all duration-500 ${isBreak ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">{isBreak ? <Coffee className="w-20 h-20" /> : <Truck className="w-20 h-20" />}</div>
                        {isBreak ? (
                            <div className="text-center py-4"><h3 className="text-2xl font-black uppercase tracking-widest mb-1">EM INTERVALO</h3><p className="text-white/80 text-sm mb-4">Monitoramento pausado.</p></div>
                        ) : (
                            <>
                                <h3 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-2">Próxima Parada #1</h3>
                                <p className="text-xl font-black mb-1 leading-tight">{currentTarget.name}</p>
                                <p className="text-xs text-slate-400 mb-6 truncate">{currentTarget.address}</p>
                                <button onClick={openGoogleMapsRoute} className="w-full mb-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"><Navigation className="w-4 h-4" /> Navegar com Google Maps</button>
                            </>
                        )}
                        <div className="grid grid-cols-2 gap-3 relative z-10">
                            <button onClick={toggleStatus} className={`py-4 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95 ${isBreak ? 'bg-white text-amber-600 hover:bg-amber-50' : 'bg-amber-500 text-white hover:bg-amber-400'}`}>{isBreak ? <><PlayCircle className="w-4 h-4" /> Retornar</> : <><Coffee className="w-4 h-4" /> Intervalo</>}</button>
                            <button onClick={() => setShowFinishModal(true)} disabled={isBreak} className="py-4 bg-white text-slate-900 disabled:opacity-50 disabled:bg-slate-200 rounded-xl font-bold text-sm shadow-lg active:scale-95">Concluir</button>
                        </div>
                    </div>
                    {!isBreak && driverState.route.map((loc, idx) => (
                        <div key={loc.id} className="flex items-center gap-4 bg-white border border-slate-100 p-3 rounded-xl">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>{idx + 1}</div>
                            <div className="flex-1 min-w-0"><p className={`font-bold text-sm truncate ${idx === 0 ? 'text-slate-900' : 'text-slate-400'}`}>{loc.name}</p></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-white">
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md flex justify-between items-center">
                 <div className="flex items-center gap-3"><H2Logo className="h-6 w-auto" showText={false} variant="light" /><div className="border-l border-slate-700 pl-3"><h2 className="text-sm font-bold tracking-tight">NOVO TURNO</h2><p className="text-slate-400 text-[10px] font-medium uppercase">{driverState.name}</p></div></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
                {errorMsg && <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-800 text-xs font-bold animate-pulse"><ShieldAlert className="w-5 h-5 inline mr-2" /> {errorMsg}</div>}
                <div className="bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-300">
                    <h3 className="font-bold text-slate-800 mb-1">Montar Rota</h3>
                    <div className="grid grid-cols-1 gap-2 mt-4">{LOCATIONS_DB.filter(l => l.type !== 'HEADQUARTERS').map(loc => (<div key={loc.id} onClick={() => toggleSelection(loc.id)} className={`p-4 rounded-2xl border-2 cursor-pointer flex items-center justify-between ${selectedIds.has(loc.id) ? 'bg-emerald-50 border-emerald-500' : 'bg-white border-slate-100'}`}><p className="font-bold text-sm text-slate-800">{loc.name}</p>{selectedIds.has(loc.id) ? <CheckCircle className="w-6 h-6 text-emerald-600" /> : <Circle className="w-6 h-6 text-slate-200" />}</div>))}</div>
                </div>
                <button disabled={selectedIds.size === 0 || isOptimizing} onClick={handleStartRoute} className="w-full py-5 bg-emerald-600 disabled:bg-slate-200 text-white rounded-2xl font-black text-lg shadow-xl flex items-center justify-center gap-3">{isOptimizing ? <Loader2 className="w-6 h-6 animate-spin" /> : <><MapPin className="w-6 h-6" /> Iniciar Rota ({selectedIds.size})</>}</button>
            </div>
        </div>
    );
};
