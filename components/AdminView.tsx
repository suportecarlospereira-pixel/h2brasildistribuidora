import React, { useState, useRef, useEffect } from 'react';
import { DriverState, DeliveryLocation, LocationType } from '../types';
import { MOCK_HISTORY } from '../constants';
import { LayoutDashboard, Users, Map as MapIcon, Mic, Send, History, Calendar, Navigation, Sparkles, CheckCircle, Circle, BrainCircuit, Truck, Trash2, Clock, Loader2 } from 'lucide-react';
import { getSmartAssistantResponse } from '../services/geminiService';
import { deleteDriverFromDB } from '../services/dbService';
import { H2Logo } from './Logo';

interface AdminViewProps {
    driverState: DriverState; 
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

    const handleDeleteDriver = async (id: string, name: string) => {
        if (confirm(`Deseja realmente remover o motorista ${name}? Ele sumirá do mapa e do painel.`)) {
            try {
                await deleteDriverFromDB(id);
                alert(`${name} removido com sucesso.`);
            } catch (e) {
                alert("Erro ao remover motorista. Tente novamente.");
            }
        }
    };

    const formatLastSeen = (timestamp?: number) => {
        if (!timestamp) return 'Nunca visto';
        const diff = Date.now() - timestamp;
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Agora';
        if (mins < 60) return `${mins}m atrás`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h atrás`;
        return `${Math.floor(hours / 24)}d atrás`;
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
        setActiveTab('LIVE');
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
                            <h2 className="text-sm font-bold leading-none tracking-wide uppercase">H2 GESTÃO</h2>
                            <p className="text-[10px] text-emerald-400 mt-0.5 font-bold uppercase tracking-wider">Monitor em Tempo Real</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex space-x-1 mt-6 bg-slate-800/50 p-1 rounded-lg">
                    {['LIVE', 'DISPATCH', 'HISTORY'].map((tab) => (
                        <button 
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === tab ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                        >
                            {tab === 'LIVE' ? 'Monitor' : tab === 'DISPATCH' ? 'Frotas' : 'Relatórios'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20 md:pb-4 no-scrollbar">
                {activeTab === 'LIVE' && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Motoristas Ativos</h3>
                            <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black">{allDrivers.length} ONLINE</span>
                        </div>

                        {allDrivers.length === 0 ? (
                            <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300">
                                <Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                <p className="text-sm font-bold text-slate-400">Nenhum motorista ativo no momento.</p>
                            </div>
                        ) : (
                            allDrivers.map((driver, idx) => (
                                <div key={driver.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 hover:border-emerald-200 transition-colors group relative">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-sm ${idx % 2 === 0 ? 'bg-blue-600' : 'bg-orange-500'}`}>
                                                {driver.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-900 text-sm leading-tight">{driver.name}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                    <span className="text-[10px] text-slate-500 font-medium">Visto: {formatLastSeen(driver.lastSeen)}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[9px] px-2 py-1 rounded-full font-black uppercase tracking-tighter ${driver.isMoving ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                                {driver.isMoving ? 'Em Rota' : 'Pausado'}
                                            </span>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteDriver(driver.id, driver.name);
                                                }}
                                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-100 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100 opacity-100"
                                                title="Excluir motorista"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Localização Atual</p>
                                        <p className="text-xs text-slate-700 truncate font-medium">{driver.currentAddress || 'Local desconhecido'}</p>
                                    </div>
                                    
                                    {driver.route.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-50">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">Carga: {driver.route.length} entregas</span>
                                            </div>
                                            <div className="flex gap-1 overflow-hidden">
                                                {driver.route.slice(0, 8).map(r => (
                                                    <div key={r.id} className="w-6 h-6 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[8px] font-black text-emerald-700" title={r.name}>
                                                        {r.name.charAt(0)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* AI Assistant */}
                        <div className="bg-emerald-900 rounded-3xl p-5 text-white shadow-xl shadow-emerald-900/20 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10">
                                <BrainCircuit className="w-32 h-32" />
                            </div>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                Inteligência H2
                            </h3>
                            
                            {assistantResponse && (
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/10 animate-in zoom-in-95">
                                    <p className="text-sm leading-relaxed">{assistantResponse}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    value={assistantQuery}
                                    onChange={(e) => setAssistantQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()}
                                    placeholder="Perguntar ao sistema..."
                                    className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white focus:text-slate-900 transition-all placeholder:text-white/40"
                                />
                                <button 
                                    onClick={handleAskAssistant}
                                    disabled={isLoading}
                                    className="bg-emerald-500 text-white w-12 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 shadow-lg"
                                >
                                    {isLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Send className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'DISPATCH' && (
                     <div className="p-4 space-y-4">
                        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
                            <h3 className="font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4 text-emerald-400" />
                                Central de Frotas
                            </h3>
                            <p className="text-slate-400 text-xs mb-6">Selecione pontos pendentes para roteirização automática por IA.</p>
                            
                            <button 
                                onClick={handleDistribute}
                                disabled={selectedForDispatch.size === 0 || isDistributing}
                                className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 flex items-center justify-center gap-3 transition-all active:scale-95"
                            >
                                {isDistributing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : `Distribuir ${selectedForDispatch.size} Pontos`}
                            </button>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Logística</span>
                                 <button onClick={() => setSelectedForDispatch(new Set(pendingLocations.map(l => l.id)))} className="text-[10px] text-emerald-600 font-black uppercase">Marcar Todos</button>
                             </div>
                             <div className="max-h-[50vh] overflow-y-auto">
                                 {pendingLocations.map(loc => (
                                     <div 
                                        key={loc.id}
                                        onClick={() => toggleDispatchSelection(loc.id)}
                                        className={`p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedForDispatch.has(loc.id) ? 'bg-emerald-50/50' : ''}`}
                                     >
                                         <div className="pr-4 min-w-0">
                                             <p className="font-bold text-sm text-slate-800 truncate">{loc.name}</p>
                                             <p className="text-[10px] text-slate-400 truncate uppercase mt-0.5">{loc.address}</p>
                                         </div>
                                         {selectedForDispatch.has(loc.id) ? (
                                             <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 fill-emerald-100" />
                                         ) : (
                                             <Circle className="w-6 h-6 text-slate-200 shrink-0" />
                                         )}
                                     </div>
                                 ))}
                             </div>
                        </div>
                     </div>
                )}

                {activeTab === 'HISTORY' && (
                    <div className="p-4 space-y-4">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Arquivo de Entregas</h3>
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 focus-within:ring-2 focus-within:ring-emerald-500 transition-all">
                                <Calendar className="w-5 h-5 text-emerald-600" />
                                <input 
                                    type="date" 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="bg-transparent w-full text-slate-900 focus:outline-none font-black text-sm uppercase"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map(record => (
                                    <div key={record.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-xs text-slate-500">
                                                    {record.driverName.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-slate-900 text-sm leading-tight">{record.driverName}</h4>
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">REF: {record.id}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-tighter ${record.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                                {record.status === 'COMPLETED' ? 'Concluído' : 'Parcial'}
                                            </span>
                                        </div>
                                        
                                        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-3">Roteiro Efetuado ({record.totalDeliveries})</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {record.locations.map((loc, idx) => (
                                                    <span key={idx} className="text-[10px] bg-white text-slate-700 px-3 py-1.5 rounded-xl border border-slate-100 font-bold shadow-sm">
                                                        {loc}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200">
                                    <History className="w-12 h-12 mb-4 opacity-10" />
                                    <p className="text-xs font-black uppercase tracking-widest opacity-40">Sem registros nesta data</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};