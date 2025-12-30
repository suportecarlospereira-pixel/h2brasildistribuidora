// NOME DO ARQUIVO: types.ts
export enum LocationType {
  UBS = 'UBS',
  CRAS = 'CRAS',
  HEADQUARTERS = 'HEADQUARTERS',
  THEATER = 'THEATER',
  DRIVER = 'DRIVER',
  OTHER = 'OTHER'
}

// Novo sistema de status para maior controle
export type DriverStatus = 'IDLE' | 'MOVING' | 'BREAK';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DeliveryLocation {
  id: string;
  name: string;
  address: string;
  type: LocationType;
  coords: Coordinates;
  selected?: boolean;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface DriverState {
  id: string;
  name: string;
  currentCoords: Coordinates;
  currentAddress: string;
  route: DeliveryLocation[];
  status: DriverStatus; // Substitui isMoving por algo mais robusto
  speed: number;
  lastSeen?: number; // Timestamp em milissegundos
}

export interface RouteHistory {
  id: string;
  date: string;
  driverName: string;
  totalDeliveries: number;
  locations: string[];
  status: 'COMPLETED' | 'PARTIAL';
}

export enum AppView {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  LOGIN = 'LOGIN'
}