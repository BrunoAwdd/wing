import { useState, useEffect } from "react";
import { persistenceService } from "../../services/persistenceService";

export const useAgents = () => {
  const [agents, setAgents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    setIsLoading(true);
    // 1. Load from Cache (Fast) - Only on initial load or if we want to be very safe
    // const cachedAgents = await persistenceService.loadAgents();
    // if (cachedAgents) setAgents(cachedAgents);

    // 2. Fetch from Network (Background Update)
    try {
      const response = await fetch("/api/extensions/agent");
      if (response.ok) {
        const remoteAgents = await response.json();
        setAgents(remoteAgents);
        await persistenceService.saveAgents(remoteAgents);
      } else {
        console.error("Failed to fetch agents:", response.statusText);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load: try cache first for speed
    const initialLoad = async () => {
      const cachedAgents = await persistenceService.loadAgents();
      if (cachedAgents) {
        setAgents(cachedAgents);
        setIsLoading(false);
      }
      load(); // Then fetch fresh
    };
    initialLoad();
  }, []);

  return { agents, isLoading, refreshAgents: load };
};
