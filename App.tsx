// NOME DO ARQUIVO: App.tsx
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { AppView, DriverState, DeliveryLocation } from './types';
import { LOCATIONS_DB } from './constants';
import { LogOut, ChevronUp, ChevronDown, UserCircle, Lock, ShieldCheck, Loader2 } from 'lucide-react';
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
    getDriverById
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
      <p className="text-sm text-slate-500">Sincronizando dados logísticos</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  
  // Dados em Tempo Real
  const [drivers, setDrivers] = useState<DriverState[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  
  // Refs para acesso dentro do GPS sem reiniciar o efeito
  const driversRef = useRef<DriverState[]>([]); 
  
  const [currentUserDriverId, setCurrentUserDriverId] = useState<string>('');
  const [inputDriverName, setInputDriverName] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);

  const lastPositionRef = useRef<{lat: number; lng: number} | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // Mantém o ref sincronizado com o state
  useEffect(() => {
      driversRef.current = drivers;
  }, [drivers]);

  // --- INITIALIZATION ---
  useEffect(() => {
    seedDatabaseIfEmpty();

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

    const unsubscribeDrivers = subscribeToDrivers((data) => {
        setDrivers(data);
    });
    const unsubscribeLocations = subscribeToLocations((data) => {
        setLocations(data);
    });
    return () => {
        unsubscribeDrivers();
        unsubscribeLocations();
    };
  }, []);

  // --- ACTIONS ---
  const handleDriverLogin = async () => {
    if (!inputDriverName || !inputDriverName.trim()) {
        alert("Por favor, digite seu nome para iniciar.");
        return;
    }
    setIsLoginLoading(true);
    try {
        const newDriverId = `driver-${Date.now()}`;
        const newDriver: DriverState = {
            id: newDriverId,
            name: inputDriverName.trim(),
            currentCoords: LOCATIONS_DB[0].coords,
            currentAddress: 'Iniciando turno...',
            route: [],
            status: 'IDLE',
            speed: 0
        };
        await registerDriverInDB(newDriver);
        localStorage.setItem(STORAGE_KEY_DRIVER, newDriverId);
        localStorage.setItem(STORAGE_KEY_VIEW, AppView.DRIVER);
        setCurrentUserDriverId(newDriverId);
        setCurrentView(AppView.DRIVER);
        requestLocation();
    } catch (error) {
        alert("Erro ao conectar, mas iniciando em modo offline.");
        setCurrentView(AppView.DRIVER);
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

  // --- OTIMIZAÇÃO DO GPS ---
  useEffect(() => {
    let watchId: number;

    // Função interna para verificar status sem depender do state 'drivers'
    const shouldTrack = () => {
        if (currentView !== AppView.DRIVER || !currentUserDriverId) return false;
        const driver = driversRef.current.find(d => d.id === currentUserDriverId);
        // Se não achar o driver (recém logado) ou status não for BREAK, rastreia.
        return !driver || driver.status !== 'BREAK';
    };

    if (shouldTrack()) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            // Verificação dupla dentro do callback
            if (!shouldTrack()) return;

            setGpsError(null);
            const { latitude, longitude, speed } = position.coords;
            const now = Date.now();
            const lastPos = lastPositionRef.current;
            
            // Filtro de distância (jitter filter)
            const dist = lastPos 
                ? Math.sqrt(Math.pow(latitude - lastPos.lat, 2) + Math.pow(longitude - lastPos.lng, 2))
                : 1;

            // Envia se: (Não tem ultima posição) OU (Moveu > 3 metros E passou 1.5s) OU (Passou 10s parado)
            if (!lastPos || (dist > 0.00003 && now - lastUpdateTimeRef.current > 1500) || (now - lastUpdateTimeRef.current > 10000)) {
                const currentSpeedKmH = speed ? speed * 3.6 : 0;
                let addressStr = currentSpeedKmH > 1 
                    ? `Em movimento - ${currentSpeedKmH.toFixed(0)} km/h`
                    : `Parado em: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                
                const status = currentSpeedKmH > 1 ? 'MOVING' : 'IDLE';

                updateDriverLocationInDB(currentUserDriverId, latitude, longitude, addressStr, status);
                lastPositionRef.current = { lat: latitude, lng: longitude };
                lastUpdateTimeRef.current = now;
            }
          },
          (error) => {
            let msg = "Erro de GPS";
            if (error.code === 1) msg = "Permissão negada.";
            setGpsError(msg);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
    // Removemos 'drivers' das dependências para evitar reinicialização constante
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentView, currentUserDriverId]); // Dependências limpas

  const updateSingleDriverRoute = async (driverId: string, newRoute: DeliveryLocation[]) => {
      await updateDriverRouteInDB(driverId, newRoute);
      if (driverId === currentUserDriverId) setIsMobilePanelExpanded(false);
  };

  const toggleDriverStatus = async (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
          // Lógica de alternância inteligente
          const newStatus = driver.status === 'BREAK' ? 'IDLE' : 'BREAK';
          
          // Se estiver saindo do intervalo, forçamos uma atualização de GPS imediata no DB
          if (newStatus === 'IDLE') {
             requestLocation(); 
          }
          
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
                // Força atualização inicial ao logar/sair do intervalo
                if(currentUserDriverId) {
                    updateDriverLocationInDB(currentUserDriverId, pos.coords.latitude, pos.coords.longitude, "Localizado", 'IDLE');
                }
            }, 
            () => alert("Por favor, permita a localização para o monitoramento funcionar.")
        );
    }
  };

  const currentUserDriver = drivers.find(d => d.id === currentUserDriverId) || drivers[0] || {
      id: 'temp', name: inputDriverName, currentCoords: LOCATIONS_DB[0].coords, route: [], status: 'IDLE', isMoving: false, currentAddress: '', speed: 0
  };

  if (currentView === AppView.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
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
                    <input 
                        type="password" autoFocus placeholder="Senha" value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {adminError && <p className="text-red-500 text-xs font-bold mb-3">{adminError}</p>}
                    <button onClick={handleAdminLoginSubmit} className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition">Entrar</button>
                </div>
            </div>
        )}
        
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center z-10 relative">
          <div className="flex justify-center mb-8">
              <H2Logo className="h-20" variant="dark" />
          </div>
          
          {isLoginLoading ? (
            <div className="py-10 flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-sm font-bold text-slate-500">Iniciando sistema...</p>
            </div>
          ) : (
            <div className="space-y-4">
                <button onClick={() => setShowAdminLogin(true)} className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-bold text-lg shadow-sm flex items-center justify-center gap-2">
                <Lock className="w-4 h-4 text-slate-400" /> Admin
                </button>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserCircle className="text-slate-400 w-5 h-5" />
                    </div>
                    <input 
                        type="text" placeholder="Nome do Motorista" value={inputDriverName}
                        onChange={(e) => setInputDriverName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleDriverLogin(); }}
                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    />
                </div>
                <button 
                    onClick={handleDriverLogin} 
                    disabled={isLoginLoading}
                    className="w-full py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold text-lg shadow-lg shadow-emerald-200 active:scale-95 disabled:opacity-50 disabled:scale-100"
                >
                    Iniciar Turno
                </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      <div className="absolute inset-0 z-0">
        <LeafletMap 
            locations={locations} 
            drivers={drivers} 
            currentDriverId={currentView === AppView.DRIVER ? currentUserDriverId : undefined}
            isLayoutCompact={!isMobilePanelExpanded}
        />
      </div>

      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
         <div className="flex gap-2">
            <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/50 text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${gpsError ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`}></div>
                {currentView === AppView.ADMIN ? 'Gestão' : 'Motorista'}
            </div>
            <button onClick={handleLogout} className="bg-red-500/90 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors" title="Sair">
                <LogOut className="w-4 h-4" />
            </button>
         </div>
         {gpsError && (
             <div className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-bold border border-red-100 shadow-sm">
                 ⚠️ {gpsError}
             </div>
         )}
      </div>

      <div 
        className={`
            absolute z-20 bg-white shadow-2xl transition-all duration-500 ease-in-out flex flex-col
            md:top-4 md:left-4 md:bottom-4 md:w-[420px] md:rounded-3xl md:h-auto
            bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-100
            ${isMobilePanelExpanded ? 'h-[85vh]' : 'h-[25vh]'} md:h-[calc(100vh-2rem)]
        `}
      >
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
                    <AdminView 
                        driverState={drivers[0]} 
                        allDrivers={drivers}
                        allLocations={locations}
                        onDistributeRoutes={distributeAndOptimizeRoutes ? distributeRoutesToAllDrivers : async () => alert("IA não configurada.")}
                    />
                )}
              </Suspense>
          </div>
      </div>
    </div>
  );
};

export default App;