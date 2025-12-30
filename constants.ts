// NOME DO ARQUIVO: constants.ts
import { DeliveryLocation, DriverState, LocationType, RouteHistory } from './types';

// Coordinates for Itajaí, SC - Centróide atualizado
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
  // PONTOS DE CULTURA
  {
    id: 'teatro-municipal',
    name: 'Teatro Municipal de Itajaí',
    address: 'R. Gregório Chaves, 110 - Fazenda',
    type: LocationType.THEATER,
    coords: { lat: -26.9126, lng: -48.6550 },
    status: 'PENDING'
  },
  // --- UBS - UNIDADES BÁSICAS DE SAÚDE (DADOS OFICIAIS 2024/25) ---
  {
    id: 'ubs-cordeiros',
    name: 'UBS Cordeiros',
    address: 'R. Odílio Garcia, s/n - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8837, lng: -48.6923 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-vicente',
    name: 'UBS São Vicente',
    address: 'R. Padre Paulo Condla, 392 - São Vicente', // Endereço Atualizado
    type: LocationType.UBS,
    coords: { lat: -26.9063, lng: -48.6895 },
    status: 'PENDING'
  },
  {
    id: 'ubs-fazenda',
    name: 'UBS Fazenda I',
    address: 'R. Milton Ribeiro da Luz, 200 - Fazenda', // Endereço Atualizado
    type: LocationType.UBS,
    coords: { lat: -26.9189, lng: -48.6502 },
    status: 'PENDING'
  },
  {
    id: 'ubs-murta',
    name: 'UBS Murta',
    address: 'R. Orlandina Amália Pires Correa, 300 - Murta', // Numeração corrigida
    type: LocationType.UBS,
    coords: { lat: -26.8720, lng: -48.6850 },
    status: 'PENDING'
  },
  {
    id: 'ubs-itaipava',
    name: 'UBS Itaipava',
    address: 'Av. Itaipava, 2316 - Itaipava', // Atualizado (antigo era s/n)
    type: LocationType.UBS,
    coords: { lat: -26.9530, lng: -48.7420 },
    status: 'PENDING'
  },
  {
    id: 'ubs-espinheiros',
    name: 'UBS Espinheiros',
    address: 'R. Fermino Vieira Cordeiro, 1778 - Espinheiros', // Numeração oficial
    type: LocationType.UBS,
    coords: { lat: -26.8680, lng: -48.7100 },
    status: 'PENDING'
  },
  {
    id: 'ubs-salseiros',
    name: 'UBS Salseiros',
    address: 'R. César Augusto Dalçóquio, s/n - Salseiros',
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
    address: 'Av. Marcos Luiz Cabral, s/n - Portal II', // Rua corrigida (antiga Nilo Simas)
    type: LocationType.UBS,
    coords: { lat: -26.8600, lng: -48.7050 },
    status: 'PENDING'
  },
  {
    id: 'ubs-imarui',
    name: 'UBS Imaruí',
    address: 'R. Leodegário Pedro da Silva, 246 - Imaruí', // Numeração oficial
    type: LocationType.UBS,
    coords: { lat: -26.8990, lng: -48.6700 },
    status: 'PENDING'
  },
  {
    id: 'ubs-jardim-esperanca',
    name: 'UBS Jardim Esperança',
    address: 'R. Sebastião Romeu Soares, s/n - Cordeiros',
    type: LocationType.UBS,
    coords: { lat: -26.8780, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'ubs-praia-brava',
    name: 'UBS Praia Brava',
    address: 'R. Bráulio Werner, 124 - Praia Brava', // Numeração oficial
    type: LocationType.UBS,
    coords: { lat: -26.9400, lng: -48.6300 },
    status: 'PENDING'
  },
  {
    id: 'ubs-votorantim',
    name: 'UBS Votorantim',
    address: 'R. Selso Duarte Moreira, 1442 - Cordeiros', // Endereço Atualizado
    type: LocationType.UBS,
    coords: { lat: -26.8800, lng: -48.6880 },
    status: 'PENDING'
  },
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
    address: 'R. Espírito Santo, 100 - Cordeiros', // Numeração oficial
    type: LocationType.UBS,
    coords: { lat: -26.8850, lng: -48.6750 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-joao',
    name: 'UBS São João',
    address: 'R. Otto Praun, 41 - São João', // Endereço Atualizado (antigo Pedro Rangel)
    type: LocationType.UBS,
    coords: { lat: -26.9050, lng: -48.6780 },
    status: 'PENDING'
  },

  // --- CRAS - CENTROS DE REFERÊNCIA (ATUALIZADO) ---
  {
    id: 'cras-itaipava',
    name: 'CRAS Itaipava',
    address: 'Av. Itaipava, 4134 - Itaipava', // Mudou do 4200 para 4134
    type: LocationType.CRAS,
    coords: { lat: -26.9550, lng: -48.7450 },
    status: 'PENDING'
  },
  {
    id: 'cras-imarui',
    name: 'CRAS Imaruí',
    address: 'R. Blumenau, 1962 - Barra do Rio', // Nova Sede
    type: LocationType.CRAS,
    coords: { lat: -26.8972, lng: -48.6741 },
    status: 'PENDING'
  },
  {
    id: 'cras-promorar',
    name: 'CRAS Promorar',
    address: 'Av. Min. Luiz Gallotti, 1815 - Cidade Nova', // Numeração oficial
    type: LocationType.CRAS,
    coords: { lat: -26.9250, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'cras-nossa-senhora',
    name: 'CRAS Nossa Senhora das Graças',
    address: 'R. Brusque, 650 - Centro', // Nova Sede (Antiga Alm. Barroso)
    type: LocationType.CRAS,
    coords: { lat: -26.9100, lng: -48.6650 },
    status: 'PENDING'
  },
  {
    id: 'cras-espinheiros',
    name: 'CRAS Espinheiros', // Nova Unidade (Substitui áreas do Cordeiros)
    address: 'R. Pedro Reis, 65 - Portal II',
    type: LocationType.CRAS,
    coords: { lat: -26.8650, lng: -48.7080 }, // Coords aproximadas Portal II
    status: 'PENDING'
  }
];

export const MOCK_DRIVERS_LIST: DriverState[] = [
  {
    id: 'driver-01',
    name: 'João Silva (Demo)',
    currentCoords: LOCATIONS_DB[0].coords,
    currentAddress: 'Aguardando início...',
    route: [],
    status: 'IDLE',
    speed: 0
  }
];

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
    date: new Date().toISOString().split('T')[0],
    driverName: 'João Silva',
    totalDeliveries: 4,
    locations: ['CRAS Itaipava', 'CRAS Promorar'],
    status: 'PARTIAL'
  }
];