// NOME DO ARQUIVO: services/dbService.ts
import { db, isConfigured } from '../firebaseConfig';
import { 
    collection, 
    doc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    getDocs,
    writeBatch,
    deleteDoc,
    getDoc
} from 'firebase/firestore';
import { DeliveryLocation, DriverState, DriverStatus } from '../types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from '../constants';

const DRIVERS_COLLECTION = 'drivers';
const LOCATIONS_COLLECTION = 'locations';

// Configuração: Motoristas inativos há mais de 5 dias somem do mapa
const INACTIVITY_THRESHOLD = 5 * 24 * 60 * 60 * 1000; 

// --- INITIALIZATION ---
export const seedDatabaseIfEmpty = async () => {
    if (!isConfigured) return;
    try {
        const locationsSnap = await getDocs(collection(db, LOCATIONS_COLLECTION));
        if (locationsSnap.empty) {
            const batch = writeBatch(db);
            LOCATIONS_DB.forEach(loc => {
                const docRef = doc(db, LOCATIONS_COLLECTION, loc.id);
                batch.set(docRef, loc);
            });
            await batch.commit();
        }
    } catch (e) {
        console.warn("Modo Offline: DB não semeado (verifique conexão).");
    }
};

// --- DRIVERS ---

// Busca um motorista específico (útil para login/restore session)
export const getDriverById = async (driverId: string): Promise<DriverState | null> => {
    if (!isConfigured) return null;
    try {
        const docRef = doc(db, DRIVERS_COLLECTION, driverId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as DriverState;
        }
        return null;
    } catch (e) {
        console.error("Erro ao buscar motorista:", e);
        return null;
    }
};

// Escuta atualizações em tempo real de todos os motoristas
export const subscribeToDrivers = (callback: (drivers: DriverState[]) => void) => {
    if (!isConfigured) {
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }

    try {
        const q = query(collection(db, DRIVERS_COLLECTION));
        return onSnapshot(q, 
            (snapshot) => {
                const now = Date.now();
                const drivers: DriverState[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data() as DriverState;
                    // FILTRO: Só adiciona se visto nos últimos 5 dias
                    if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) {
                        drivers.push(data);
                    }
                });
                callback(drivers);
            },
            (error) => {
                console.error("Monitor H2: Erro na subscrição:", error);
                callback(MOCK_DRIVERS_LIST);
            }
        );
    } catch (e) {
        console.error("Erro crítico no Firestore:", e);
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }
};

// Atualiza posição E status (usado pelo GPS automático)
export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string, status: DriverStatus = 'MOVING') => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address,
            status: status, // Atualiza se está MOVING ou IDLE
            lastSeen: Date.now()
        });
    } catch (e) {
        // Falha silenciosa para não travar a UI do motorista
    }
};

// NOVA FUNÇÃO: Atualiza APENAS o status (usado pelo botão de Intervalo/Almoço)
export const updateDriverStatusInDB = async (driverId: string, status: DriverStatus) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { 
            status: status,
            lastSeen: Date.now() 
        });
    } catch (e) {
        console.error("Erro ao atualizar status:", e);
    }
};

export const registerDriverInDB = async (driver: DriverState) => {
    if (!isConfigured) return;
    try {
        const driverWithTimestamp = {
            ...driver,
            lastSeen: Date.now()
        };
        await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), driverWithTimestamp, { merge: true });
    } catch (e) {
        console.error("Erro ao registrar motorista:", e);
    }
};

export const deleteDriverFromDB = async (driverId: string) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await deleteDoc(driverRef);
    } catch (e) {
        console.error("Erro ao excluir motorista:", e);
        throw e;
    }
};

export const updateDriverRouteInDB = async (driverId: string, route: DeliveryLocation[]) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { route, lastSeen: Date.now() });
    } catch (e) {
        console.error("Erro ao atualizar rota:", e);
    }
};

// --- LOCATIONS ---
export const subscribeToLocations = (callback: (locations: DeliveryLocation[]) => void) => {
    if (!isConfigured) {
        callback(LOCATIONS_DB);
        return () => {};
    }
    try {
        const q = query(collection(db, LOCATIONS_COLLECTION));
        return onSnapshot(q, (snapshot) => {
            const locations: DeliveryLocation[] = [];
            snapshot.forEach((doc) => {
                locations.push(doc.data() as DeliveryLocation);
            });
            callback(locations.length > 0 ? locations : LOCATIONS_DB);
        }, () => callback(LOCATIONS_DB));
    } catch (e) {
        callback(LOCATIONS_DB);
        return () => {};
    }
};

export const updateLocationStatusInDB = async (locationId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    if (!isConfigured) return;
    try {
        const locRef = doc(db, LOCATIONS_COLLECTION, locationId);
        await updateDoc(locRef, { status });
    } catch (e) {
        console.error("Erro ao atualizar status da entrega:", e);
    }
};