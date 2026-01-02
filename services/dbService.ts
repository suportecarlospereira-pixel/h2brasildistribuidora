// NOME DO ARQUIVO: services/dbService.ts
import { db, isConfigured } from '../firebaseConfig';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, getDocs, writeBatch, deleteDoc, getDoc, limit, where, orderBy } from 'firebase/firestore';
import { DeliveryLocation, DriverState, DriverStatus, RouteHistory } from '../types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from '../constants';

const DRIVERS_COLLECTION = 'drivers';
const LOCATIONS_COLLECTION = 'locations';
const HISTORY_COLLECTION = 'history';
const INACTIVITY_THRESHOLD = 5 * 24 * 60 * 60 * 1000; 

const sanitizeForFirestore = (obj: any): any => {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        return value === undefined ? null : value;
    }));
};

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
    } catch (e) { console.warn("Offline: Banco não semeado."); }
};

export const getDriverById = async (driverId: string): Promise<DriverState | null> => {
    if (!isConfigured) return null;
    try {
        const docRef = doc(db, DRIVERS_COLLECTION, driverId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap.data() as DriverState;
        return null;
    } catch (e) { return null; }
};

export const findDriverByName = async (name: string): Promise<DriverState | null> => {
    if (!isConfigured) return null;
    try {
        const q = query(collection(db, DRIVERS_COLLECTION), where("name", "==", name));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) return querySnapshot.docs[0].data() as DriverState;
        return null;
    } catch (e) { return null; }
}

export const subscribeToDrivers = (callback: (drivers: DriverState[]) => void) => {
    if (!isConfigured) { callback(MOCK_DRIVERS_LIST); return () => {}; }
    try {
        const q = query(collection(db, DRIVERS_COLLECTION));
        return onSnapshot(q, (snapshot) => {
            const now = Date.now();
            const drivers: DriverState[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as DriverState;
                if (!data.lastSeen || (now - data.lastSeen < INACTIVITY_THRESHOLD)) drivers.push(data);
            });
            callback(drivers);
        }, () => callback(MOCK_DRIVERS_LIST));
    } catch (e) { callback(MOCK_DRIVERS_LIST); return () => {}; }
};

export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string, status: DriverStatus = 'MOVING') => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address || "Desconhecido",
            status: status,
            lastSeen: Date.now()
        });
    } catch (e) { }
};

export const updateDriverStatusInDB = async (driverId: string, status: DriverStatus) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { status, lastSeen: Date.now() });
    } catch (e) { }
};

export const registerDriverInDB = async (driver: DriverState) => {
    if (!isConfigured) return;
    try {
        const data = sanitizeForFirestore({ ...driver, lastSeen: Date.now() });
        await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), data, { merge: true });
    } catch (e) { }
};

export const deleteDriverFromDB = async (driverId: string) => {
    if (!isConfigured) return;
    try { await deleteDoc(doc(db, DRIVERS_COLLECTION, driverId)); } catch (e) { throw e; }
};

export const updateDriverRouteInDB = async (driverId: string, route: DeliveryLocation[]) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        const cleanRoute = sanitizeForFirestore(route);
        await updateDoc(driverRef, { route: cleanRoute, lastSeen: Date.now() });
    } catch (e) { throw e; }
};

export const saveRouteToHistoryDB = async (historyItem: RouteHistory) => {
    if (!isConfigured) return;
    try {
        const docId = `history-${historyItem.driverName}-${Date.now()}`;
        const docRef = doc(db, HISTORY_COLLECTION, docId);
        await setDoc(docRef, sanitizeForFirestore({ ...historyItem, id: docId }));
    } catch (e) { }
};

export const deleteRouteHistoryFromDB = async (historyId: string) => {
    if (!isConfigured) return;
    try { await deleteDoc(doc(db, HISTORY_COLLECTION, historyId)); } catch (e) { throw e; }
};

export const subscribeToHistory = (callback: (history: RouteHistory[]) => void) => {
    if (!isConfigured) return () => {};
    try {
        const q = query(collection(db, HISTORY_COLLECTION), orderBy('date', 'desc'), limit(300)); 
        return onSnapshot(q, (snapshot) => {
            const history: RouteHistory[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data() as RouteHistory;
                history.push({ ...data, id: doc.id });
            });
            callback(history);
        }, () => {
            // Fallback de ordenação manual se faltar índice
            const qSimple = query(collection(db, HISTORY_COLLECTION), limit(100));
            onSnapshot(qSimple, (snap) => {
                const h: RouteHistory[] = [];
                snap.forEach(d => h.push({ ...(d.data() as RouteHistory), id: d.id }));
                h.sort((a, b) => b.date.localeCompare(a.date));
                callback(h);
            });
        });
    } catch (e) { return () => {}; }
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
    try { await updateDoc(doc(db, LOCATIONS_COLLECTION, locationId), { status }); } catch (e) { }
};

// --- NOVAS FUNÇÕES PARA GESTÃO DE LOCAIS ---

export const addLocationToDB = async (location: DeliveryLocation) => {
    if (!isConfigured) return;
    try {
        // Usa o ID do objeto ou cria um novo se não existir
        const docId = location.id || `loc-${Date.now()}`;
        const data = sanitizeForFirestore({ ...location, id: docId });
        await setDoc(doc(db, LOCATIONS_COLLECTION, docId), data);
    } catch (e) { throw e; }
};

export const deleteLocationFromDB = async (locationId: string) => {
    if (!isConfigured) return;
    try { await deleteDoc(doc(db, LOCATIONS_COLLECTION, locationId)); } catch (e) { throw e; }
};
