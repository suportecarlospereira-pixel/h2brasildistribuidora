// NOME DO ARQUIVO: constants.ts
import { DeliveryLocation, DriverState, LocationType, RouteHistory } from './types';

// Centróide Geográfico de Itajaí
export const ITAJAI_CENTER = { lat: -26.9094, lng: -48.6630 };

export const LOCATIONS_DB: DeliveryLocation[] = [
  // --- SEDE ---
  {
    id: 'h2-hq',
    name: 'H2 Brasil - Matriz',
    address: 'Rod. Jorge Lacerda, Itajaí - SC',
    type: LocationType.HEADQUARTERS,
    coords: { lat: -26.9350, lng: -48.6800 },
    status: 'COMPLETED'
  },

  // --- ITAIPAVA & ZONA RURAL ---
  {
    id: 'ubs-brilhante',
    name: 'UBS Brilhante',
    address: 'R. José Lana, s/n - Brilhante',
    type: LocationType.UBS,
    coords: { lat: -26.9750, lng: -48.7600 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-pedro',
    name: 'UBS São Pedro',
    address: 'Rod. Antônio Heil - São Pedro',
    type: LocationType.UBS,
    coords: { lat: -26.9650, lng: -48.7500 },
    status: 'PENDING'
  },
  {
    id: 'ubs-itaipava',
    name: 'UBS Itaipava',
    address: 'Av. Itaipava, 2316 - Itaipava',
    type: LocationType.UBS,
    coords: { lat: -26.9530, lng: -48.7420 },
    status: 'PENDING'
  },
  {
    id: 'ubs-limoeiro',
    name: 'UBS Limoeiro',
    address: 'R. Edmundo Leopoldo Merizio - Limoeiro',
    type: LocationType.UBS,
    coords: { lat: -26.9400, lng: -48.7300 },
    status: 'PENDING'
  },
  {
    id: 'ubs-parque-agricultor',
    name: 'UBS Parque do Agricultor',
    address: 'R. Mansueto Felizardo Vieira - Itaipava',
    type: LocationType.UBS,
    coords: { lat: -26.9600, lng: -48.7400 },
    status: 'PENDING'
  },
  {
    id: 'ubs-canhanduba',
    name: 'UBS Canhanduba',
    address: 'Estrada Geral da Canhanduba',
    type: LocationType.UBS,
    coords: { lat: -26.9800, lng: -48.7200 },
    status: 'PENDING'
  },

  // --- FAZENDA / PRAIA BRAVA ---
  {
    id: 'ubs-fazenda-1',
    name: 'UBS Fazenda I',
    address: 'R. Milton Ribeiro da Luz, 200 - Fazenda',
    type: LocationType.UBS,
    coords: { lat: -26.9189, lng: -48.6502 },
    status: 'PENDING'
  },
  {
    id: 'ubs-fazenda-2',
    name: 'UBS Fazenda II',
    address: 'R. Osvaldo Leal - Fazenda',
    type: LocationType.UBS,
    coords: { lat: -26.9150, lng: -48.6550 },
    status: 'PENDING'
  },
  {
    id: 'ubs-cabecudas',
    name: 'UBS Cabeçudas',
    address: 'R. Juvêncio Tavares D Amaral - Cabeçudas',
    type: LocationType.UBS,
    coords: { lat: -26.9250, lng: -48.6400 },
    status: 'PENDING'
  },
  {
    id: 'ubs-praia-brava',
    name: 'UBS Praia Brava',
    address: 'R. Bráulio Werner, 124 - Praia Brava',
    type: LocationType.UBS,
    coords: { lat: -26.9400, lng: -48.6300 },
    status: 'PENDING'
  },
  {
    id: 'vigilancia-sanitaria',
    name: 'Vigilância Sanitária',
    address: 'Av. Sete de Setembro - Fazenda',
    type: LocationType.OTHER,
    coords: { lat: -26.9100, lng: -48.6580 },
    status: 'PENDING'
  },
  {
    id: 'teatro-municipal',
    name: 'Teatro Municipal',
    address: 'R. Gregório Chaves - Fazenda',
    type: LocationType.THEATER,
    coords: { lat: -26.9126, lng: -48.6550 },
    status: 'PENDING'
  },
  {
    id: 'ceredi-fazenda',
    name: 'CEREDI Fazenda',
    address: 'Fazenda - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9160, lng: -48.6520 },
    status: 'PENDING'
  },

  // --- CENTRO ---
  {
    id: 'farmacia-municipal',
    name: 'Farmácia Municipal Centro',
    address: 'Centro - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9080, lng: -48.6620 },
    status: 'PENDING'
  },
  {
    id: 'educacao-centro',
    name: 'Secretaria de Educação',
    address: 'Av. Ver. Abrahão João Francisco - Centro',
    type: LocationType.OTHER,
    coords: { lat: -26.9070, lng: -48.6650 },
    status: 'PENDING'
  },
  {
    id: 'crescem-centro',
    name: 'CRESCEM Centro',
    address: 'Centro - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9090, lng: -48.6640 },
    status: 'PENDING'
  },
  {
    id: 'cepics-centro',
    name: 'CEPICS Centro',
    address: 'R. Uruguai - Centro',
    type: LocationType.OTHER,
    coords: { lat: -26.9060, lng: -48.6680 },
    status: 'PENDING'
  },
  {
    id: 'caps-ad-centro',
    name: 'CAPS AD Centro',
    address: 'Centro - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9050, lng: -48.6630 },
    status: 'PENDING'
  },
  {
    id: 'ubs-ns-gracas',
    name: 'UBS N. Sra. das Graças',
    address: 'R. Brusque, 650 - Centro',
    type: LocationType.UBS,
    coords: { lat: -26.9100, lng: -48.6650 },
    status: 'PENDING'
  },
  {
    id: 'museu-historico',
    name: 'Museu Histórico',
    address: 'R. Hercílio Luz - Centro',
    type: LocationType.OTHER,
    coords: { lat: -26.9040, lng: -48.6600 },
    status: 'PENDING'
  },

  // --- BARRA DO RIO / IMARUÍ ---
  {
    id: 'dengue-imarui',
    name: 'Centro DENGUE',
    address: 'Imaruí - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.8980, lng: -48.6720 },
    status: 'PENDING'
  },
  {
    id: 'dve-imarui',
    name: 'DVE Imaruí',
    address: 'Imaruí - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.8975, lng: -48.6730 },
    status: 'PENDING'
  },
  {
    id: 'gti-imarui',
    name: 'GTI Imaruí',
    address: 'Imaruí - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.8970, lng: -48.6740 },
    status: 'PENDING'
  },
  {
    id: 'transportes-imarui',
    name: 'Setor Transportes Imaruí',
    address: 'Imaruí - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.8965, lng: -48.6750 },
    status: 'PENDING'
  },
  {
    id: 'ubs-imarui',
    name: 'UBS Imaruí',
    address: 'R. Leodegário Pedro da Silva, 246',
    type: LocationType.UBS,
    coords: { lat: -26.8990, lng: -48.6700 },
    status: 'PENDING'
  },

  // --- SÃO JOÃO / SÃO JUDAS ---
  {
    id: 'cmr-sao-judas',
    name: 'CMR São Judas',
    address: 'São Judas - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9020, lng: -48.6750 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-joao-1',
    name: 'UBS São João I',
    address: 'R. Otto Praun, 41 - São João',
    type: LocationType.UBS,
    coords: { lat: -26.9050, lng: -48.6780 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-joao-2',
    name: 'UBS São João II',
    address: 'R. Pedro Rangel - São João',
    type: LocationType.UBS,
    coords: { lat: -26.9040, lng: -48.6800 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-judas',
    name: 'UBS São Judas',
    address: 'R. Indaial - São Judas',
    type: LocationType.UBS,
    coords: { lat: -26.9010, lng: -48.6720 },
    status: 'PENDING'
  },

  // --- PORTAL / ESPINHEIROS / SALSEIROS ---
  {
    id: 'ubs-portal-1',
    name: 'UBS Portal I',
    address: 'Portal - Itajaí',
    type: LocationType.UBS,
    coords: { lat: -26.8620, lng: -48.7020 },
    status: 'PENDING'
  },
  {
    id: 'ubs-portal-2',
    name: 'UBS Portal II',
    address: 'Av. Marcos Luiz Cabral - Portal II',
    type: LocationType.UBS,
    coords: { lat: -26.8600, lng: -48.7050 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-francisco',
    name: 'UBS São Francisco de Assis',
    address: 'Espinheiros - Itajaí',
    type: LocationType.UBS,
    coords: { lat: -26.8650, lng: -48.7000 },
    status: 'PENDING'
  },
  {
    id: 'ubs-santa-regina',
    name: 'UBS Santa Regina',
    address: 'Santa Regina - Itajaí',
    type: LocationType.UBS,
    coords: { lat: -26.8550, lng: -48.7100 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-roque',
    name: 'UBS São Roque',
    address: 'R. Domingos Rampelotti - São Roque',
    type: LocationType.UBS,
    coords: { lat: -26.8500, lng: -48.7150 },
    status: 'PENDING'
  },
  {
    id: 'ubs-espinheiros',
    name: 'UBS Espinheiros',
    address: 'R. Fermino Vieira Cordeiro, 1778',
    type: LocationType.UBS,
    coords: { lat: -26.8680, lng: -48.7100 },
    status: 'PENDING'
  },
  {
    id: 'ubs-salseiros',
    name: 'UBS Salseiros',
    address: 'R. César Augusto Dalçóquio',
    type: LocationType.UBS,
    coords: { lat: -26.8850, lng: -48.7200 },
    status: 'PENDING'
  },

  // --- CIDADE NOVA / PROMORAR ---
  {
    id: 'ubs-cidade-nova-1',
    name: 'UBS Cidade Nova I',
    address: 'R. Agílio Cunha - Cidade Nova',
    type: LocationType.UBS,
    coords: { lat: -26.9200, lng: -48.6900 },
    status: 'PENDING'
  },
  {
    id: 'ubs-cidade-nova-2',
    name: 'UBS Cidade Nova II',
    address: 'Av. Nilo Bittencourt - Cidade Nova',
    type: LocationType.UBS,
    coords: { lat: -26.9180, lng: -48.6920 },
    status: 'PENDING'
  },
  {
    id: 'ubs-promorar-1',
    name: 'UBS Promorar I',
    address: 'Av. Min. Luiz Gallotti - Cidade Nova',
    type: LocationType.UBS,
    coords: { lat: -26.9250, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'ubs-promorar-2',
    name: 'UBS Promorar II',
    address: 'Cidade Nova - Itajaí',
    type: LocationType.UBS,
    coords: { lat: -26.9270, lng: -48.6970 },
    status: 'PENDING'
  },

  // --- CORDEIROS ---
  {
    id: 'ubs-cordeiros',
    name: 'UBS Cordeiros',
    address: 'R. Odílio Garcia, s/n',
    type: LocationType.UBS,
    coords: { lat: -26.8837, lng: -48.6923 },
    status: 'PENDING'
  },
  {
    id: 'ubs-costa-cavalcante',
    name: 'UBS Costa Cavalcante',
    address: 'R. Espírito Santo, 100',
    type: LocationType.UBS,
    coords: { lat: -26.8850, lng: -48.6750 },
    status: 'PENDING'
  },
  {
    id: 'ubs-jardim-esperanca',
    name: 'UBS Jardim Esperança',
    address: 'R. Sebastião Romeu Soares',
    type: LocationType.UBS,
    coords: { lat: -26.8780, lng: -48.6950 },
    status: 'PENDING'
  },
  {
    id: 'ubs-murta',
    name: 'UBS Murta',
    address: 'R. Orlandina Amália Pires Correa, 300',
    type: LocationType.UBS,
    coords: { lat: -26.8720, lng: -48.6850 },
    status: 'PENDING'
  },
  {
    id: 'ubs-votorantim',
    name: 'UBS Votorantim',
    address: 'R. Selso Duarte Moreira, 1442',
    type: LocationType.UBS,
    coords: { lat: -26.8800, lng: -48.6880 },
    status: 'PENDING'
  },
  {
    id: 'upa-cordeiros',
    name: 'UPA Cordeiros',
    address: 'R. Dr. Reinaldo Schmithausen',
    type: LocationType.OTHER,
    coords: { lat: -26.8860, lng: -48.6910 },
    status: 'PENDING'
  },

  // --- VILA OPERÁRIA ---
  {
    id: 'caps-1-vila',
    name: 'CAPS I Vila Operária',
    address: 'Vila Operária - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9120, lng: -48.6700 },
    status: 'PENDING'
  },
  {
    id: 'caps-2-vila',
    name: 'CAPS II Vila Operária',
    address: 'Vila Operária - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9130, lng: -48.6710 },
    status: 'PENDING'
  },
  {
    id: 'ubs-centro-vila',
    name: 'UBS Centro Vila',
    address: 'R. Alberto Werner',
    type: LocationType.UBS,
    coords: { lat: -26.9140, lng: -48.6720 },
    status: 'PENDING'
  },

  // --- SÃO VICENTE ---
  {
    id: 'ubs-rio-bonito',
    name: 'UBS Rio Bonito',
    address: 'R. Nilson Edson dos Santos',
    type: LocationType.UBS,
    coords: { lat: -26.8920, lng: -48.7050 },
    status: 'PENDING'
  },
  {
    id: 'ubs-sao-vicente',
    name: 'UBS São Vicente',
    address: 'R. Padre Paulo Condla, 392',
    type: LocationType.UBS,
    coords: { lat: -26.9063, lng: -48.6895 },
    status: 'PENDING'
  },
  {
    id: 'cis-sao-vicente',
    name: 'CIS São Vicente',
    address: 'São Vicente - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9050, lng: -48.6880 },
    status: 'PENDING'
  },
  {
    id: 'ubs-bambuzal',
    name: 'UBS Bambuzal',
    address: 'R. São Joaquim - São Vicente',
    type: LocationType.UBS,
    coords: { lat: -26.8950, lng: -48.6900 },
    status: 'PENDING'
  },
  {
    id: 'ctea-sao-vicente',
    name: 'CTEA São Vicente',
    address: 'São Vicente - Itajaí',
    type: LocationType.OTHER,
    coords: { lat: -26.9070, lng: -48.6900 },
    status: 'PENDING'
  }
];

export const MOCK_DRIVERS_LIST: DriverState[] = [
  {
    id: 'driver-01',
    name: 'Motorista Demonstração',
    currentCoords: LOCATIONS_DB[0].coords,
    currentAddress: 'Aguardando início...',
    route: [],
    status: 'IDLE',
    speed: 0
  }
];
export const MOCK_HISTORY: RouteHistory[] = [];
