export enum LocationType {
  UBS = 'UBS',
  CRAS = 'CRAS',
  HEADQUARTERS = 'HEADQUARTERS',
  THEATER = 'THEATER',
  DRIVER = 'DRIVER',
  OTHER = 'OTHER'
}

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
  currentAddress: string; // New: To show current street name
  route: DeliveryLocation[];
  isMoving: boolean;
  speed: number;
}

export interface RouteHistory {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  driverName: string;
  totalDeliveries: number;
  locations: string[]; // List of names delivered
  status: 'COMPLETED' | 'PARTIAL';
}

export enum AppView {
  ADMIN = 'ADMIN',
  DRIVER = 'DRIVER',
  LOGIN = 'LOGIN'
}
