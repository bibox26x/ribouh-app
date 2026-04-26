import tw from 'twrnc';
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, Modal, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Activity, Thermometer, Droplets, Wind, AlertTriangle, CheckCircle2, XIcon, Bell, History, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

interface Telemetry {
  temperature: number;
  humidity: number;
  gas: number;
  timestamp: number;
}

interface Alert {
  id: string;
  level: 'normal' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

const generateMockTelemetry = (): Telemetry => ({
  temperature: 25 + Math.random() * 25,
  humidity: 40 + Math.random() * 50,
  gas: 300 + Math.random() * 500,
  timestamp: Date.now(),
});

export default function App() {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'charts' | 'alerts'>('dashboard');
  const [showSnoozeModal, setShowSnoozeModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const screenWidth = Dimensions.get("window").width;

  useEffect(() => {
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Push notification permission denied');
      }
    })();

    // Initial population
    const initialHistory = Array.from({ length: 20 }, generateMockTelemetry);
    setHistory(initialHistory);
    setTelemetry(initialHistory[initialHistory.length - 1]);

    const interval = setInterval(() => {
      const newTelemetry = generateMockTelemetry();
      setTelemetry(newTelemetry);
      setHistory(prev => [...prev.slice(-19), newTelemetry]);

      if (Date.now() > snoozedUntil) {
        if (newTelemetry.temperature > 48) {
          triggerAlert('critical', 'Core temperature critical: Exceeded 48°C');
        } else if (newTelemetry.gas > 750) {
          triggerAlert('critical', 'Toxic gas concentration detected above 750ppm');
        } else if (newTelemetry.humidity > 88) {
          triggerAlert('warning', 'High moisture interference detected');
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [snoozedUntil]);

  const triggerAlert = async (level: 'warning' | 'critical', message: string) => {
    const newAlert: Alert = {
      id: Math.random().toString(36).substring(7),
      level,
      message,
      timestamp: Date.now(),
      acknowledged: false
    };
    
    setAlerts(prev => {
      if (prev.some(a => a.message === message && !a.acknowledged)) return prev; // Prevent spam text
      return [newAlert, ...prev].slice(0, 50);
    });
    
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Sentinel ${level.toUpperCase()} Alert`,
          body: message,
          data: { level },
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Push not sent', e);
    }
  };

  const snoozeAlerts = (minutes: number) => {
    setSnoozedUntil(Date.now() + minutes * 60000);
    setShowSnoozeModal(false);
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  const acknowledgeAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, acknowledged: true } : a));
  };

  const systemStatus = useMemo(() => {
    if (!telemetry) return 'normal';
    if (alerts.some(a => a.level === 'critical' && !a.acknowledged)) return 'critical';
    if (alerts.some(a => a.level === 'warning' && !a.acknowledged)) return 'warning';
    return 'normal';
  }, [telemetry, alerts]);

  if (!telemetry) {
    return (
      <View style={tw`flex-1 items-center justify-center bg-[#0A0C10]`}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={tw`text-emerald-400 font-bold mt-4 uppercase`}>Initializing Subsystems</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={tw`flex-1 bg-[#0A0C10]`}>
      {/* Header */}
      <View style={tw`h-14 border-b border-[#ffffff1a] bg-[#0F1218] px-4 flex-row items-center justify-between z-30`}>
        <View style={tw`flex-row items-center gap-3`}>
          <View style={tw`w-8 h-8 bg-indigo-600 rounded flex items-center justify-center`}>
            <Text style={tw`font-bold text-white`}>Σ</Text>
          </View>
          <Text style={tw`text-sm font-bold tracking-widest uppercase text-white`}>
            Sentinel <Text style={tw`text-slate-500 font-normal`}>v4.0</Text>
          </Text>
        </View>

        <View style={tw`flex-row items-center gap-3`}>
          <TouchableOpacity 
            onPress={() => setShowSnoozeModal(true)}
            style={tw.style(
              "p-1.5 rounded border border-[#ffffff1a]",
              Date.now() < snoozedUntil ? "bg-amber-500/10 border-[#f59e0b33]" : "bg-white/5"
            )}
          >
            <Bell size={16} color={Date.now() < snoozedUntil ? "#f59e0b" : "#94a3b8"} fill={Date.now() < snoozedUntil ? "#f59e0b" : "transparent"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={tw`flex-1`} contentContainerStyle={{ paddingBottom: 100 }}>
        {Date.now() < snoozedUntil && (
          <View style={tw`bg-[#f59e0b1a] border-b border-[#f59e0b33] px-4 py-2 flex-row items-center justify-between`}>
            <View style={tw`flex-row items-center gap-2`}>
              <View style={tw`w-1.5 h-1.5 rounded-full bg-amber-500`} />
              <Text style={tw`text-amber-500 text-[10px] font-bold uppercase`}>System Silenced UNTIL {format(snoozedUntil, 'HH:mm')}</Text>
            </View>
            <TouchableOpacity onPress={() => setSnoozedUntil(0)}>
              <Text style={tw`text-amber-500 font-bold uppercase tracking-widest text-[10px]`}>Unmute</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <View style={tw`p-4 space-y-4`}>
             <View style={tw`mb-2`}>
                <Text style={tw`text-xl text-white tracking-widest mb-1`}>System Core</Text>
                <View style={tw`flex-row items-center gap-2`}>
                  <View style={tw.style(
                    "w-2 h-2 rounded-full",
                    systemStatus === 'normal' ? "bg-emerald-500" : systemStatus === 'warning' ? "bg-amber-500" : "bg-rose-500"
                  )} />
                  <Text style={tw`text-[10px] text-slate-500 uppercase tracking-widest text-bold`}>
                    Live Status: {systemStatus}
                  </Text>
                </View>
             </View>

             <View style={tw`flex-col gap-3`}>
                <MetricCard 
                  title="Internal Temp" 
                  value={telemetry?.temperature.toFixed(1)} 
                  unit="°C"
                  status={telemetry?.temperature! > 45 ? 'critical' : telemetry?.temperature! > 32 ? 'warning' : 'normal'}
                />
                <MetricCard 
                  title="Vapor Density" 
                  value={telemetry?.humidity.toFixed(0)} 
                  unit="%"
                  status={telemetry?.humidity! > 85 || telemetry?.humidity! < 20 ? 'critical' : telemetry?.humidity! > 70 || telemetry?.humidity! < 30 ? 'warning' : 'normal'}
                />
                <MetricCard 
                  title="Atmospheric Gas" 
                  value={telemetry?.gas.toFixed(0)} 
                  unit="ppm"
                  status={telemetry?.gas! > 700 ? 'critical' : telemetry?.gas! > 400 ? 'warning' : 'normal'}
                />
             </View>

             <View style={tw`bg-[#0F1218] border border-[#ffffff1a] rounded-xl p-4 mt-6`}>
                <View style={tw`flex-row items-center justify-between mb-4`}>
                  <Text style={tw`text-[10px] font-bold uppercase tracking-widest text-slate-500`}>Node_Log_Prev 1h</Text>
                  <View style={tw`flex-row items-center gap-1.5`}>
                    <View style={tw`w-1 h-1 rounded-full bg-orange-500`} />
                    <Text style={tw`text-[8px] text-orange-500 uppercase`}>Tmp</Text>
                  </View>
                </View>
                {history.length > 0 && (
                  <TrendChart data={history.map(h => h.temperature)} color="rgba(249, 115, 22, 1)" height={180} />
                )}
             </View>
          </View>
        )}

        {/* Charts Tab */}
        {activeTab === 'charts' && (
          <View style={tw`p-4 space-y-6`}>
             <Text style={tw`text-xl text-white tracking-tight mb-4`}>Signal History</Text>
             <View style={tw`bg-[#0F1218] border border-[#ffffff1a] rounded-xl p-4`}>
                <Text style={tw`text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-4`}>Gas Concentration Trend</Text>
                {history.length > 0 && (
                  <TrendChart data={history.map(h => h.gas)} color="rgba(79, 70, 229, 1)" height={180} />
                )}
             </View>
             
             <View style={tw`p-4 border border-[#ffffff1a] bg-white rounded-xl`} style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <Text style={tw`text-[10px] text-slate-500 uppercase tracking-widest mb-4`}>Metadata Summary</Text>
                <View style={tw`flex-row justify-between`}>
                   <View>
                     <Text style={tw`text-[10px] text-slate-600 mb-1`}>Sample Count</Text>
                     <Text style={tw`text-lg text-white font-bold`}>{history.length}</Text>
                   </View>
                   <View>
                     <Text style={tw`text-[10px] text-slate-600 mb-1`}>Uptime</Text>
                     <Text style={tw`text-lg text-white font-bold`}>14d 2h</Text>
                   </View>
                </View>
             </View>
          </View>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <View style={tw`p-4 flex-col gap-4`}>
             <View style={tw`flex-row items-center justify-between mb-2`}>
                <Text style={tw`text-xl text-white tracking-tight`}>Incident Log</Text>
                <TouchableOpacity onPress={clearAllAlerts}>
                  <Text style={tw`text-[10px] font-bold uppercase text-slate-500 tracking-widest`}>Clear Logs</Text>
                </TouchableOpacity>
             </View>
             
             {alerts.length === 0 ? (
                <View style={tw`items-center justify-center py-20 border border-dashed border-[#ffffff1a] rounded-xl`}>
                  <CheckCircle2 size={40} color="#475569" style={tw`mb-4 opacity-50`} />
                  <Text style={tw`text-xs uppercase tracking-widest text-[#475569]`}>No Incidents Found</Text>
                </View>
             ) : (
               alerts.map((alert) => (
                 <View
                   key={alert.id}
                   style={tw.style(
                     "p-4 border rounded-xl flex-row gap-4 mb-3",
                     alert.acknowledged ? "bg-[#ffffff05] border-[#ffffff05] opacity-50" :
                     alert.level === 'critical' ? "bg-[#f43f5e1a] border-[#f43f5e33]" : "bg-[#f59e0b1a] border-[#f59e0b33]"
                   )}
                 >
                   <View style={tw.style(
                     "w-10 h-10 rounded-lg shrink-0 items-center justify-center",
                     alert.level === 'critical' ? "bg-[#f43f5e33]" : "bg-[#f59e0b33]"
                   )}>
                     {alert.level === 'critical' ? <ShieldAlert size={20} color="#f43f5e" /> : <Bell size={20} color="#f59e0b" />}
                   </View>
                   <View style={tw`flex-1`}>
                     <View style={tw`flex-row items-center justify-between mb-1`}>
                       <Text style={tw.style(
                         "text-[9px] font-bold uppercase tracking-tighter",
                         alert.level === 'critical' ? "text-rose-400" : "text-amber-400"
                       )}>
                         {alert.level}
                       </Text>
                       <Text style={tw`text-[8px] text-slate-600`}>{format(alert.timestamp, 'HH:mm:ss')}</Text>
                     </View>
                     <Text style={tw`text-sm font-semibold text-white mb-2`} numberOfLines={2}>{alert.message}</Text>
                     {!alert.acknowledged && (
                       <TouchableOpacity 
                         onPress={() => acknowledgeAlert(alert.id)}
                         style={tw`mt-2 w-full py-2 bg-[#ffffff1a] rounded-lg items-center`}
                       >
                         <Text style={tw`text-[10px] font-bold uppercase tracking-widest text-slate-300`}>Dismiss Alert</Text>
                       </TouchableOpacity>
                     )}
                   </View>
                 </View>
               ))
             )}
          </View>
        )}
      </ScrollView>

      {/* Snooze Modal */}
      <Modal transparent visible={showSnoozeModal} animationType="slide">
        <View style={tw`flex-1 justify-end bg-black/80`}>
           <View style={tw`bg-[#0F1218] border-t border-[#ffffff1a] rounded-t-3xl p-6`}>
              <View style={tw`flex-row items-center justify-between mb-8`}>
                 <Text style={tw`text-lg font-semibold text-white font-bold`}>Signal Suppression</Text>
                 <TouchableOpacity onPress={() => setShowSnoozeModal(false)}>
                   <XIcon size={20} color="#64748b" />
                 </TouchableOpacity>
              </View>
              
              <Text style={tw`text-xs text-slate-400 mb-6 uppercase tracking-widest text-center`}>
                Configure duration to temporarily silence sensor-triggered incidents.
              </Text>

              <View style={tw`flex-row flex-wrap justify-between mb-8`}>
                {[5, 15, 30, 60].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    onPress={() => snoozeAlerts(mins)}
                    style={tw`w-[48%] py-4 bg-[#ffffff1a] border border-[#ffffff1a] rounded-2xl items-center mb-4`}
                  >
                    <Text style={tw`text-sm font-bold text-white uppercase`}>{mins > 59 ? `${mins/60} Hour` : `${mins} Mins`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
           </View>
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={tw`h-16 border-t border-[#ffffff1a] bg-[#0F1218] absolute bottom-0 left-0 right-0 z-30 flex-row items-center justify-around pb-2 pt-2`}>
        <NavButton 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')} 
          icon={<Activity size={20} color={activeTab === 'dashboard' ? "#818cf8" : "#64748b"} />} 
          label="Status" 
        />
        <NavButton 
          active={activeTab === 'charts'} 
          onClick={() => setActiveTab('charts')} 
          icon={<History size={20} color={activeTab === 'charts' ? "#818cf8" : "#64748b"} />} 
          label="History" 
        />
        <NavButton 
          active={activeTab === 'alerts'} 
          onClick={() => setActiveTab('alerts')} 
          icon={<Bell size={20} color={activeTab === 'alerts' ? "#818cf8" : "#64748b"} />} 
          label="Alerts" 
          badge={alerts.filter(a => !a.acknowledged).length}
        />
      </View>
    </SafeAreaView>
  );
}

function NavButton({ active, onClick, icon, label, badge }: { active: boolean, onClick: () => void, icon: any, label: string, badge?: number }) {
  return (
    <TouchableOpacity 
      onPress={onClick}
      style={tw`items-center flex-1 py-1`}
    >
      <View style={tw.style("p-1 rounded-lg mb-1", active && "bg-indigo-500/20")}>
        {icon}
      </View>
      <Text style={tw.style("text-[10px] font-bold uppercase tracking-widest", active ? "text-indigo-400" : "text-slate-500")}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={tw`absolute top-0 right-4 min-w-[14px] h-[14px] px-1 bg-rose-500 rounded-full items-center justify-center border border-[#0F1218]`}>
          <Text style={tw`text-white text-[8px] font-bold`}>{badge}</Text>
        </View>
      )}
      {active && (
        <View style={tw`absolute -top-3 left-8 right-8 h-0.5 bg-indigo-500`} />
      )}
    </TouchableOpacity>
  );
}

function MetricCard({ title, value, unit, status }: { title: string, value: string | undefined, unit: string, status: string }) {
  return (
    <View style={tw.style(
      "bg-[#161B22] p-5 border rounded-xl",
      status === 'critical' ? "border-[#f43f5e80] bg-[#f43f5e1a]" :
      status === 'warning' ? "border-[#f59e0b80] bg-[#f59e0b1a]" :
      "border-[#ffffff1a]"
    )}>
      <View style={tw`flex-row items-center justify-between mb-2`}>
        <Text style={tw`text-[10px] font-bold text-slate-500 uppercase tracking-widest`}>{title}</Text>
        <View style={tw.style(
          "w-2 h-2 rounded-full",
          status === 'critical' ? "bg-rose-500" :
          status === 'warning' ? "bg-amber-500" :
          "bg-emerald-500"
        )} />
      </View>
      <View style={tw`flex-row items-baseline gap-1 mt-2`}>
        <Text style={tw.style(
          "text-3xl tracking-tighter font-bold",
          status === 'critical' ? "text-rose-400" :
          status === 'warning' ? "text-amber-400" :
          "text-white"
        )}>
          {value || '0.0'}
        </Text>
        <Text style={tw`text-xs text-slate-500 ml-1 font-bold`}>{unit}</Text>
      </View>
      <View style={tw`mt-4 flex-row items-center justify-between`}>
         <View style={tw.style(
           "px-2 py-1 rounded border",
           status === 'critical' ? "border-[#f43f5e33]" :
           status === 'warning' ? "border-[#f59e0b33]" :
           "border-[#10b98133]"
         )}>
            <Text style={tw.style(
              "text-[9px] font-bold uppercase",
              status === 'critical' ? "text-rose-500" :
              status === 'warning' ? "text-amber-500" :
              "text-emerald-500"
            )}>{status}</Text>
         </View>
      </View>
    </View>
  );
}

function TrendChart({ data, color, height }: { data: number[], color: string, height: number }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = range * 0.1;
  
  const paddedMin = min - padding;
  const paddedRange = (max + padding) - paddedMin;

  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginVertical: 8 }}>
      {data.map((val, i) => {
        const pct = Math.max(0.05, (val - paddedMin) / paddedRange);
        return (
          <View key={i} style={{ flex: 1, marginHorizontal: 2, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View style={{ width: '100%', height: `${pct * 100}%`, backgroundColor: color, borderRadius: 4, opacity: 0.8 }} />
          </View>
        );
      })}
    </View>
  );
}
