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
import { DeliveryLocation, DriverState } from '../types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from '../constants';

const DRIVERS_COLLECTION = 'drivers';
const LOCATIONS_COLLECTION = 'locations';

// --- CONFIGURAÇÃO DE FILTRO ---
// Alterado para 5 dias conforme solicitado (5 * 24h * 60m * 60s * 1000ms)
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
        console.warn("Modo Offline: Não foi possível semear o DB (verifique permissões/conexão).");
    }
};

// --- DRIVERS ---
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
                    // LÓGICA DE FILTRO AUTOMÁTICO:
                    // Se o motorista não atualiza há mais de 5 dias, ele não entra na lista.
                    // Isso remove ele do mapa automaticamente.
                    if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) {
                        drivers.push(data);
                    }
                });
                callback(drivers);
            },
            (error) => {
                console.error("Monitor H2: Erro na subscrição (Fallback ativado):", error);
                callback(MOCK_DRIVERS_LIST);
            }
        );
    } catch (e) {
        console.error("Erro crítico ao conectar no Firestore:", e);
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }
};

export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address,
            isMoving: true,
            lastSeen: Date.now()
        });
    } catch (e) {
        // Falha silenciosa em produção para manter a UI fluida
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
        console.error("Erro ao registrar motorista (continuando localmente):", e);
    }
};

// FUNÇÃO DE EXCLUSÃO
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
        console.error("Error updating route:", e);
    }
};

export const setDriverMovingStatus = async (driverId: string, isMoving: boolean) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { isMoving, lastSeen: Date.now() });
    } catch (e) {
        console.error("Error updating status:", e);
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
        }, (error) => {
            console.warn("Erro ao buscar locations, usando padrão.", error);
            callback(LOCATIONS_DB);
        });
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
        console.error("Error updating location status:", e);
    }
};