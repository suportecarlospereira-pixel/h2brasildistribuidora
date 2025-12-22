import React, { useState, useRef, useEffect } from 'react';
import { DriverState, DeliveryLocation, LocationType } from '../types';
import { MOCK_HISTORY } from '../constants';
import { LayoutDashboard, Users, Map as MapIcon, Mic, Send, History, Calendar, Navigation, Sparkles, CheckCircle, Circle, BrainCircuit, Truck } from 'lucide-react';
import { getSmartAssistantResponse } from '../services/geminiService';
import { H2Logo } from './Logo';

interface AdminViewProps {
    driverState: DriverState; // Legacy prop, kept for compatibility if passed
    allDrivers: DriverState[];
    allLocations: DeliveryLocation[];
    onDistributeRoutes: (locationIds: string[]) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ allDrivers, allLocations, onDistributeRoutes }) => {
    const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORY' | 'DISPATCH'>('LIVE');
    const [assistantQuery, setAssistantQuery] = useState('');
    const [assistantResponse, setAssistantResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const responseRef = useRef<HTMLDivElement>(null);

    // Dispatch State
    const [selectedForDispatch, setSelectedForDispatch] = useState<Set<string>>(new Set());
    const [isDistributing, setIsDistributing] = useState(false);

    const handleAskAssistant = async () => {
        if (!assistantQuery.trim()) return;
        setIsLoading(true);
        setAssistantResponse('');
        const response = await getSmartAssistantResponse(assistantQuery);
        setAssistantResponse(response);
        setIsLoading(false);
    };

    const toggleDispatchSelection = (id: string) => {
        const newSet = new Set(selectedForDispatch);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedForDispatch(newSet);
    };

    const handleDistribute = async () => {
        setIsDistributing(true);
        await onDistributeRoutes(Array.from(selectedForDispatch));
        setIsDistributing(false);
        setActiveTab('LIVE'); // Switch back to see result
        setSelectedForDispatch(new Set());
    };

    useEffect(() => {
        if (assistantResponse && responseRef.current) {
            responseRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [assistantResponse]);

    const filteredHistory = MOCK_HISTORY.filter(h => h.date === selectedDate);
    const pendingLocations = allLocations.filter(l => l.type !== LocationType.HEADQUARTERS);

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">
            {/* Header */}
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white rounded px-2 py-1">
                           <H2Logo className="h-6 w-auto" showText={false} variant="light" />
                        </div>
                        <div className="border-l border-slate-700 pl-3">
                            <h2 className="text-sm font-bold leading-none tracking-wide">PAINEL GESTOR</h2>
                            <p className="text-[10px] text-emerald-400 mt-0.5">Tempo Real</p>
                        </div>
                    </div>
                </div>
                
                {/* Tabs */}
                <div className="flex space-x-1 mt-6 bg-slate-800/50 p-1 rounded-lg">
                    <button 
                        onClick={() => setActiveTab('LIVE')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${activeTab === 'LIVE' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        Monitor
                    </button>
                    <button 
                        onClick={() => setActiveTab('DISPATCH')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${activeTab === 'DISPATCH' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        Distribuição
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-all ${activeTab === 'HISTORY' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                    >
                        Histórico
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-4">
                {activeTab === 'LIVE' && (
                    <div className="p-4 space-y-5">
                        {/* Driver Status List */}
                        {allDrivers.map((driver, idx) => (
                            <div key={driver.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                        <Truck className={`w-4 h-4 ${idx === 0 ? 'text-blue-600' : 'text-orange-500'}`} />
                                        Motorista {idx + 1}
                                    </h3>
                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex items-center gap-1 uppercase tracking-wide ${driver.isMoving ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                                        {driver.isMoving ? 'Em Trânsito' : 'Parado'}
                                    </span>
                                </div>

                                <div className="flex items-center gap-4 mb-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 border-white shadow-sm text-white font-bold text-lg ${idx === 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                        {driver.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-900 truncate">{driver.name}</p>
                                        <p className="text-xs text-slate-500 truncate">{driver.currentAddress}</p>
                                    </div>
                                </div>
                                
                                {driver.route.length > 0 ? (
                                    <div>
                                        <div className="flex justify-between items-end text-xs mb-2">
                                            <span className="text-slate-500 font-medium">Fila de Entrega: {driver.route.length}</span>
                                        </div>
                                        <div className="flex -space-x-2 overflow-hidden py-1 pl-1">
                                            {driver.route.slice(0, 5).map(r => (
                                                <div key={r.id} className="w-6 h-6 rounded-full bg-slate-100 border border-white flex items-center justify-center text-[8px] font-bold text-slate-600" title={r.name}>
                                                    {r.name.charAt(0)}
                                                </div>
                                            ))}
                                            {driver.route.length > 5 && (
                                                <div className="w-6 h-6 rounded-full bg-slate-200 border border-white flex items-center justify-center text-[8px] font-bold text-slate-600">
                                                    +{driver.route.length - 5}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-slate-400 italic bg-slate-50 p-2 rounded text-center">Disponível para rotas</p>
                                )}
                            </div>
                        ))}

                        {/* AI Assistant */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                                <Sparkles className="w-24 h-24 text-emerald-600" />
                            </div>
                            
                            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm relative z-10">
                                <Mic className="w-4 h-4 text-emerald-600" />
                                Assistente IA H2
                            </h3>
                            
                            <div className="bg-emerald-50 rounded-xl p-3 mb-3 border border-emerald-100 relative z-10">
                                {assistantResponse ? (
                                    <div ref={responseRef} className="text-sm text-slate-800 whitespace-pre-wrap animate-in fade-in slide-in-from-bottom-2">
                                        <span className="font-bold text-emerald-700 block text-xs mb-1 uppercase">Resposta:</span>
                                        {assistantResponse}
                                    </div>
                                ) : (
                                    <p className="text-xs text-emerald-600/70 italic">
                                        Pergunte sobre endereços, trânsito ou status de entregas...
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-2 relative z-10">
                                <input 
                                    type="text" 
                                    value={assistantQuery}
                                    onChange={(e) => setAssistantQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
                                    placeholder="Ex: Onde fica o CRAS Itaipava?"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all shadow-inner"
                                />
                                <button 
                                    onClick={handleAskAssistant}
                                    disabled={isLoading}
                                    className="bg-emerald-600 text-white w-12 rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center disabled:opacity-50 active:scale-95"
                                >
                                    {isLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Send className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'DISPATCH' && (
                     <div className="p-4 space-y-4">
                        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-lg">
                            <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                                <BrainCircuit className="w-5 h-5 text-emerald-400" />
                                Inteligência Logística
                            </h3>
                            <p className="text-slate-300 text-sm mb-4">Selecione as entregas e deixe a IA calcular a melhor divisão entre os motoristas disponíveis.</p>
                            
                            <button 
                                onClick={handleDistribute}
                                disabled={selectedForDispatch.size === 0 || isDistributing}
                                className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-emerald-500 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                            >
                                {isDistributing ? 'Calculando Rotas...' : `Distribuir ${selectedForDispatch.size} Entregas`}
                            </button>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                             <div className="p-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                 <span className="text-xs font-bold text-slate-500 uppercase">Locais Disponíveis</span>
                                 <button onClick={() => setSelectedForDispatch(new Set(pendingLocations.map(l => l.id)))} className="text-xs text-emerald-600 font-bold">Selecionar Tudo</button>
                             </div>
                             <div className="max-h-[50vh] overflow-y-auto">
                                 {pendingLocations.map(loc => (
                                     <div 
                                        key={loc.id}
                                        onClick={() => toggleDispatchSelection(loc.id)}
                                        className={`p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedForDispatch.has(loc.id) ? 'bg-emerald-50/50' : ''}`}
                                     >
                                         <div className="pr-2">
                                             <p className="font-bold text-sm text-slate-800">{loc.name}</p>
                                             <p className="text-xs text-slate-500 truncate">{loc.address}</p>
                                         </div>
                                         {selectedForDispatch.has(loc.id) ? (
                                             <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                                         ) : (
                                             <Circle className="w-5 h-5 text-slate-300 shrink-0" />
                                         )}
                                     </div>
                                 ))}
                             </div>
                        </div>
                     </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="p-4 space-y-4">
                        {/* History Filter */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-20">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block mb-2">Filtrar Histórico</label>
                            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                                <Calendar className="w-5 h-5 text-slate-400" />
                                <input 
                                    type="date" 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent w-full text-slate-700 focus:outline-none font-bold text-sm"
                                />
                            </div>
                        </div>

                        {/* History List */}
                        <div className="space-y-3">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map(record => (
                                    <div key={record.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:scale-[0.99] transition-transform">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h4 className="font-bold text-slate-800">{record.driverName}</h4>
                                                <p className="text-[10px] text-slate-400 font-mono">#{record.id}</p>
                                            </div>
                                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide ${record.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {record.status === 'COMPLETED' ? 'Concluído' : 'Em Andamento'}
                                            </span>
                                        </div>
                                        
                                        <div className="border-t border-slate-100 pt-3">
                                            <p className="text-xs text-slate-500 mb-2 flex items-center gap-1 font-medium">
                                                <Navigation className="w-3 h-3 text-slate-400" />
                                                Locais Visitados ({record.totalDeliveries}):
                                            </p>
                                            <div className="flex flex-wrap gap-1">
                                                {record.locations.map((loc, idx) => (
                                                    <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">
                                                        {loc}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                    <History className="w-12 h-12 mb-3 opacity-20" />
                                    <p className="text-sm font-medium">Nenhum histórico encontrado.</p>
                                    <p className="text-xs opacity-60">Selecione outra data acima.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};