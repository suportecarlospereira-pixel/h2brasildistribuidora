import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Delivery, Driver } from '../types';
import { DRIVERS } from '../constants';
import { dbService } from '../services/dbService';
import Logo from './Logo';

// Ícones personalizados
const truckIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/7541/7541900.png',
  iconSize: [35, 35],
});

const packageIcon = (status: string) => new Icon({
  iconUrl: status === 'DELIVERED' 
    ? 'https://cdn-icons-png.flaticon.com/512/190/190411.png' // Verde/Check
    : status === 'IN_TRANSIT'
    ? 'https://cdn-icons-png.flaticon.com/512/2972/2972528.png' // Amarelo/Caminhãozinho
    : status === 'FAILED'
    ? 'https://cdn-icons-png.flaticon.com/512/1828/1828843.png' // Vermelho/X
    : 'https://cdn-icons-png.flaticon.com/512/2953/2953363.png', // Caixa normal
  iconSize: [30, 30],
});

const deliveryStatusMap = {
  'PENDING': { label: 'Pendente', color: 'bg-slate-100 text-slate-600' },
  'IN_TRANSIT': { label: 'Em Rota', color: 'bg-blue-100 text-blue-700' },
  'DELIVERED': { label: 'Entregue', color: 'bg-emerald-100 text-emerald-700' },
  'FAILED': { label: 'Falhou', color: 'bg-red-100 text-red-700' },
};

// Componente para capturar clique no mapa quando estiver editando
const MapClickHandler = ({ onLocationSelect, isEditing }: { onLocationSelect: (lat: number, lng: number) => void, isEditing: boolean }) => {
  useMapEvents({
    click(e) {
      if (isEditing) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const AdminView = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  
  // Estados para o Modal de Edição/Criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Delivery> | null>(null);

  useEffect(() => {
    const unsubDel = dbService.subscribeDeliveries(setDeliveries);
    const unsubDrivers = dbService.subscribeDrivers(setDrivers);
    return () => { unsubDel(); unsubDrivers(); };
  }, []);

  const handleSave = async () => {
    if (!editingItem || !editingItem.customerName || !editingItem.address || !editingItem.lat) {
      alert("Preencha nome, endereço e clique no mapa para definir a localização.");
      return;
    }

    const deliveryData = {
      customerName: editingItem.customerName,
      address: editingItem.address,
      lat: editingItem.lat,
      lng: editingItem.lng || 0,
      status: editingItem.status || 'PENDING',
      driverId: editingItem.driverId || undefined,
      priority: editingItem.priority || 'MEDIUM',
      items: editingItem.items || [],
      notes: editingItem.notes || ''
    };

    try {
      if (editingItem.id) {
        // Atualizar existente
        await dbService.updateDelivery({ ...deliveryData, id: editingItem.id } as Delivery);
      } else {
        // Criar novo
        await dbService.addDelivery(deliveryData as Delivery);
      }
      setIsModalOpen(false);
      setEditingItem(null);
    } catch (e) {
      alert("Erro ao salvar.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta entrega?")) {
      await dbService.deleteDelivery(id);
    }
  };

  const openNewDelivery = () => {
    setEditingItem({
      customerName: '',
      address: '',
      lat: -23.550520, // Default SP
      lng: -46.633308,
      status: 'PENDING',
      items: ['Água 20L'], // Default item
      priority: 'MEDIUM'
    });
    setIsModalOpen(true);
  };

  const openEditDelivery = (delivery: Delivery) => {
    setEditingItem({ ...delivery });
    setIsModalOpen(true);
  };

  // Estatísticas
  const stats = {
    total: deliveries.length,
    delivered: deliveries.filter(d => d.status === 'DELIVERED').length,
    pending: deliveries.filter(d => d.status === 'PENDING').length,
    transit: deliveries.filter(d => d.status === 'IN_TRANSIT').length,
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-20">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="text-xl font-black text-slate-800 italic uppercase">Painel de Controle</h1>
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">H2 Brasil Distribuidora</p>
          </div>
        </div>
        <div className="flex gap-4">
           <div className="text-right hidden md:block">
             <p className="text-xs text-slate-400 uppercase font-bold">Entregas Hoje</p>
             <p className="text-xl font-black text-blue-600">{stats.delivered} / {stats.total}</p>
           </div>
           <button 
             onClick={openNewDelivery}
             className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all active:scale-95 flex items-center gap-2"
           >
             <i className="fas fa-plus"></i> Nova Entrega
           </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Lista Lateral */}
        <aside className="w-full md:w-96 bg-white border-r flex flex-col z-10 shadow-lg">
          <div className="p-4 bg-slate-50 border-b">
            <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Monitoramento</h2>
            <div className="flex gap-2">
              <span className="flex-1 bg-white border rounded p-2 text-center">
                <div className="text-xs text-slate-400 font-bold">Rota</div>
                <div className="font-black text-blue-600">{stats.transit}</div>
              </span>
              <span className="flex-1 bg-white border rounded p-2 text-center">
                <div className="text-xs text-slate-400 font-bold">Pend.</div>
                <div className="font-black text-amber-500">{stats.pending}</div>
              </span>
              <span className="flex-1 bg-white border rounded p-2 text-center">
                <div className="text-xs text-slate-400 font-bold">Fim</div>
                <div className="font-black text-emerald-500">{stats.delivered}</div>
              </span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {deliveries.map(delivery => (
              <div key={delivery.id} className="p-3 bg-white border rounded-xl hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${deliveryStatusMap[delivery.status].color}`}>
                    {deliveryStatusMap[delivery.status].label}
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditDelivery(delivery)} className="text-slate-400 hover:text-blue-500 p-1"><i className="fas fa-edit"></i></button>
                    <button onClick={() => handleDelete(delivery.id)} className="text-slate-400 hover:text-red-500 p-1"><i className="fas fa-trash"></i></button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 text-sm">{delivery.customerName}</h3>
                <p className="text-xs text-slate-500 truncate mb-2"><i className="fas fa-map-marker-alt mr-1"></i>{delivery.address}</p>
                
                <div className="flex items-center gap-2 mt-2">
                  <select 
                    className="flex-1 bg-slate-50 border rounded text-xs p-1 font-semibold text-slate-700 outline-none focus:border-blue-500"
                    value={delivery.driverId || ''}
                    onChange={(e) => dbService.assignDriver(delivery.id, e.target.value)}
                  >
                    <option value="">Sem motorista</option>
                    {DRIVERS.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
            {deliveries.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">Nenhuma entrega cadastrada</div>
            )}
          </div>
        </aside>

        {/* Mapa */}
        <div className="flex-1 relative bg-slate-200">
           {isModalOpen && (
             <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-600 text-white px-4 py-2 rounded-full shadow-xl font-bold text-sm animate-bounce">
               <i className="fas fa-map-pin mr-2"></i> Clique no mapa para definir a localização
             </div>
           )}

           <MapContainer center={[-23.550520, -46.633308]} zoom={13} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            
            <MapClickHandler isEditing={isModalOpen} onLocationSelect={(lat, lng) => setEditingItem(prev => ({ ...prev, lat, lng }))} />

            {/* Marcador de Edição (Onde o usuário clicou) */}
            {isModalOpen && editingItem?.lat && (
               <Marker position={[editingItem.lat, editingItem.lng || 0]} icon={packageIcon('PENDING')} opacity={0.6} />
            )}

            {/* Entregas */}
            {deliveries.map(d => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={packageIcon(d.status)}>
                <Popup>
                  <div className="text-xs">
                    <strong>{d.customerName}</strong><br/>
                    {d.address}<br/>
                    Status: {deliveryStatusMap[d.status].label}
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Motoristas */}
            {drivers.map(d => (
              <Marker key={d.id} position={[d.lat, d.lng]} icon={truckIcon}>
                <Popup><strong className="text-xs">{d.name} (Motorista)</strong></Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Modal de Criação/Edição */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-[2000] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn">
            <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
              <h3 className="font-bold uppercase tracking-widest">{editingItem.id ? 'Editar Entrega' : 'Nova Entrega'}</h3>
              <button onClick={() => setIsModalOpen(false)}><i className="fas fa-times"></i></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                <input 
                  type="text" 
                  value={editingItem.customerName} 
                  onChange={e => setEditingItem({...editingItem, customerName: e.target.value})}
                  className="w-full border rounded-lg p-2 font-semibold outline-none focus:border-blue-500"
                  placeholder="Nome do cliente"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Endereço (Texto)</label>
                <input 
                  type="text" 
                  value={editingItem.address} 
                  onChange={e => setEditingItem({...editingItem, address: e.target.value})}
                  className="w-full border rounded-lg p-2 font-semibold outline-none focus:border-blue-500"
                  placeholder="Rua, Número, Bairro"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridade</label>
                  <select 
                    value={editingItem.priority} 
                    onChange={e => setEditingItem({...editingItem, priority: e.target.value as any})}
                    className="w-full border rounded-lg p-2 font-semibold bg-white"
                  >
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div>
                   <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Localização</label>
                   <div className="text-xs bg-slate-100 p-2 rounded text-center border">
                      {editingItem.lat?.toFixed(4)}, {editingItem.lng?.toFixed(4)}
                   </div>
                   <p className="text-[10px] text-blue-600 mt-1 text-center">* Clique no mapa para alterar</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Itens (separar por vírgula)</label>
                <input 
                  type="text" 
                  value={editingItem.items?.join(', ')} 
                  onChange={e => setEditingItem({...editingItem, items: e.target.value.split(',').map(s => s.trim())})}
                  className="w-full border rounded-lg p-2 font-semibold outline-none focus:border-blue-500"
                  placeholder="Ex: 2x Água, 1x Suporte"
                />
              </div>

              <button 
                onClick={handleSave} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg mt-2 transition-all active:scale-95"
              >
                Salvar Entrega
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
