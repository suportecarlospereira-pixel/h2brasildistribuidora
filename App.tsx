// NOME DO ARQUIVO: App.tsx
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { AppView, DriverState, DeliveryLocation } from './types';
import { LOCATIONS_DB } from './constants';
import { LogOut, ChevronUp, ChevronDown, UserCircle, Lock, ShieldCheck, Loader2, WifiOff } from 'lucide-react';
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
    findDriverByName // Essencial para evitar duplicidade
} from './services/dbService';

const DriverView = lazy(() => import('./components/DriverView').then(m => ({ default: m.DriverView })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));

const ADMIN_PASSWORD = "lulaladrao";
const STORAGE_KEY_DRIVER = "H2_DRIVER_ID";
const STORAGE_KEY_VIEW = "H2_LAST_VIEW";

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-white space-y-4 p-8 text-center">
    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
    <div>
      <p className="font-bold text-slate-800">Carregando sistema...</p>
      <p className="text-sm text-slate-500">Sincronizando dados...</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [drivers, setDrivers] = useState<DriverState[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  
  // Refs para performance do GPS
  const driversRef = useRef<DriverState[]>([]); 
  const lastPositionRef = useRef<{lat: number; lng: number} | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  
  const [currentUserDriverId, setCurrentUserDriverId] = useState<string>('');
  const [inputDriverName, setInputDriverName] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);

  useEffect(() => { driversRef.current = drivers; }, [drivers]);

  // INICIALIZAÇÃO
  useEffect(() => {
    seedDatabaseIfEmpty();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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

  // LOGIN INTELIGENTE
  const handleDriverLogin = async () => {
    const trimmedName = inputDriverName.trim();
    if (!trimmedName) return alert("Digite seu nome.");
    
    setIsLoginLoading(true);

    try {
        const existingDriver = await findDriverByName(trimmedName);
        let driverId = '';
        let driverData: DriverState;

        if (existingDriver) {
            if (confirm(`Já existe um cadastro para "${trimmedName}". É você? Clique em OK para entrar.`)) {
                driverId = existingDriver.id;
                driverData = { ...existingDriver, lastSeen: Date.now(), status: 'IDLE' };
            } else {
                alert("Por favor, use um nome diferente (ex: João Silva 2) para evitar confusão.");
                setIsLoginLoading(false);
                return; 
            }
        } else {
            driverId = `driver-${Date.now()}`;
            driverData = {
                id: driverId,
                name: trimmedName,
                currentCoords: LOCATIONS_DB[0].coords,
                currentAddress: 'Iniciando...',
                route: [],
                status: 'IDLE',
                speed: 0
            };
        }

        await registerDriverInDB(driverData);
        localStorage.setItem(STORAGE_KEY_DRIVER, driverId);
        localStorage.setItem(STORAGE_KEY_VIEW, AppView.DRIVER);
        setCurrentUserDriverId(driverId);
        setCurrentView(AppView.DRIVER);
        requestLocation();

    } catch (error) {
        alert("Erro no login. Tente novamente.");
    } finally {
        setIsLoginLoading(false);
    }
  };

  const handleAdminLoginSubmit = () => {
      if (adminPasswordInput === ADMIN_PASSWORD) {
          setCurrentView(AppView.ADMIN);
          localStorage.setItem(STORAGE_KEY_VIEW, AppView.ADMIN);
          setShowAdminLogin(false);
          setAdminError('');
          setAdminPasswordInput('');
      } else {
          setAdminError('Senha incorreta.');
      }
  };

  const handleLogout = () => {
      localStorage.removeItem(STORAGE_KEY_DRIVER);
      localStorage.removeItem(STORAGE_KEY_VIEW);
      setCurrentUserDriverId('');
      setCurrentView(AppView.LOGIN);
  };

  // GPS OTIMIZADO
  useEffect(() => {
    let watchId: number;
    const shouldTrack = () => {
        if (currentView !== AppView.DRIVER || !currentUserDriverId) return false;
        const driver = driversRef.current.find(d => d.id === currentUserDriverId);
        return !driver || driver.status !== 'BREAK';
    };

    if (shouldTrack()) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            if (!shouldTrack()) return;
            setGpsError(null);
            
            const { latitude, longitude, speed } = position.coords;
            const now = Date.now();
            const lastPos = lastPositionRef.current;
            const dist = lastPos ? Math.sqrt(Math.pow(latitude - lastPos.lat, 2) + Math.pow(longitude - lastPos.lng, 2)) : 1;

            if (!lastPos || (dist > 0.00003 && now - lastUpdateTimeRef.current > 1500) || (now - lastUpdateTimeRef.current > 10000)) {
                const currentSpeedKmH = speed ? speed * 3.6 : 0;
                const derivedStatus = currentSpeedKmH > 1 ? 'MOVING' : 'IDLE';
                const addressStr = derivedStatus === 'MOVING' 
                    ? `Em movimento - ${currentSpeedKmH.toFixed(0)} km/h` 
                    : `Parado em: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                updateDriverLocationInDB(currentUserDriverId, latitude, longitude, addressStr, derivedStatus);
                lastPositionRef.current = { lat: latitude, lng: longitude };
                lastUpdateTimeRef.current = now;
            }
          },
          (error) => {
            setGpsError(error.code === 1 ? "Permissão GPS Negada" : "Sinal GPS Perdido");
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentView, currentUserDriverId]); 

  const updateSingleDriverRoute = async (driverId: string, newRoute: DeliveryLocation[]) => {
      await updateDriverRouteInDB(driverId, newRoute);
      if (driverId === currentUserDriverId) setIsMobilePanelExpanded(false);
  };

  const toggleDriverStatus = async (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
          const newStatus = driver.status === 'BREAK' ? 'IDLE' : 'BREAK';
          if (newStatus === 'IDLE') requestLocation();
          await updateDriverStatusInDB(driverId, newStatus);
      }
  };

  const completeDriverDelivery = async (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver && driver.route.length > 0) {
          const finishedLocation = driver.route[0];
          const remainingRoute = driver.route.slice(1);
          await updateLocationStatusInDB(finishedLocation.id, 'COMPLETED');
          await updateDriverRouteInDB(driverId, remainingRoute);
      }
  };

  const distributeRoutesToAllDrivers = async (selectedLocationIds: string[]) => {
      const selectedLocs = locations.filter(l => selectedLocationIds.includes(l.id));
      if (selectedLocs.length === 0) return;
      const distribution = await distributeAndOptimizeRoutes(drivers, selectedLocs);
      for (const [dId, locIds] of Object.entries(distribution)) {
          const assignedLocs = locIds.map(id => selectedLocs.find(l => l.id === id)).filter((l): l is DeliveryLocation => !!l);
          if (assignedLocs.length > 0) await updateDriverRouteInDB(dId, assignedLocs);
      }
  };

  const requestLocation = () => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsError(null);
                if(currentUserDriverId) updateDriverLocationInDB(currentUserDriverId, pos.coords.latitude, pos.coords.longitude, "Localizado", 'IDLE');
            }, 
            () => alert("Ative a localização.")
        );
    }
  };

  const currentUserDriver = drivers.find(d => d.id === currentUserDriverId) || drivers[0] || {
      id: 'temp', name: inputDriverName, currentCoords: LOCATIONS_DB[0].coords, route: [], status: 'IDLE', speed: 0, currentAddress: ''
  };

  if (currentView === AppView.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        {!isOnline && (
            <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-xs font-bold text-center py-2 z-50">
                <WifiOff className="w-3 h-3 inline mr-1" /> SEM CONEXÃO COM A INTERNET
            </div>
        )}
        
        {showAdminLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            Acesso Admin
                        </h3>
                        <button onClick={() => setShowAdminLogin(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <input type="password" autoFocus placeholder="Senha" value={adminPasswordInput} onChange={(e) => setAdminPasswordInput(e.target.value)} className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    {adminError && <p className="text-red-500 text-xs font-bold mb-3">{adminError}</p>}
                    <button onClick={handleAdminLoginSubmit} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition">Entrar</button>
                </div>
            </div>
        )}
        
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center z-10 relative">
          <div className="flex justify-center mb-8"><H2Logo className="h-20" variant="dark" /></div>
          {isLoginLoading ? (
            <div className="py-10 flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-500">Buscando usuário...</p>
            </div>
          ) : (
            <div className="space-y-4">
                <button onClick={() => setShowAdminLogin(true)} className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-bold text-lg shadow-sm flex items-center justify-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> Admin</button>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserCircle className="text-slate-400 w-5 h-5" /></div>
                    <input type="text" placeholder="Nome do Motorista" value={inputDriverName} onChange={(e) => setInputDriverName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleDriverLogin(); }} className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
                </div>
                <button onClick={handleDriverLogin} disabled={isLoginLoading} className="w-full py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold text-lg shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:scale-100">Iniciar Turno</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      {!isOnline && (
          <div className="absolute top-0 left-0 right-0 bg-red-600/90 backdrop-blur text-white text-[10px] font-bold text-center py-1 z-[100] animate-pulse">
              <WifiOff className="w-3 h-3 inline mr-1" /> VOCÊ ESTÁ OFFLINE
          </div>
      )}

      <div className="absolute inset-0 z-0">
        <LeafletMap locations={locations} drivers={drivers} currentDriverId={currentView === AppView.DRIVER ? currentUserDriverId : undefined} isLayoutCompact={!isMobilePanelExpanded} />
      </div>

      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
         <div className="flex gap-2">
            <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/50 text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${gpsError ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></div>
                {currentView === AppView.ADMIN ? 'Gestão' : 'Motorista'}
            </div>
            <button onClick={handleLogout} className="bg-red-500/90 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors" title="Sair"><LogOut className="w-4 h-4" /></button>
         </div>
         {gpsError && (
             <div className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold border border-red-100 shadow-sm">⚠️ {gpsError}</div>
         )}
      </div>

      <div className={`absolute z-20 bg-white shadow-2xl transition-all duration-500 ease-in-out flex flex-col md:top-4 md:left-4 md:bottom-4 md:w-[420px] md:rounded-3xl md:h-auto bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-100 ${isMobilePanelExpanded ? 'h-[85vh]' : 'h-[25vh]'} md:h-[calc(100vh-2rem)]`}>
          <div className="md:hidden flex items-center justify-center p-3 cursor-pointer active:bg-slate-50 rounded-t-3xl touch-none" onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}>
             <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-1"></div>
             {isMobilePanelExpanded ? <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-3" /> : <ChevronUp className="w-5 h-5 text-slate-400 absolute right-4 top-3" />}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col bg-white md:rounded-3xl">
              <Suspense fallback={<LoadingFallback />}>
                {currentView === AppView.DRIVER ? (
                    <DriverView 
                        driverState={currentUserDriver} 
                        updateRoute={(route) => updateSingleDriverRoute(currentUserDriverId, route)} 
                        toggleStatus={() => toggleDriverStatus(currentUserDriverId)} 
                        completeDelivery={() => completeDriverDelivery(currentUserDriverId)} 
                    />
                ) : (
                    <AdminView driverState={drivers[0]} allDrivers={drivers} allLocations={locations} onDistributeRoutes={distributeAndOptimizeRoutes ? distributeRoutesToAllDrivers : async () => alert("IA não configurada.")} />
                )}
              </Suspense>
          </div>
      </div>
    </div>
  );
};

export default App;
