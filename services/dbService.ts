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
    deleteDoc
} from 'firebase/firestore';
import { DeliveryLocation, DriverState } from '../types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from '../constants';

const DRIVERS_COLLECTION = 'drivers';
const LOCATIONS_COLLECTION = 'locations';
const INACTIVITY_THRESHOLD = 4 * 24 * 60 * 60 * 1000; // 4 Dias em ms

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
        console.error("Error seeding DB:", e);
    }
};

// --- DRIVERS ---
export const subscribeToDrivers = (callback: (drivers: DriverState[]) => void) => {
    if (!isConfigured) {
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }

    const q = query(collection(db, DRIVERS_COLLECTION));
    return onSnapshot(q, 
        (snapshot) => {
            const now = Date.now();
            const drivers: DriverState[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as DriverState;
                // Só adiciona se estiver ativo nos últimos 4 dias
                if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) {
                    drivers.push(data);
                }
            });
            console.log("Monitor H2: Recebida atualização de frotas.", drivers.length);
            callback(drivers);
        },
        (error) => {
            console.error("Monitor H2: Erro crítico na subscrição (Verifique permissões do Firebase):", error);
            // Fallback para mock apenas em caso de erro de conexão/permissão
            callback(MOCK_DRIVERS_LIST);
        }
    );
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
        console.error("Error updating location:", e);
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
        console.error("Error registering driver:", e);
    }
};

export const deleteDriverFromDB = async (driverId: string) => {
    if (!isConfigured) return;
    try {
        console.log(`Iniciando exclusão do motorista: ${driverId}`);
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await deleteDoc(driverRef);
        console.log(`Motorista ${driverId} removido do Firestore com sucesso.`);
    } catch (e) {
        console.error("Erro ao excluir motorista do Firestore:", e);
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
    const q = query(collection(db, LOCATIONS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const locations: DeliveryLocation[] = [];
        snapshot.forEach((doc) => {
            locations.push(doc.data() as DeliveryLocation);
        });
        callback(locations.length > 0 ? locations : LOCATIONS_DB);
    });
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