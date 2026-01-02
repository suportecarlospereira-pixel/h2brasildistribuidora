// NOME DO ARQUIVO: components/AdminView.tsx
import React, { useState, useRef, useEffect } from 'react';
import { DriverState, DeliveryLocation, RouteHistory, LocationType } from '../types';
import { Users, Send, History, Sparkles, CheckCircle, Circle, BrainCircuit, Truck, Trash2, Clock, Loader2, Coffee, MapPin, ChevronDown, ChevronUp, AlertCircle, CheckSquare, MapPinned, Plus, X, Download } from 'lucide-react'; // Adicionado Download
import { getSmartAssistantResponse } from '../services/geminiService';
import { deleteDriverFromDB, subscribeToHistory, deleteRouteHistoryFromDB, addLocationToDB, deleteLocationFromDB } from '../services/dbService';
import { H2Logo } from './Logo';

interface AdminViewProps {
    driverState: DriverState; 
    allDrivers: DriverState[];
    allLocations: DeliveryLocation[];
    onDistributeRoutes: (locationIds: string[]) => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({ allDrivers, allLocations, onDistributeRoutes }) => {
    const [activeTab, setActiveTab] = useState<'LIVE' | 'HISTORY' | 'DISPATCH' | 'LOCATIONS'>('LIVE');
    const [assistantQuery, setAssistantQuery] = useState('');
    const [assistantResponse, setAssistantResponse] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
    const [deletingLocId, setDeletingLocId] = useState<string | null>(null);
    
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState<string>(today);
    const [endDate, setEndDate] = useState<string>(today);
    
    const [historyData, setHistoryData] = useState<RouteHistory[]>([]);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
    
    const responseRef = useRef<HTMLDivElement>(null);
    const [selectedForDispatch, setSelectedForDispatch] = useState<Set<string>>(new Set());
    const [isDistributing, setIsDistributing] = useState(false);

    // Formulário Locais
    const [showLocForm, setShowLocForm] = useState(false);
    const [newLocName, setNewLocName] = useState('');
    const [newLocAddress, setNewLocAddress] = useState('');
    const [newLocType, setNewLocType] = useState<LocationType>(LocationType.UBS);
    const [newLocLat, setNewLocLat] = useState('');
    const [newLocLng, setNewLocLng] = useState('');
    const [isSavingLoc, setIsSavingLoc] = useState(false);

    useEffect(() => { const unsubscribe = subscribeToHistory((data) => setHistoryData(data)); return () => unsubscribe(); }, []);

    // --- FUNÇÃO EXPORTAR CSV ---
    const handleExportCSV = () => {
        if (historyData.length === 0) return alert("Sem dados para exportar.");
        
        // Cabeçalho do CSV
        const headers = ["ID Rota", "Data", "Motorista", "Total Entregas", "Total Falhas", "Status Geral", "Local", "Horário Entrega", "Status Entrega", "Observação"];
        
        // Gera as linhas
        let csvContent = headers.join(",") + "\n";
        
        const filtered = historyData.filter(h => {
            if (!startDate || !endDate) return true;
            return h.date >= startDate && h.date <= endDate;
        });

        filtered.forEach(route => {
            if (route.records && route.records.length > 0) {
                route.records.forEach(record => {
                    const row = [
                        route.id,
                        route.date,
                        `"${route.driverName}"`, // Aspas para evitar quebra em nomes compostos
                        route.totalDeliveries,
                        route.totalFailures,
                        route.status,
                        `"${record.locationName}"`,
                        new Date(record.timestamp).toLocaleTimeString(),
                        record.status,
                        `"${record.observation.replace(/"/g, '""')}"` // Escape de aspas na obs
                    ];
                    csvContent += row.join(",") + "\n";
                });
            } else {
                // Rota sem registros detalhados
                const row = [route.id, route.date, `"${route.driverName}"`, route.totalDeliveries, route.totalFailures, route.status, "-", "-", "-", "-"];
                csvContent += row.join(",") + "\n";
            }
        });

        // Cria o blob com BOM para Excel (UTF-8)
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_h2_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAskAssistant = async () => {
        if (!assistantQuery.trim()) return;
        setIsLoading(true); setAssistantResponse('');
        const response = await getSmartAssistantResponse(assistantQuery);
        setAssistantResponse(response); setIsLoading(false);
    };

    const handleDeleteDriver = async (id: string, name: string) => {
        if (deletingId) return;
        if (window.confirm(`ATENÇÃO: Deseja remover o motorista "${name}" do sistema?`)) {
            setDeletingId(id);
            try { await deleteDriverFromDB(id); } catch (e) { alert("Erro ao excluir."); } finally { setDeletingId(null); }
        }
    };

    const handleDeleteHistory = async (e: React.MouseEvent, historyId: string, driverName: string) => {
        e.stopPropagation();
        if (deletingHistoryId) return;
        if (window.confirm(`Excluir relatório de "${driverName}"?`)) {
            setDeletingHistoryId(historyId);
            try { await deleteRouteHistoryFromDB(historyId); } catch (e) { alert("Erro ao excluir."); } finally { setDeletingHistoryId(null); }
        }
    };

    const handleAddLocation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newLocName || !newLocLat || !newLocLng) return alert("Preencha os campos obrigatórios.");
        setIsSavingLoc(true);
        try {
            const newLocation: DeliveryLocation = { id: `loc-${Date.now()}`, name: newLocName, address: newLocAddress || "Endereço não informado", type: newLocType, coords: { lat: parseFloat(newLocLat), lng: parseFloat(newLocLng) }, status: 'PENDING' };
            await addLocationToDB(newLocation);
            setShowLocForm(false); setNewLocName(''); setNewLocAddress(''); setNewLocLat(''); setNewLocLng('');
            alert("Local adicionado com sucesso!");
        } catch (error) { alert("Erro ao salvar local."); } finally { setIsSavingLoc(false); }
    };

    const handleDeleteLocation = async (id: string, name: string) => {
        if (confirm(`Excluir o local "${name}"?`)) {
            setDeletingLocId(id);
            try { await deleteLocationFromDB(id); } catch(e) { alert("Erro ao excluir."); } finally { setDeletingLocId(null); }
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

    const getStatusBadge = (status: string) => {
        if (status === 'BREAK') return <span className="text-[9px] px-2 py-1 rounded-full font-bold bg-amber-100 text-amber-800 flex items-center gap-1 border border-amber-200"><Coffee className="w-3 h-3"/> Almoço</span>;
        if (status === 'MOVING') return <span className="text-[9px] px-2 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 border border-emerald-200"><MapPin className="w-3 h-3"/> Em Rota</span>;
        if (status === 'EMERGENCY') return <span className="text-[9px] px-2 py-1 rounded-full font-bold bg-red-600 text-white flex items-center gap-1 border border-red-700 animate-pulse"><AlertCircle className="w-3 h-3"/> PÂNICO</span>;
        return <span className="text-[9px] px-2 py-1 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">Parado</span>;
    };

    const toggleDispatchSelection = (id: string) => {
        const newSet = new Set(selectedForDispatch);
        if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
        setSelectedForDispatch(newSet);
    };

    const handleDistribute = async () => {
        setIsDistributing(true);
        await onDistributeRoutes(Array.from(selectedForDispatch));
        setIsDistributing(false); setActiveTab('LIVE'); setSelectedForDispatch(new Set());
    };

    useEffect(() => { if (assistantResponse && responseRef.current) responseRef.current.scrollIntoView({ behavior: 'smooth' }); }, [assistantResponse]);

    const filteredHistory = historyData.filter(h => {
        if (!startDate || !endDate) return true;
        return h.date >= startDate && h.date <= endDate;
    });
    const pendingLocations = allLocations.filter(l => l.type !== 'HEADQUARTERS' && l.status !== 'COMPLETED');

    return (
        <div className="flex flex-col h-full w-full bg-slate-50">
            <div className="flex-none p-5 bg-slate-900 text-white shadow-md z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white rounded px-2 py-1"><H2Logo className="h-6 w-auto" showText={false} variant="light" /></div>
                        <div className="border-l border-slate-700 pl-3">
                            <h2 className="text-sm font-bold leading-none tracking-wide uppercase">H2 GESTÃO</h2>
                            <p className="text-[10px] text-emerald-400 mt-0.5 font-bold uppercase tracking-wider">Monitor em Tempo Real</p>
                        </div>
                    </div>
                </div>
                <div className="flex space-x-1 mt-6 bg-slate-800/50 p-1 rounded-lg overflow-x-auto no-scrollbar">
                    {[{ id: 'LIVE', label: 'Monitor' }, { id: 'DISPATCH', label: 'Frotas' }, { id: 'LOCATIONS', label: 'Locais' }, { id: 'HISTORY', label: 'Relatórios' }].map((tab) => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 min-w-[70px] py-2.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>{tab.label}</button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pb-20 md:pb-4 no-scrollbar">
                {activeTab === 'LIVE' && (
                    <div className="p-4 space-y-4">
                        <div className="flex items-center justify-between px-1"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Motoristas Ativos</h3><span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-black">{allDrivers.length} ONLINE</span></div>
                        {allDrivers.length === 0 ? (<div className="bg-white rounded-2xl p-10 text-center border border-dashed border-slate-300"><Truck className="w-10 h-10 text-slate-200 mx-auto mb-3" /><p className="text-sm font-bold text-slate-400">Nenhum motorista ativo.</p></div>) : (allDrivers.map((driver) => (
                            <div key={driver.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 relative">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black shadow-sm bg-blue-600">{driver.name.charAt(0)}</div><div><p className="font-black text-slate-900 text-sm leading-tight">{driver.name}</p><div className="flex items-center gap-1.5 mt-0.5"><Clock className="w-3 h-3 text-slate-400" /><span className="text-[10px] text-slate-500 font-medium">Visto: {formatLastSeen(driver.lastSeen)}</span></div></div></div>
                                    <div className="flex items-center gap-2">{getStatusBadge(driver.status)}<button onClick={() => handleDeleteDriver(driver.id, driver.name)} className="p-2 text-slate-400 hover:text-red-500">{deletingId === driver.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}</button></div>
                                </div>
                                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100"><p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Localização Atual</p><p className="text-xs text-slate-700 truncate font-medium">{driver.currentAddress || 'Local desconhecido'}</p></div>
                                {driver.route.length > 0 && (<div className="mt-3 pt-3 border-t border-slate-50"><span className="text-[10px] font-bold text-slate-400 uppercase">Carga: {driver.route.length} entregas</span></div>)}
                            </div>
                        )))}
                        <div className="bg-emerald-900 rounded-3xl p-5 text-white shadow-xl shadow-emerald-900/20 relative overflow-hidden">
                            <div className="absolute -right-4 -top-4 opacity-10"><BrainCircuit className="w-32 h-32" /></div>
                            <h3 className="font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-400" /> Inteligência H2</h3>
                            {assistantResponse && <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4 border border-white/10 animate-in zoom-in-95"><p className="text-sm leading-relaxed">{assistantResponse}</p></div>}
                            <div className="flex gap-2"><input type="text" value={assistantQuery} onChange={(e) => setAssistantQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskAssistant()} placeholder="Perguntar ao sistema..." className="flex-1 bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:bg-white focus:text-slate-900 transition-all placeholder:text-white/40" /><button onClick={handleAskAssistant} disabled={isLoading} className="bg-emerald-500 text-white w-12 rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center disabled:opacity-50 active:scale-95 shadow-lg">{isLoading ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Send className="w-4 h-4" />}</button></div>
                        </div>
                    </div>
                )}
                {activeTab === 'DISPATCH' && (
                     <div className="p-4 space-y-4">
                        <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
                            <h3 className="font-black text-sm uppercase tracking-widest mb-1 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /> Central de Frotas</h3>
                            <p className="text-slate-400 text-xs mb-6">Selecione pontos pendentes para roteirização automática por IA.</p>
                            <button onClick={handleDistribute} disabled={selectedForDispatch.size === 0 || isDistributing} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 flex items-center justify-center gap-3 transition-all active:scale-95">{isDistributing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processando...</> : `Distribuir ${selectedForDispatch.size} Pontos`}</button>
                        </div>
                        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                             <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aguardando Logística</span><button onClick={() => setSelectedForDispatch(new Set(pendingLocations.map(l => l.id)))} className="text-[10px] text-emerald-600 font-black uppercase">Marcar Todos</button></div>
                             <div className="max-h-[50vh] overflow-y-auto">
                                 {pendingLocations.length === 0 ? <p className="p-4 text-center text-xs text-slate-400 italic">Nenhum ponto pendente.</p> : pendingLocations.map(loc => (<div key={loc.id} onClick={() => toggleDispatchSelection(loc.id)} className={`p-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedForDispatch.has(loc.id) ? 'bg-emerald-50/50' : ''}`}><div className="pr-4 min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{loc.name}</p><p className="text-[10px] text-slate-400 truncate uppercase mt-0.5">{loc.address}</p></div>{selectedForDispatch.has(loc.id) ? <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 fill-emerald-100" /> : <Circle className="w-6 h-6 text-slate-200 shrink-0" />}</div>))}
                             </div>
                        </div>
                     </div>
                )}
                {activeTab === 'LOCATIONS' && (
                    <div className="p-4 space-y-4">
                         <div className="flex items-center justify-between px-1"><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Gestão de Pontos</h3><button onClick={() => setShowLocForm(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md active:scale-95 transition-transform"><Plus className="w-4 h-4"/> Novo Ponto</button></div>
                        {showLocForm && (
                            <form onSubmit={handleAddLocation} className="bg-white p-4 rounded-3xl border border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4">
                                <div className="flex justify-between items-center mb-4"><h4 className="font-bold text-slate-800">Novo Local</h4><button type="button" onClick={() => setShowLocForm(false)}><X className="w-5 h-5 text-slate-400" /></button></div>
                                <div className="space-y-3">
                                    <input type="text" placeholder="Nome do Local (ex: UBS Central)" value={newLocName} onChange={e => setNewLocName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" required />
                                    <input type="text" placeholder="Endereço Completo" value={newLocAddress} onChange={e => setNewLocAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" required />
                                    <div className="flex gap-2"><select value={newLocType} onChange={e => setNewLocType(e.target.value as LocationType)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold uppercase text-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none flex-1">{Object.values(LocationType).map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                                    <div className="flex gap-2"><input type="number" step="any" placeholder="Latitude" value={newLocLat} onChange={e => setNewLocLat(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" required /><input type="number" step="any" placeholder="Longitude" value={newLocLng} onChange={e => setNewLocLng(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" required /></div>
                                    <button type="submit" disabled={isSavingLoc} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold shadow-lg flex justify-center items-center gap-2">{isSavingLoc ? <Loader2 className="w-4 h-4 animate-spin"/> : "Salvar Local"}</button>
                                </div>
                            </form>
                        )}
                        <div className="space-y-2">{allLocations.filter(l => l.type !== 'HEADQUARTERS').map(loc => (<div key={loc.id} className="bg-white p-3 rounded-2xl border border-slate-100 flex items-center justify-between group"><div className="flex items-center gap-3 overflow-hidden"><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0"><MapPinned className="w-4 h-4 text-slate-400" /></div><div className="min-w-0"><p className="font-bold text-sm text-slate-800 truncate">{loc.name}</p><p className="text-[10px] text-slate-400 uppercase">{loc.type} • {loc.address}</p></div></div><button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">{deletingLocId === loc.id ? <Loader2 className="w-4 h-4 animate-spin text-red-500"/> : <Trash2 className="w-4 h-4" />}</button></div>))}</div>
                    </div>
                )}
                {activeTab === 'HISTORY' && (
                    <div className="p-4 space-y-4">
                        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Relatório por Período</h3>
                            <div className="flex gap-2 mb-4">
                                <div className="flex-1 bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col"><span className="text-[9px] text-slate-400 font-bold uppercase ml-1">De</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent w-full text-slate-900 focus:outline-none font-bold text-xs uppercase" /></div>
                                <div className="flex-1 bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col"><span className="text-[9px] text-slate-400 font-bold uppercase ml-1">Até</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent w-full text-slate-900 focus:outline-none font-bold text-xs uppercase" /></div>
                            </div>
                            <button onClick={handleExportCSV} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all">
                                <Download className="w-4 h-4" /> Baixar Excel (CSV)
                            </button>
                        </div>
                        <div className="space-y-3">
                            {filteredHistory.length > 0 ? (filteredHistory.map(record => {
                                const isExpanded = expandedHistoryId === record.id;
                                return (
                                    <div key={record.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative group">
                                        <div className="p-5 flex justify-between items-start cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpandedHistoryId(isExpanded ? null : record.id)}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-sm text-slate-600">{record.driverName.charAt(0)}</div>
                                                <div><h4 className="font-black text-slate-900 text-sm">{record.driverName}</h4><div className="flex gap-2 mt-1 flex-wrap"><span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{new Date(record.date).toLocaleDateString()}</span><span className="text-[9px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">{record.totalDeliveries} Entregues</span>{record.totalFailures > 0 && <span className="text-[9px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">{record.totalFailures} Falhas</span>}</div></div>
                                            </div>
                                            <div className="flex items-center gap-2"><button onClick={(e) => handleDeleteHistory(e, record.id, record.driverName)} className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors">{deletingHistoryId === record.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>{isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div>
                                        </div>
                                        {isExpanded && (<div className="bg-slate-50 border-t border-slate-100 p-4 space-y-2">{record.records && record.records.length > 0 ? (record.records.map((item, idx) => (<div key={idx} className="flex items-start gap-3 bg-white p-3 rounded-xl border border-slate-200">{item.status === 'DELIVERED' ? <CheckSquare className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}<div><p className="text-xs font-bold text-slate-800">{item.locationName}</p><p className="text-[10px] text-slate-500 mt-0.5 italic">Obs: {item.observation}</p><p className="text-[9px] text-slate-400 mt-1">{new Date(item.timestamp).toLocaleTimeString()}</p></div></div>))) : <p className="text-xs text-slate-400 text-center italic">Sem detalhes.</p>}</div>)}
                                    </div>
                                );
                            })) : (<div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200"><History className="w-12 h-12 mb-4 opacity-10" /><p className="text-xs font-black uppercase tracking-widest opacity-40">Sem registros no período.</p></div>)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
