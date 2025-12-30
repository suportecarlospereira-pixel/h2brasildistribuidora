// NOME DO ARQUIVO: types.ts

export enum LocationType {
  UBS = 'UBS',
  CRAS = 'CRAS',
  HEADQUARTERS = 'HEADQUARTERS',
  THEATER = 'THEATER',
  DRIVER = 'DRIVER',
  OTHER = 'OTHER'
}

export type DriverStatus = 'IDLE' | 'MOVING' | 'BREAK';

export interface Coordinates {
  lat: number;
  lng: number;
}

// NOVA INTERFACE: Registro detalhado de cada parada
export interface DeliveryRecord {
  locationId: string;
  locationName: string;
  timestamp: string;
  status: 'DELIVERED' | 'FAILED'; // Sucesso ou Falha
  observation?: string; // "Recebido por João" ou "Local fechado"
}

export interface DeliveryLocation {
  id: string;
  name: string;
  address: string;
  type: LocationType;
  coords: Coordinates;
  selected?: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
}

export interface DriverState {
  id: string;
  name: string;
  currentCoords: Coordinates;
  currentAddress: string;
  route: DeliveryLocation[];
  status: DriverStatus;
  speed: number;
  lastSeen?: number;
}

export interface RouteHistory {
  id: string;
  date: string;
  driverName: string;
  totalDeliveries: number;
  totalFailures: number; // Novo contador de falhas
  records: DeliveryRecord[]; // Lista detalhada com obs
  status: 'COMPLETED' | 'PARTIAL';
}

export enum AppView {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  LOGIN = 'LOGIN'
}
