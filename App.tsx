import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { AppView, DriverState, DeliveryLocation } from './types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from './constants';
import { LogOut, ChevronUp, ChevronDown, Crosshair, AlertTriangle, UserCircle, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { distributeAndOptimizeRoutes } from './services/geminiService';
import { H2Logo } from './components/Logo';
import { 
    subscribeToDrivers, 
    subscribeToLocations, 
    updateDriverLocationInDB, 
    registerDriverInDB, 
    updateDriverRouteInDB, 
    setDriverMovingStatus,
    seedDatabaseIfEmpty,
    updateLocationStatusInDB
} from './services/dbService';
import { isConfigured } from './firebaseConfig';

// Lazy load view components
const DriverView = lazy(() => import('./components/DriverView').then(m => ({ default: m.DriverView })));
const AdminView = lazy(() => import('./components/AdminView').then(m => ({ default: m.AdminView })));

const ADMIN_PASSWORD = "lulaladrao";

const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center h-full w-full bg-white space-y-4 p-8 text-center">
    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
    <div>
      <p className="font-bold text-slate-800">Carregando interface...</p>
      <p className="text-sm text-slate-500">Preparando ferramentas inteligentes</p>
    </div>
  </div>
);

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);
  
  // Real-time Data
  const [drivers, setDrivers] = useState<DriverState[]>([]);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  
  const [currentUserDriverId, setCurrentUserDriverId] = useState<string>('');
  const [inputDriverName, setInputDriverName] = useState('');
  
  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminError, setAdminError] = useState('');

  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isMobilePanelExpanded, setIsMobilePanelExpanded] = useState(false);

  // Refs for GPS throttling
  const lastPositionRef = useRef<{lat: number; lng: number} | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  // --- INITIALIZATION ---
  useEffect(() => {
    seedDatabaseIfEmpty();
    // A subscrição agora é soberana: se vier vazio do DB, mostra vazio.
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
        alert("Olá! Para iniciar seu turno, precisamos saber quem é você. Preencha seu nome.");
        return;
    }
    
    const newDriverId = `driver-${Date.now()}`;
    const newDriver: DriverState = {
        id: newDriverId,
        name: inputDriverName.trim(),
        currentCoords: LOCATIONS_DB[0].coords,
        currentAddress: 'Iniciando turno...',
        route: [],
        isMoving: false,
        speed: 0.0005
    };

    await registerDriverInDB(newDriver);
    setCurrentUserDriverId(newDriverId);
    setCurrentView(AppView.DRIVER);
    requestLocation();
  };

  const handleAdminLoginSubmit = () => {
      if (adminPasswordInput === ADMIN_PASSWORD) {
          setCurrentView(AppView.ADMIN);
          setShowAdminLogin(false);
          setAdminError('');
          setAdminPasswordInput('');
      } else {
          setAdminError('Senha incorreta.');
      }
  };

  // --- GPS LOGIC ---
  useEffect(() => {
    let watchId: number;
    if (currentView === AppView.DRIVER && currentUserDriverId) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setGpsError(null);
            const { latitude, longitude, speed } = position.coords;
            const now = Date.now();
            const lastPos = lastPositionRef.current;
            const dist = lastPos 
                ? Math.sqrt(Math.pow(latitude - lastPos.lat, 2) + Math.pow(longitude - lastPos.lng, 2))
                : 1;

            if (!lastPos || (dist > 0.00003 && now - lastUpdateTimeRef.current > 1500) || (now - lastUpdateTimeRef.current > 10000)) {
                const currentSpeedKmH = speed ? speed * 3.6 : 0;
                let addressStr = currentSpeedKmH > 1 
                    ? `Em movimento - ${currentSpeedKmH.toFixed(0)} km/h`
                    : `Parado em: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

                updateDriverLocationInDB(currentUserDriverId, latitude, longitude, addressStr);
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
    return () => { if (watchId) navigator.geolocation.clearWatch(watchId); };
  }, [currentView, currentUserDriverId]);

  const updateSingleDriverRoute = async (driverId: string, newRoute: DeliveryLocation[]) => {
      await updateDriverRouteInDB(driverId, newRoute);
      if (driverId === currentUserDriverId) setIsMobilePanelExpanded(false);
  };

  const toggleDriverMovement = async (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) await setDriverMovingStatus(driverId, !driver.isMoving);
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
        navigator.geolocation.getCurrentPosition(() => setGpsError(null), () => alert("Por favor, permita a localização."));
    }
  };

  const currentUserDriver = drivers.find(d => d.id === currentUserDriverId) || drivers[0];

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
            <button onClick={handleDriverLogin} className="w-full py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold text-lg shadow-lg shadow-emerald-200 active:scale-95">Iniciar Turno</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-200">
      {/* 1. MAP LAYER */}
      <div className="absolute inset-0 z-0">
        <LeafletMap 
            locations={locations} 
            drivers={drivers} 
            currentDriverId={currentView === AppView.DRIVER ? currentUserDriverId : undefined}
            isLayoutCompact={!isMobilePanelExpanded}
        />
      </div>

      {/* 2. TOP CONTROLS */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
         <div className="flex gap-2">
            <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/50 text-xs font-bold text-slate-700 uppercase tracking-wide">
                {currentView === AppView.ADMIN ? 'Gestão' : 'Motorista'}
            </div>
            <button onClick={() => setCurrentView(AppView.LOGIN)} className="bg-red-500/90 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors">
                <LogOut className="w-4 h-4" />
            </button>
         </div>
      </div>

      {/* 3. RESPONSIVE PANEL */}
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
                        toggleMovement={() => toggleDriverMovement(currentUserDriverId)}
                        completeDelivery={() => completeDriverDelivery(currentUserDriverId)}
                    />
                ) : (
                    <AdminView 
                        driverState={drivers[0]} 
                        allDrivers={drivers}
                        allLocations={locations}
                        onDistributeRoutes={distributeRoutesToAllDrivers}
                    />
                )}
              </Suspense>
          </div>
      </div>
    </div>
  );
};

export default App;