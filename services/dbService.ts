import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot, 
  query, 
  orderBy,
  Firestore
} from 'firebase/firestore';
import { Delivery, Driver } from '../types';
import { INITIAL_DELIVERIES, DRIVERS } from '../constants';
import { firebaseConfig } from '../firebaseConfig';

let db: Firestore | null = null;

try {
  if (typeof window !== 'undefined') {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Erro ao inicializar Firebase:", e);
}

export const dbService = {
  // --- ENTREGAS ---

  subscribeDeliveries(callback: (deliveries: Delivery[]) => void) {
    if (!db) return () => {};
    // Ordena por status para organizar a lista
    const q = query(collection(db, "deliveries"), orderBy("id", "asc"));
    return onSnapshot(q, (snapshot) => {
      const deliveries = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Delivery));
      callback(deliveries);
    });
  },

  // ADICIONAR NOVA ENTREGA
  async addDelivery(delivery: Omit<Delivery, 'id'>) {
    if (!db) return;
    try {
      // Cria um ID baseado no timestamp para garantir ordem
      const newId = `DEL-${Date.now()}`;
      await setDoc(doc(db, "deliveries", newId), { ...delivery, id: newId });
    } catch (e) {
      console.error("Erro ao criar entrega:", e);
      throw e;
    }
  },

  // EDITAR ENTREGA EXISTENTE
  async updateDelivery(delivery: Delivery) {
    if (!db) return;
    try {
      const docRef = doc(db, "deliveries", delivery.id);
      await setDoc(docRef, delivery, { merge: true });
    } catch (e) {
      console.error("Erro ao atualizar entrega:", e);
      throw e;
    }
  },

  // EXCLUIR ENTREGA
  async deleteDelivery(deliveryId: string) {
    if (!db) return;
    try {
      await deleteDoc(doc(db, "deliveries", deliveryId));
    } catch (e) {
      console.error("Erro ao excluir entrega:", e);
      throw e;
    }
  },

  async updateDeliveryStatus(deliveryId: string, status: Delivery['status'], notes?: string) {
    if (!db) return;
    const updateData: any = { status };
    if (notes) updateData.notes = notes;
    if (status === 'DELIVERED') updateData.completedAt = Date.now();
    
    await updateDoc(doc(db, "deliveries", deliveryId), updateData);
  },

  async assignDriver(deliveryId: string, driverId: string) {
    if (!db) return;
    await updateDoc(doc(db, "deliveries", deliveryId), { 
      driverId,
      status: 'PENDING' // Reseta status se mudar motorista
    });
  },

  // --- MOTORISTAS ---

  subscribeDrivers(callback: (drivers: Driver[]) => void) {
    if (!db) return () => {};
    return onSnapshot(collection(db, "drivers"), (snapshot) => {
      const drivers = snapshot.docs.map(doc => doc.data() as Driver);
      callback(drivers);
    });
  },

  async updateDriverLocation(driverId: string, lat: number, lng: number) {
    if (!db) return;
    await setDoc(doc(db, "drivers", driverId), {
      id: driverId,
      name: DRIVERS.find(d => d.id === driverId)?.name || 'Desconhecido',
      lat,
      lng,
      lastUpdate: Date.now()
    }, { merge: true });
  },

  // --- INICIALIZAÇÃO ---

  async init() {
    if (!db) return;
    // Se não tiver entregas, carrega as iniciais (apenas na primeira vez)
    // Isso evita apagar dados novos
    /* NOTA: Comentei a inicialização automática para evitar que ela sobrescreva
       suas edições manuais toda vez que recarregar. 
       Se o banco estiver vazio, você pode usar o botão "Adicionar" na tela.
    */
  }
};
