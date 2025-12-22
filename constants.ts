import { DeliveryLocation, DriverState, LocationType, RouteHistory } from './types';

// Coordinates for Itajaí, SC
export const ITAJAI_CENTER = { lat: -26.9094, lng: -48.6630 };

export const LOCATIONS_DB: DeliveryLocation[] = [
  // SEDE
  {
    id: 'h2-hq',
    name: 'H2 Brasil - Matriz',
    address: 'Rod. Jorge Lacerda, Itajaí - SC',
    type: LocationType.HEADQUARTERS,
    coords: { lat: -26.9350, lng: -48.6800 },
    status: 'COMPLETED'
  },
  // PONTOS ESPECIAIS
  {
    id: 'teatro-municipal',
    name: 'Teatro Municipal de Itajaí',
    address: 'R. Gregório Chaves, 110 - Fazenda',
    type: LocationType.THEATER,
    coords: { lat: -26.9126, lng: -48.6550 },
    status: 'PENDING'
  },
  // UBS (Unidades Básicas de Saúde)
  {
    id: 'ubs-cordeiros',
    name: 'UBS Cordeiros',
    address: 'R. Odílio Garcia, 380 - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8837, lng: -48.6923 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-vicente',
    name: 'UBS São Vicente',
    address: 'R. Antônio Cirilo Dutra, 35 - São Vicente',
    type: LocationType.UBS,
    coords: { lat: -26.9063, lng: -48.6895 },
    status: 'PENDING'
  },
  {
    id: 'ubs-fazenda',
    name: 'UBS Fazenda',
    address: 'R. Milton Rossi, 55 - Fazenda',
    type: LocationType.UBS,
    coords: { lat: -26.9189, lng: -48.6502 },
    status: 'PENDING'
  },
  {
    id: 'ubs-murta',
    name: 'UBS Murta',
    address: 'R. Orlandina Amália Pires Machado - Murta',
    type: LocationType.UBS,
    coords: { lat: -26.8720, lng: -48.6850 },
    status: 'PENDING'
  },
  {
    id: 'ubs-itaipava',
    name: 'UBS Itaipava',
    address: 'Av. Itaipava, s/n - Itaipava',
    type: LocationType.UBS,
    coords: { lat: -26.9530, lng: -48.7420 },
    status: 'PENDING'
  },
  {
    id: 'ubs-espinheiros',
    name: 'UBS Espinheiros',
    address: 'R. Firmino Vieira Cordeiro - Espinheiros',
    type: LocationType.UBS,
    coords: { lat: -26.8680, lng: -48.7100 },
    status: 'PENDING'
  },
  {
    id: 'ubs-salseiros',
    name: 'UBS Salseiros',
    address: 'Rod. Jorge Lacerda - Salseiros',
    type: LocationType.UBS,
    coords: { lat: -26.8850, lng: -48.7200 },
    status: 'PENDING'
  },
  {
    id: 'ubs-cidade-nova',
    name: 'UBS Cidade Nova',
    address: 'R. Agílio Cunha, 830 - Cidade Nova',
    type: LocationType.UBS,
    coords: { lat: -26.9200, lng: -48.6900 },
    status: 'PENDING'
  },
  {
    id: 'ubs-portal-ii',
    name: 'UBS Portal II',
    address: 'R. Nilo Simas - Espinheiros',
    type: LocationType.UBS,
    coords: { lat: -26.8600, lng: -48.7050 },
    status: 'PENDING'
  },
  {
    id: 'ubs-imaruí',
    name: 'UBS Imaruí',
    address: 'R. Leodegário Pedro da Silva - Imaruí',
    type: LocationType.UBS,
    coords: { lat: -26.8990, lng: -48.6700 },
    status: 'PENDING'
  },
  {
    id: 'ubs-jardim-esperanca',
    name: 'UBS Jardim Esperança',
    address: 'R. Sebastião Romeu Soares - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8780, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'ubs-praia-brava',
    name: 'UBS Praia Brava',
    address: 'R. Bráulio Werner - Praia Brava',
    type: LocationType.UBS,
    coords: { lat: -26.9400, lng: -48.6300 },
    status: 'PENDING'
  },
  {
    id: 'ubs-votorantim',
    name: 'UBS Votorantim',
    address: 'R. Eudoro Silveira - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8800, lng: -48.6880 },
    status: 'PENDING'
  },
  // Novas UBS adicionadas na revisão
  {
    id: 'ubs-rio-bonito',
    name: 'UBS Rio Bonito',
    address: 'R. Nilson Edson dos Santos, s/n - São Vicente',
    type: LocationType.UBS,
    coords: { lat: -26.8920, lng: -48.7050 },
    status: 'PENDING'
  },
  {
    id: 'ubs-costa-cavalcante',
    name: 'UBS Costa Cavalcante',
    address: 'R. Espírito Santo, s/n - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8850, lng: -48.6750 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-joao',
    name: 'UBS São João',
    address: 'R. Pedro Rangel, 1500 - São João',
    type: LocationType.UBS,
    coords: { lat: -26.9050, lng: -48.6780 },
    status: 'PENDING'
  },

  // CRAS (Centro de Referência de Assistência Social)
  {
    id: 'cras-itaipava',
    name: 'CRAS Itaipava',
    address: 'Av. Itaipava, 4200 - Itaipava',
    type: LocationType.CRAS,
    coords: { lat: -26.9550, lng: -48.7450 },
    status: 'PENDING'
  },
  {
    id: 'cras-imarui',
    name: 'CRAS Imaruí',
    address: 'R. Leodegário Pedro da Silva, 500 - Imaruí',
    type: LocationType.CRAS,
    coords: { lat: -26.8972, lng: -48.6741 },
    status: 'PENDING'
  },
  {
    id: 'cras-promorar',
    name: 'CRAS Promorar',
    address: 'R. Min. Luiz Gallotti - Cidade Nova',
    type: LocationType.CRAS,
    coords: { lat: -26.9250, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'cras-cordeiros',
    name: 'CRAS Cordeiros',
    address: 'R. Dr. Reinaldo Schmithausen - Cordeiros',
    type: LocationType.CRAS,
    coords: { lat: -26.8870, lng: -48.6900 },
    status: 'PENDING'
  },
  {
    id: 'cras-sao-vicente',
    name: 'CRAS São Vicente',
    address: 'R. Estefano José Vanolli - São Vicente',
    type: LocationType.CRAS,
    coords: { lat: -26.9080, lng: -48.6920 },
    status: 'PENDING'
  },
  {
    id: 'cras-nossa-senhora',
    name: 'CRAS Nossa Senhora das Graças',
    address: 'R. Almirante Barroso - Centro',
    type: LocationType.CRAS,
    coords: { lat: -26.9100, lng: -48.6650 },
    status: 'PENDING'
  }
];

export const MOCK_DRIVERS_LIST: DriverState[] = [
  {
    id: 'driver-01',
    name: 'João Silva',
    currentCoords: LOCATIONS_DB[0].coords, // Starts at HQ
    currentAddress: 'Aguardando início...',
    route: [],
    isMoving: false,
    speed: 0.0005
  },
  {
    id: 'driver-02',
    name: 'Maria Oliveira',
    currentCoords: { lat: -26.9100, lng: -48.6700 }, // Starts near center
    currentAddress: 'Aguardando início...',
    route: [],
    isMoving: false,
    speed: 0.0006
  }
];

// Keep for backward compatibility if needed, but prefer list above
export const MOCK_DRIVER_INITIAL = MOCK_DRIVERS_LIST[0];

export const MOCK_HISTORY: RouteHistory[] = [
  {
    id: 'hist-001',
    date: '2023-10-25',
    driverName: 'João Silva',
    totalDeliveries: 3,
    locations: ['UBS Cordeiros', 'UBS Murta', 'CRAS Imaruí'],
    status: 'COMPLETED'
  },
  {
    id: 'hist-002',
    date: '2023-10-26',
    driverName: 'Carlos Souza',
    totalDeliveries: 2,
    locations: ['UBS Fazenda', 'UBS São Vicente'],
    status: 'COMPLETED'
  },
  {
    id: 'hist-003',
    date: new Date().toISOString().split('T')[0], // Today
    driverName: 'João Silva',
    totalDeliveries: 4,
    locations: ['CRAS Itaipava', 'CRAS Promorar'],
    status: 'PARTIAL'
  }
];