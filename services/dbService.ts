import { db, isConfigured } from '../firebaseConfig';
import { 
    collection, 
    doc, 
    setDoc, 
    updateDoc, 
    onSnapshot, 
    query, 
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { DeliveryLocation, DriverState } from '../types';
import { LOCATIONS_DB, MOCK_DRIVERS_LIST } from '../constants';

// Collection References
const DRIVERS_COLLECTION = 'drivers';
const LOCATIONS_COLLECTION = 'locations';

// --- INITIALIZATION ---

export const seedDatabaseIfEmpty = async () => {
    if (!isConfigured) return;

    try {
        const locationsSnap = await getDocs(collection(db, LOCATIONS_COLLECTION));
        if (locationsSnap.empty) {
            console.log("Seeding Database with Initial Locations...");
            const batch = writeBatch(db);
            LOCATIONS_DB.forEach(loc => {
                const docRef = doc(db, LOCATIONS_COLLECTION, loc.id);
                batch.set(docRef, loc);
            });
            await batch.commit();
        }
        
        // We don't necessarily need to seed drivers as they "log in", 
        // but we can ensure the structure exists.
    } catch (e) {
        console.error("Error seeding DB:", e);
    }
};

// --- DRIVERS ---

export const subscribeToDrivers = (callback: (drivers: DriverState[]) => void) => {
    if (!isConfigured) {
        // Fallback for demo without keys
        callback(MOCK_DRIVERS_LIST);
        return () => {};
    }

    const q = query(collection(db, DRIVERS_COLLECTION));
    return onSnapshot(q, (snapshot) => {
        const drivers: DriverState[] = [];
        snapshot.forEach((doc) => {
            drivers.push(doc.data() as DriverState);
        });
        callback(drivers);
    });
};

export const updateDriverLocationInDB = async (driverId: string, lat: number, lng: number, address: string) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, {
            currentCoords: { lat, lng },
            currentAddress: address,
            isMoving: true // Assume moving if updating via GPS
        });
    } catch (e) {
        console.error("Error updating location:", e);
    }
};

export const registerDriverInDB = async (driver: DriverState) => {
    if (!isConfigured) return;
    try {
        await setDoc(doc(db, DRIVERS_COLLECTION, driver.id), driver, { merge: true });
    } catch (e) {
        console.error("Error registering driver:", e);
    }
};

export const updateDriverRouteInDB = async (driverId: string, route: DeliveryLocation[]) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { route });
    } catch (e) {
        console.error("Error updating route:", e);
    }
};

export const setDriverMovingStatus = async (driverId: string, isMoving: boolean) => {
    if (!isConfigured) return;
    try {
        const driverRef = doc(db, DRIVERS_COLLECTION, driverId);
        await updateDoc(driverRef, { isMoving });
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
        // Sort/Filter if needed, or just return all
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