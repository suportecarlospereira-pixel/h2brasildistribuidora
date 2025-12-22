import React, { useState, useEffect, useRef } from 'react';
import { LeafletMap } from './components/LeafletMap';
import { DriverView } from './components/DriverView';
import { AdminView } from './components/AdminView';
import { AppView, DriverState, DeliveryLocation } from './types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from './constants';
import { LogOut, ChevronUp, ChevronDown, Crosshair, AlertTriangle, UserCircle, Lock, ShieldCheck } from 'lucide-react';
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

const ADMIN_PASSWORD = "lulaladrao";

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
    // 1. Seed Database if fresh
    seedDatabaseIfEmpty();

    // 2. Subscribe to Real-time Drivers
    const unsubscribeDrivers = subscribeToDrivers((data) => {
        setDrivers(data.length > 0 ? data : MOCK_DRIVERS_LIST);
    });

    // 3. Subscribe to Real-time Locations
    const unsubscribeLocations = subscribeToLocations((data) => {
        setLocations(data.length > 0 ? data : LOCATIONS_DB);
    });

    return () => {
        unsubscribeDrivers();
        unsubscribeLocations();
    };
  }, []);

  // --- ACTIONS ---

  const handleDriverLogin = async () => {
    // Validação Amigável
    if (!inputDriverName || !inputDriverName.trim()) {
        alert("Olá! Para iniciar seu turno e registrarmos sua rota, precisamos saber quem é você.\n\nPor favor, preencha seu nome no campo indicado.");
        return;
    }
    
    // Check configuration silently here, warn in UI if needed
    if (!isConfigured) {
        console.warn("Firebase credentials missing. Using local mock mode.");
    }

    const newDriverId = `driver-${Date.now()}`; // Unique ID for this session/device
    const newDriver: DriverState = {
        id: newDriverId,
        name: inputDriverName.trim(), // Ensure trimmed name is saved
        currentCoords: LOCATIONS_DB[0].coords, // Default start
        currentAddress: 'Iniciando turno...',
        route: [],
        isMoving: false,
        speed: 0.0005
    };

    // Register in DB
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

  // --- GPS LOGIC (REAL-TIME) ---
  useEffect(() => {
    let watchId: number;

    // Only track GPS if we are in Driver Mode and logged in
    if (currentView === AppView.DRIVER && currentUserDriverId) {
      if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
          (position) => {
            setGpsError(null);
            const { latitude, longitude, speed } = position.coords;
            const now = Date.now();
            
            // Calculate distance from last update to avoid jitter (drift when standing still)
            const lastPos = lastPositionRef.current;
            const dist = lastPos 
                ? Math.sqrt(Math.pow(latitude - lastPos.lat, 2) + Math.pow(longitude - lastPos.lng, 2))
                : 1; // Force update if no last pos

            // Logic: Update DB if:
            // 1. Moved > ~3 meters (0.00003 deg) AND > 1.5 seconds have passed (Smooth movement)
            // 2. OR > 10 seconds have passed (Heartbeat to keep online status)
            // 3. OR it's the very first update
            if (!lastPos || (dist > 0.00003 && now - lastUpdateTimeRef.current > 1500) || (now - lastUpdateTimeRef.current > 10000)) {
                
                // Format a dynamic status based on speed
                // speed is in m/s. Multiply by 3.6 for km/h
                const currentSpeedKmH = speed ? speed * 3.6 : 0;
                let addressStr = `Localização: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                
                if (currentSpeedKmH > 1) {
                    addressStr = `Em movimento - ${currentSpeedKmH.toFixed(0)} km/h`;
                } else {
                    addressStr = `Parado em: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
                }

                updateDriverLocationInDB(
                    currentUserDriverId, 
                    latitude, 
                    longitude, 
                    addressStr
                );

                // Update refs
                lastPositionRef.current = { lat: latitude, lng: longitude };
                lastUpdateTimeRef.current = now;
            }
          },
          (error) => {
            let msg = "Erro desconhecido de GPS";
            if (error.code === 1) msg = "Permissão de localização negada.";
            if (error.code === 2) msg = "Sinal de GPS indisponível.";
            if (error.code === 3) msg = "Timeout ao buscar GPS.";
            setGpsError(msg);
            console.warn("GPS Error:", error);
          },
          { 
            enableHighAccuracy: true, // Critical for "Real Time" feel
            timeout: 10000,
            maximumAge: 0 // Do not use cached positions
          }
        );
      } else {
        setGpsError("Geolocalização não suportada.");
      }
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [currentView, currentUserDriverId]); // Removed `drivers` dependency to prevent loop

  // --- HANDLERS ---
  
  const updateSingleDriverRoute = async (driverId: string, newRoute: DeliveryLocation[]) => {
      await updateDriverRouteInDB(driverId, newRoute);
      if (driverId === currentUserDriverId) setIsMobilePanelExpanded(false);
  };

  const toggleDriverMovement = async (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
          await setDriverMovingStatus(driverId, !driver.isMoving);
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
      
      // Update each driver's route in the DB
      for (const [dId, locIds] of Object.entries(distribution)) {
          const assignedLocs = locIds.map(id => selectedLocs.find(l => l.id === id)).filter((l): l is DeliveryLocation => !!l);
          if (assignedLocs.length > 0) {
              await updateDriverRouteInDB(dId, assignedLocs);
          }
      }
  };

  const requestLocation = () => {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            () => setGpsError(null), 
            () => alert("Por favor, permita o acesso à localização.")
        );
    }
  };

  const currentUserDriver = drivers.find(d => d.id === currentUserDriverId) || drivers[0];

  // --- RENDER ---

  if (currentView === AppView.LOGIN) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        
        {/* Admin Login Modal */}
        {showAdminLogin && (
            <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-600" />
                            Acesso Administrativo
                        </h3>
                        <button onClick={() => setShowAdminLogin(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                    </div>
                    <input 
                        type="password" 
                        autoFocus
                        placeholder="Senha do Administrador"
                        value={adminPasswordInput}
                        onChange={(e) => setAdminPasswordInput(e.target.value)}
                        className="w-full bg-slate-100 border border-slate-300 rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {adminError && <p className="text-red-500 text-xs font-bold mb-3">{adminError}</p>}
                    <button 
                        onClick={handleAdminLoginSubmit}
                        className="w-full bg-emerald-600 text-white font-bold py-3 rounded-lg hover:bg-emerald-700 transition"
                    >
                        Entrar
                    </button>
                </div>
            </div>
        )}

        {/* Background Effects */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600 rounded-full blur-[100px] opacity-20 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[100px] opacity-20 animate-pulse delay-1000"></div>

        <div className="bg-white/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center z-10 relative">
          
          {/* LOGO SECTION */}
          <div className="flex justify-center mb-8">
              <H2Logo className="h-20" variant="dark" />
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={() => setShowAdminLogin(true)}
              className="w-full py-4 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition font-bold text-lg shadow-sm active:scale-95 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4 text-slate-400" />
              Acesso Administrativo
            </button>
            
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCircle className="text-slate-400 w-5 h-5" />
                </div>
                <input 
                    type="text" 
                    placeholder="Seu nome (Motorista)" 
                    value={inputDriverName}
                    onChange={(e) => setInputDriverName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleDriverLogin();
                        }
                    }}
                    className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-300 text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400 mb-2 transition-all font-medium"
                />
            </div>

            <button 
              onClick={handleDriverLogin}
              className="w-full py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition font-bold text-lg shadow-lg shadow-emerald-200 active:scale-95"
            >
              Iniciar Turno
            </button>
          </div>
          <p className="mt-8 text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
             <span className={`w-2 h-2 rounded-full ${isConfigured ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span> 
             {isConfigured ? 'Sistema Conectado • H2 Brasil' : 'Banco de Dados Desconectado'}
          </p>
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
        />
      </div>

      {/* 2. TOP CONTROLS */}
      <div className="absolute top-4 right-4 z-30 flex flex-col items-end gap-2">
         <div className="flex gap-2">
            <div className="bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm border border-white/50 text-xs font-bold text-slate-700 uppercase tracking-wide">
                {currentView === AppView.ADMIN ? 'Gestão' : 'Motorista'}
            </div>
            <button 
                onClick={() => setCurrentView(AppView.LOGIN)} 
                className="bg-red-500/90 text-white p-1.5 rounded-full shadow-md hover:bg-red-600 transition-colors"
            >
                <LogOut className="w-4 h-4" />
            </button>
         </div>
         
         {/* GPS Indicator (Only for Driver) */}
         {currentView === AppView.DRIVER && (
             <>
                {!gpsError ? (
                    <div className="bg-emerald-500/90 backdrop-blur text-white px-3 py-1 rounded-full shadow-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1 animate-pulse">
                        <Crosshair className="w-3 h-3" />
                        Rastreio Ativo
                    </div>
                ) : (
                    <div className="bg-amber-500/90 backdrop-blur text-white px-3 py-1 rounded-full shadow-md text-[10px] font-bold uppercase tracking-wide flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {gpsError}
                    </div>
                )}
             </>
         )}
      </div>

      {/* 3. RESPONSIVE PANEL */}
      <div 
        className={`
            absolute z-20 bg-white shadow-2xl transition-all duration-500 ease-in-out flex flex-col
            /* Desktop Styles */
            md:top-4 md:left-4 md:bottom-4 md:w-[420px] md:rounded-3xl md:h-auto
            /* Mobile Styles */
            bottom-0 left-0 right-0 rounded-t-3xl border-t border-slate-100
            ${isMobilePanelExpanded ? 'h-[85vh]' : 'h-[25vh]'} md:h-[calc(100vh-2rem)]
        `}
      >
          {/* Mobile Handle */}
          <div 
             className="md:hidden flex items-center justify-center p-3 cursor-pointer active:bg-slate-50 rounded-t-3xl touch-none"
             onClick={() => setIsMobilePanelExpanded(!isMobilePanelExpanded)}
          >
             <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-1"></div>
             {isMobilePanelExpanded ? (
                 <ChevronDown className="w-5 h-5 text-slate-400 absolute right-4 top-3" />
             ) : (
                 <ChevronUp className="w-5 h-5 text-slate-400 absolute right-4 top-3" />
             )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col bg-white md:rounded-3xl">
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
          </div>
      </div>
    </div>
  );
};

export default App;