import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { io } from "socket.io-client";

export const socketContext = createContext<ReturnType<typeof io> | null>(null);

export function useSocket() {
  return useContext(socketContext);
}

export function SocketProvider(props: { children: ReactNode }) {
  const { children } = props;
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);

  useEffect(() => {
    const socket = io();
    setSocket(socket);
    return () => {
      setSocket(null);
      socket.close();
    };
  }, []);

  return (
    <socketContext.Provider value={socket}>{children}</socketContext.Provider>
  );
}
