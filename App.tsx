// NOME DO ARQUIVO: App.tsx
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { AppView, DriverState, DeliveryLocation } from './types';
import { LOCATIONS_DB } from './constants';
import { LogOut, ChevronUp, ChevronDown, UserCircle, Lock, ShieldCheck, Loader2, WifiOff, RefreshCw } from 'lucide-react';
import { distributeAndOptimizeRoutes } from './services/geminiService';
import { H2Logo } from './components/Logo';
import { 
    subscribeToDrivers, 
    subscribeToLocations, 
    updateDriverLocationInDB, 
    registerDriverInDB, 
    updateDriverRouteInDB, 
    updateDriverStatusInDB, 
    seedDatabaseIfEmpty, 
    updateLocationStatusInDB, 
    getDriverById, 
    findDriverByName,
    saveRouteToHistoryDB
} from './services/dbService';

const DriverView = lazy(() => import('./components/DriverView').then(m => ({ default: m.DriverView })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";
const STORAGE_KEY_DRIVER = "H2_DRIVER_ID";
const STORAGE_KEY_VIEW = "H2_LAST_VIEW";
const OFFLINE_QUEUE_KEY = "OFFLINE_QUEUE";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [drivers, setDrivers] = useState<DriverState[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const driversRef = useRef<DriverState[]>([]); 
  
  const [currentUserDriverId, setCurrentUserDriverId] = useState<string>('');
  const [inputDriverName, setInputDriverName] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // --- SINCRONIZAÇÃO OFFLINE ---
  const processOfflineQueue = async () => {
    if (!navigator.onLine) return;
    const queueRaw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!queueRaw) return;

    const queue = JSON.parse(queueRaw);
    if (queue.length === 0) return;

    setIsSyncing(true);
    console.log(`Sincronizando ${queue.length} itens offline...`);

    const newQueue = [];
    for (const item of queue) {
        try {
            if (item.type === 'COMPLETE_DELIVERY') {
                const { locationId, remainingRoute, isLast, historyData } = item.payload;
                await updateLocationStatusInDB(locationId, 'COMPLETED');
                if (isLast && historyData) {
                    await saveRouteToHistoryDB(historyData);
                }
                await updateDriverRouteInDB(item.payload.driverId, remainingRoute);
            }
        } catch (e) {
            console.error("Falha ao sincronizar item:", item, e);
            newQueue.push(item); // Mantém na fila se falhar novamente
        }
    }

    if (newQueue.length > 0) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(newQueue));
    } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
        alert("Todos os dados offline foram sincronizados com sucesso!");
    }
    setIsSyncing(false);
  };

  useEffect(() => {
    seedDatabaseIfEmpty();
    
    const handleOnline = () => { setIsOnline(true); processOfflineQueue(); };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Tenta processar fila ao iniciar se estiver online
    processOfflineQueue();

    const restoreSession = async () => {
        const savedDriverId = localStorage.getItem(STORAGE_KEY_DRIVER);
        const savedView = localStorage.getItem(STORAGE_KEY_VIEW);

        if (savedDriverId && savedView === AppView.DRIVER) {
            setIsLoginLoading(true);
            const existingDriver = await getDriverById(savedDriverId);
            if (existingDriver) {
                setCurrentUserDriverId(savedDriverId);
                setCurrentView(AppView.DRIVER);
            } else {
                localStorage.removeItem(STORAGE_KEY_DRIVER);
                localStorage.removeItem(STORAGE_KEY_VIEW);
            }
            setIsLoginLoading(false);
        } else if (savedView === AppView.ADMIN) {
            setCurrentView(AppView.ADMIN);
        }
    };

    restoreSession();
    const unsubscribeDrivers = subscribeToDrivers((data) => setDrivers(data));
    const unsubscribeLocations = subscribeToLocations((data) => setLocations(data));
    
    return () => {
        unsubscribeDrivers();
        unsubscribeLocations();
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- RASTREAMENTO GPS (Hook Logic Integrada) ---
  useEffect(() => {
    let watchId: number;
    const shouldTrack = currentView === AppView.DRIVER && currentUserDriverId && driversRef.current.find(d => d.id === currentUserDriverId)?.status !== 'BREAK';

    if (shouldTrack && "geolocation" in navigator) {
        let lastLat = 0, lastLng = 0, lastTime = 0;
        
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setGpsError(null);
            const { latitude, longitude, speed } = position.coords;
            const now = Date.now();
            
            // Filtro de distância mínima (50 metros) ou tempo (30s) para evitar writes excessivos no Firebase
            const dist = Math.sqrt(Math.pow(latitude - lastLat, 2) + Math.pow(longitude - lastLng, 2));
            if (dist > 0.0005 || now - lastTime > 30000) { 
                const speedKmh = (speed || 0) * 3.6;
                const status = speedKmh > 3 ? 'MOVING' : 'IDLE';
                const address = speedKmh > 3 ? `Em movimento (${speedKmh.toFixed(0)} km/h)` : `Parado: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                
                updateDriverLocationInDB(currentUserDriverId, latitude, longitude, address, status);
                lastLat = latitude; lastLng = longitude; lastTime = now;
            }
          },
          (err) => setGpsError(err.code === 1 ? "Permissão GPS Negada" : "Sinal GPS Fraco"),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
        );
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentView, currentUserDriverId]); // Dependências reduzidas

  // --- HANDLERS (Login/Logout/Actions) ---
  const handleDriverLogin = async () => {
    const trimmedName = inputDriverName.trim();
    if (!trimmedName) return;
    setIsLoginLoading(true);
    try {
        const existing = await findDriverByName(trimmedName);
        let id = existing?.id || `driver-${Date.now()}`;
        if (existing && !confirm(`Entrar como ${trimmedName}?`)) { setIsLoginLoading(false); return; }
        
        if (!existing) {
            await registerDriverInDB({ id, name: trimmedName, currentCoords: LOCATIONS_DB[0].coords, currentAddress: 'Iniciando', route: [], status: 'IDLE', speed: 0 });
        }
        localStorage.setItem(STORAGE_KEY_DRIVER, id);
        localStorage.setItem(STORAGE_KEY_VIEW, AppView.DRIVER);
        setCurrentUserDriverId(id);
        setCurrentView(AppView.DRIVER);
    } catch (e) { alert("Erro login"); } finally { setIsLoginLoading(false); }
  };

  const handleAdminLogin = () => {
      if (adminPasswordInput === ADMIN_PASSWORD) {
          setCurrentView(AppView.ADMIN);
          localStorage.setItem(STORAGE_KEY_VIEW, AppView.ADMIN);
          setShowAdminLogin(false);
          setAdminPasswordInput('');
      } else setAdminError('Senha incorreta.');
  };

  const handleLogout = () => {
      localStorage.removeItem(STORAGE_KEY_DRIVER);
      localStorage.removeItem(STORAGE_KEY_VIEW);
      setCurrentUserDriverId('');
      setCurrentView(AppView.LOGIN);
  };

  const currentUserDriver = drivers.find(d => d.id === currentUserDriverId) || drivers[0] || { id: 'temp', name: 'Carregando...', currentCoords: LOCATIONS_DB[0].coords, route: [], status: 'IDLE', speed: 0, currentAddress: '' };

  // --- RENDER ---
  if (currentView === AppView.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative">
        {!isOnline && <div className="absolute top-0 w-full bg-red-600 text-white text-center py-2 text-xs font-bold">SEM INTERNET</div>}
        {showAdminLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs animate-in zoom-in-95">
                    <h3 className="font-bold mb-4">Acesso Admin</h3>
                    <input type="password" autoFocus placeholder="Senha" value={adminPasswordInput} onChange={e => setAdminPasswordInput(e.target.value)} className="w-full border p-3 rounded mb-2" />
                    {adminError && <p className="text-red-500 text-xs mb-2">{adminError}</p>}
                    <button onClick={handleAdminLogin} className="w-full bg-emerald-600 text-white py-3 rounded font-bold">Entrar</button>
                    <button onClick={() => setShowAdminLogin(false)} className="w-full mt-2 text-slate-400 text-sm">Cancelar</button>
                </div>
            </div>
        )}
        <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative z-10">
          <div className="flex justify-center mb-8"><H2Logo className="h-20" variant="dark" /></div>
          {isLoginLoading ? <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto" /> : (
            <div className="space-y-4">
                <button onClick={() => setShowAdminLogin(true)} className="w-full py-3 border rounded-xl flex justify-center items-center gap-2 font-bold text-slate-600"><Lock className="w-4 h-4" /> Admin</button>
                <div className="relative">
                    <UserCircle className="absolute top-4 left-3 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder="Seu Nome" value={inputDriverName} onChange={e => setInputDriverName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleDriverLogin()} className="w-full pl-10 py-4 bg-slate-50 border rounded-xl font-bold" />
                </div>
                <button onClick={handleDriverLogin} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold shadow-lg hover:bg-emerald-700">Entrar</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      {!isOnline && <div className="absolute top-0 w-full bg-red-600/90 text-white text-center py-1 text-[10px] font-bold z-[100]"><WifiOff className="w-3 h-3 inline mr-1" /> OFFLINE - DADOS SERÃO SALVOS LOCALMENTE</div>}
      {isSyncing && <div className="absolute top-0 w-full bg-blue-600/90 text-white text-center py-1 text-[10px] font-bold z-[100]"><RefreshCw className="w-3 h-3 inline mr-1 animate-spin" /> SINCRONIZANDO DADOS...</div>}

      <div className="absolute inset-0 z-0"><LeafletMap locations={locations} drivers={drivers} currentDriverId={currentView === AppView.DRIVER ? currentUserDriverId : undefined} isLayoutCompact={!isMobilePanelExpanded} /></div>

      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
         <div className="flex gap-2">
            <div className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm border text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${gpsError ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></div>
                {currentView === AppView.ADMIN ? 'Gestão' : 'Motorista'}
            </div>
            <button onClick={handleLogout} className="bg-red-500/90 text-white p-1.5 rounded-full shadow-md"><LogOut className="w-4 h-4" /></button>
         </div>
         {gpsError && <div className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold border border-red-100">⚠️ {gpsError}</div>}
      </div>

      <div className={`absolute z-20 bg-white shadow-2xl transition-all duration-500 ease-in-out flex flex-col md:top-4 md:left-4 md:bottom-4 md:w-[420px] md:rounded-3xl md:h-auto bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-100 ${isMobilePanelExpanded ? 'h-[85vh]' : 'h-[25vh]'} md:h-[calc(100vh-2rem)]`}>
          <div className="md:hidden flex items-center justify-center p-3 cursor-pointer" onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}>
             <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-1"></div>
             {isMobilePanelExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-3" /> : <ChevronUp className="w-5 h-5 text-slate-400 absolute right-4 top-3" />}
          </div>
          <div className="flex-1 overflow-hidden flex flex-col bg-white md:rounded-3xl">
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>}>
                {currentView === AppView.DRIVER ? (
                    <DriverView driverState={currentUserDriver} updateRoute={(r) => updateDriverRouteInDB(currentUserDriverId, r)} toggleStatus={() => updateDriverStatusInDB(currentUserDriverId, currentUserDriver.status === 'BREAK' ? 'IDLE' : 'BREAK')} completeDelivery={() => {}} />
                ) : (
                    <AdminView driverState={drivers[0]} allDrivers={drivers} allLocations={locations} onDistributeRoutes={async (ids) => distributeRoutesToAllDrivers(ids)} />
                )}
              </Suspense>
          </div>
      </div>
    </div>
  );
};
export default App;
