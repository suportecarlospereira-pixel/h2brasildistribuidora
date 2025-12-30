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
        console.warn("Modo Offline: DB não semeado.");
    }
};

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
                    // Filtra motoristas inativos há mais de 5 dias
                    if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) {
                        drivers.push(data);
                    }
                });
                callback(drivers);
            },
            () => callback(MOCK_DRIVERS_LIST)
        );
    } catch (e) {
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }
};

export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string, status: DriverStatus = 'MOVING') => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address,
            status: status, // Agora enviamos o status (BREAK ou MOVING)
            lastSeen: Date.now()
        });
    } catch (e) {
        // Fail silently
    }
};

export const registerDriverInDB = async (driver: DriverState) => {
    if (!isConfigured) return;
    try {
        const driverWithTimestamp = { ...driver, lastSeen: Date.now() };
        await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), driverWithTimestamp, { merge: true });
    } catch (e) { console.error(e); }
};

export const deleteDriverFromDB = async (driverId: string) => {
    if (!isConfigured) return;
    try {
        await deleteDoc(doc(db, DRIVERS_COLLECTION, driverId));
    } catch (e) { throw e; }
};

export const updateDriverRouteInDB = async (driverId: string, route: DeliveryLocation[]) => {
    if (!isConfigured) return;
    try {
        await updateDoc(doc(db, DRIVERS_COLLECTION, driverId), { route, lastSeen: Date.now() });
    } catch (e) { console.error(e); }
};

// Nova função para mudar apenas o status (ex: Pausa para almoço)
export const updateDriverStatusInDB = async (driverId: string, status: DriverStatus) => {
    if (!isConfigured) return;
    try {
        await updateDoc(doc(db, DRIVERS_COLLECTION, driverId), { status, lastSeen: Date.now() });
    } catch (e) { console.error(e); }
};

export const subscribeToLocations = (callback: (locations: DeliveryLocation[]) => void) => {
    if (!isConfigured) { callback(LOCATIONS_DB); return () => {}; }
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