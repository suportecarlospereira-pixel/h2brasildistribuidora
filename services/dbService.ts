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
const INACTIVITY_THRESHOLD = 5 * 24 * 60 * 60 * 1000; // 5 Dias

// HELPER: Remove 'undefined' recursivamente para o Firebase não travar
const sanitizeForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        return value === undefined ? null : value;
    }));
};

// --- INICIALIZAÇÃO ---
export const seedDatabaseIfEmpty = async () => {
    if (!isConfigured) return;
    try {
        const locationsSnap = await getDocs(collection(db, LOCATIONS_COLLECTION));
        if (locationsSnap.empty) {
            const batch = writeBatch(db);
            LOCATIONS_DB.forEach(loc => {
                const docRef = doc(db, LOCATIONS_COLLECTION, loc.id);
                batch.set(docRef, sanitizeForFirestore(loc));
            });
            await batch.commit();
        }
    } catch (e) {
        console.warn("Offline: Banco de dados não semeado.");
    }
};

// --- MOTORISTAS ---
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
                    // Filtro de Inatividade (5 dias)
                    if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) {
                        drivers.push(data);
                    }
                });
                callback(drivers);
            },
            (error) => {
                console.error("Erro no stream de motoristas:", error);
                callback(MOCK_DRIVERS_LIST);
            }
        );
    } catch (e) {
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }
};

// Atualização de GPS (Frequente)
export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string, status: DriverStatus = 'MOVING') => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address || "Endereço desconhecido",
            status: status,
            lastSeen: Date.now()
        });
    } catch (e) {
        // Silêncio em erros de GPS para não bloquear a UI
    }
};

// Atualização de Status (Pausa/Almoço)
export const updateDriverStatusInDB = async (driverId: string, status: DriverStatus) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { status, lastSeen: Date.now() });
    } catch (e) {
        console.error("Erro ao mudar status:", e);
    }
};

export const registerDriverInDB = async (driver: DriverState) => {
    if (!isConfigured) return;
    try {
        const data = sanitizeForFirestore({ ...driver, lastSeen: Date.now() });
        await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), data, { merge: true });
    } catch (e) {
        console.error("Erro ao registrar:", e);
    }
};

export const deleteDriverFromDB = async (driverId: string) => {
    if (!isConfigured) return;
    try {
        await deleteDoc(doc(db, DRIVERS_COLLECTION, driverId));
    } catch (e) {
        throw e;
    }
};

// ROTA (Crítico: Sanitização aplicada aqui)
export const updateDriverRouteInDB = async (driverId: string, route: DeliveryLocation[]) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        // Garante que o objeto está limpo para o Firebase
        const cleanRoute = sanitizeForFirestore(route);
        
        await updateDoc(driverRef, { 
            route: cleanRoute, 
            lastSeen: Date.now() 
        });
    } catch (e) {
        console.error("Erro crítico ao salvar rota:", e);
        throw e; // Lança para o UI tratar
    }
};

// --- LOCAIS ---
export const subscribeToLocations = (callback: (locations: DeliveryLocation[]) => void) => {
    if (!isConfigured) {
        callback(LOCATIONS_DB);
        return () => {};
    }
    const q = query(collection(db, LOCATIONS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const locations: DeliveryLocation[] = [];
        snapshot.forEach((doc) => locations.push(doc.data() as DeliveryLocation));
        callback(locations.length ? locations : LOCATIONS_DB);
    }, () => callback(LOCATIONS_DB));
};

export const updateLocationStatusInDB = async (locationId: string, status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED') => {
    if (!isConfigured) return;
    try {
        await updateDoc(doc(db, LOCATIONS_COLLECTION, locationId), { status });
    } catch (e) { console.error(e); }
};
