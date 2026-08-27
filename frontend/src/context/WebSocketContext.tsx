import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { Alert } from '../types';

interface WebSocketContextType {
  isConnected: boolean;
  latestAlert: Alert | null;
  subscribe: (topic: string, callback: (data: any) => void) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestAlert, setLatestAlert] = useState<Alert | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    let socket: WebSocket;
    let reconnectTimeout: any;

    const getWebSocketUrl = (): string => {
      if (import.meta.env.VITE_WS_URL) {
        return `${String(import.meta.env.VITE_WS_URL).trim().replace(/\/$/, '')}/ws/soc`;
      }
      if (import.meta.env.VITE_API_URL) {
        const apiUrl = String(import.meta.env.VITE_API_URL).trim().replace(/\/$/, '');
        const wsBase = apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
        return `${wsBase}/ws/soc`;
      }
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/soc`;
    };

    const connect = () => {
      const wsUrl = getWebSocketUrl();
      socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        console.log('[NetGuard WS] Connected to SOC stream');
      };

      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { topic, data } = payload;

          if (topic === 'alert') {
            setLatestAlert(data);
          }

          // Trigger topic listeners
          const topicListeners = listenersRef.current.get(topic);
          if (topicListeners) {
            topicListeners.forEach((callback) => callback(data));
          }
        } catch (err) {
          // Keep-alive or non-JSON message
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        console.log('[NetGuard WS] Disconnected. Reconnecting in 3s...');
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = (error) => {
        console.warn('[NetGuard WS] Connection error:', error);
        socket.close();
      };
    };

    connect();

    // Heartbeat ping
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send('ping');
      }
    }, 15000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const subscribe = useCallback((topic: string, callback: (data: any) => void) => {
    if (!listenersRef.current.has(topic)) {
      listenersRef.current.set(topic, new Set());
    }
    listenersRef.current.get(topic)!.add(callback);

    // Return un-subscriber
    return () => {
      listenersRef.current.get(topic)?.delete(callback);
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ isConnected, latestAlert, subscribe }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
