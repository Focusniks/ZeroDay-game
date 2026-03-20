import { useCallback, useEffect, useRef, useState } from "react";

export type NetworkStatus = "offline" | "connecting" | "connected" | "compromised" | "hidden";

export type NetworkNode = {
  id: string;
  name: string;
  type: "server" | "router" | "firewall" | "database" | "mainframe";
  security: number; // 1-10
  location: string;
  owner: "Corp" | "Gov" | "DarkNet" | "Unknown" | "ZeroDay";
  status: "online" | "offline" | "alert";
  services: string[];
  hacked: boolean;
};

export type NetworkState = {
  status: NetworkStatus;
  currentNode: NetworkNode | null;
  traceLevel: number; // 0-100%
  bandwidth: number; // Mbps
  connectedNodes: string[];
  firewall: boolean;
  proxyChain: string[];
  scanResults: NetworkNode[];
};

const INITIAL_NODES: NetworkNode[] = [
  { id: "node-1", name: "zeroday-core", type: "mainframe", security: 1, location: "Unknown", owner: "ZeroDay", status: "online", services: ["ssh", "http"], hacked: false },
  { id: "node-2", name: "corp-mail", type: "server", security: 4, location: "Berlin, DE", owner: "Corp", status: "online", services: ["smtp", "imap"], hacked: false },
  { id: "node-3", name: "gov-db", type: "database", security: 7, location: "Moscow, RU", owner: "Gov", status: "alert", services: ["sql"], hacked: false },
  { id: "node-4", name: "darknet-relay", type: "router", security: 5, location: "Unknown", owner: "DarkNet", status: "online", services: ["tor"], hacked: false },
  { id: "node-5", name: "bank-firewall", type: "firewall", security: 8, location: "Zurich, CH", owner: "Corp", status: "online", services: ["https"], hacked: false },
  { id: "node-6", name: "cloud-storage", type: "server", security: 3, location: "Amsterdam, NL", owner: "Corp", status: "online", services: ["http", "ftp"], hacked: false },
];

export function useNetworkSimulation() {
  const [state, setState] = useState<NetworkState>({
    status: "offline",
    currentNode: null,
    traceLevel: 0,
    bandwidth: 0,
    connectedNodes: [],
    firewall: true,
    proxyChain: [],
    scanResults: []
  });

  const traceTimerRef = useRef<number | null>(null);
  const bandwidthTimerRef = useRef<number | null>(null);

  // Симуляция изменения пропускной способности
  useEffect(() => {
    if (state.status === "offline") return;

    bandwidthTimerRef.current = window.setInterval(() => {
      setState(prev => {
        const baseBandwidth = prev.status === "hidden" ? 50 : prev.status === "connected" ? 100 : 30;
        const variance = Math.random() * 20 - 10;
        return { ...prev, bandwidth: Math.max(10, Math.round(baseBandwidth + variance)) };
      });
    }, 2000);

    return () => {
      if (bandwidthTimerRef.current) clearInterval(bandwidthTimerRef.current);
    };
  }, [state.status]);

  // Симуляция отслеживания (trace)
  useEffect(() => {
    if (state.status === "offline" || state.status === "hidden") {
      if (traceTimerRef.current) clearInterval(traceTimerRef.current);
      setState(prev => ({ ...prev, traceLevel: 0 }));
      return;
    }

    traceTimerRef.current = window.setInterval(() => {
      setState(prev => {
        // Trace растёт быстрее при активных действиях
        const traceIncrease = prev.status === "compromised" ? 2 : prev.firewall ? 0.3 : 0.5;
        const proxyReduction = prev.proxyChain.length * 0.2;
        const newTrace = Math.max(0, Math.min(100, prev.traceLevel + traceIncrease - proxyReduction));
        
        // Если trace достиг 100% - game over или alert
        if (newTrace >= 100) {
          console.warn("TRACE COMPLETE - YOU WERE FOUND!");
        }
        
        return { ...prev, traceLevel: Math.round(newTrace) };
      });
    }, 1000);

    return () => {
      if (traceTimerRef.current) clearInterval(traceTimerRef.current);
    };
  }, [state.status, state.firewall, state.proxyChain]);

  const connect = useCallback((node: NetworkNode) => {
    setState(prev => ({
      ...prev,
      status: "connecting",
      currentNode: node
    }));

    // Симуляция подключения
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        status: node.hacked ? "compromised" : "connected",
        connectedNodes: [...prev.connectedNodes, node.id],
        bandwidth: 100
      }));
    }, 1500);
  }, []);

  const disconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: "offline",
      currentNode: null,
      bandwidth: 0
    }));
  }, []);

  const scanNetwork = useCallback(async (): Promise<NetworkNode[]> => {
    setState(prev => ({ ...prev, status: prev.status === "offline" ? "connecting" : prev.status }));
    
    // Симуляция сканирования
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const results = INITIAL_NODES.map(node => ({
      ...node,
      status: Math.random() > 0.8 ? "alert" : "online" as "online" | "alert"
    }));
    
    setState(prev => ({
      ...prev,
      scanResults: results,
      status: prev.status === "connecting" ? "connected" : prev.status
    }));
    
    return results;
  }, []);

  const hackNode = useCallback(async (nodeId: string): Promise<boolean> => {
    const node = state.scanResults.find(n => n.id === nodeId);
    if (!node) return false;

    // Симуляция взлома (здесь должна быть мини-игра)
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const success = Math.random() > (node.security / 10);
    
    if (success) {
      setState(prev => ({
        ...prev,
        scanResults: prev.scanResults.map(n => 
          n.id === nodeId ? { ...n, hacked: true } : n
        ),
        traceLevel: prev.traceLevel + 15 // Взлом увеличивает trace
      }));
    } else {
      setState(prev => ({
        ...prev,
        traceLevel: prev.traceLevel + 25, // Неудачный взлом сильно увеличивает trace
        status: "compromised"
      }));
    }
    
    return success;
  }, [state.scanResults]);

  const toggleFirewall = useCallback(() => {
    setState(prev => ({ ...prev, firewall: !prev.firewall }));
  }, []);

  const addProxy = useCallback((proxy: string) => {
    setState(prev => ({
      ...prev,
      proxyChain: [...prev.proxyChain, proxy],
      status: "hidden"
    }));
  }, []);

  const removeProxy = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      proxyChain: prev.proxyChain.filter((_, i) => i !== index),
      status: prev.proxyChain.length <= 1 ? "connected" : "hidden"
    }));
  }, []);

  return {
    state,
    connect,
    disconnect,
    scanNetwork,
    hackNode,
    toggleFirewall,
    addProxy,
    removeProxy
  };
}
