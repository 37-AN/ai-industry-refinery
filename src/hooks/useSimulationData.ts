import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IndustrialSimulationEngine } from "@/utils/industrial/simulationEngine";
import { RegisterWriteHistoryEntry } from "@/types/simulation";

export const useSimulationData = (
  isRunning: boolean,
  deviceId: string | null,
  simulationEngine?: IndustrialSimulationEngine
) => {
  const [writeHistory, setWriteHistory] = useState<RegisterWriteHistoryEntry[]>([]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && deviceId && simulationEngine) {
      interval = setInterval(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            console.error('No active session');
            toast.error('Please log in to run simulation');
            return;
          }

          const values = simulationEngine.generateNextValues();
          console.log('Generated simulation values:', values);

          // Format metrics array
          const metricsArray = Object.entries(values).map(([key, value]) => ({
            metric_type: key,
            value: typeof value === 'number' ? value : 0,
            timestamp: new Date().toISOString(),
            unit: key === 'temperature' ? '°C' :
                  key === 'pressure' ? 'bar' :
                  key === 'vibration' ? 'mm/s' :
                  key === 'production_rate' ? 'units/hr' :
                  key === 'downtime_minutes' ? 'min' :
                  key === 'defect_rate' ? '%' :
                  key === 'energy_consumption' ? 'kWh' :
                  key === 'machine_efficiency' ? '%' : 'unit',
            metadata: {
              quality_score: 0.95,
              source: 'simulation_engine'
            }
          }));

          // Send to data refinery
          console.log('Sending data to refinery:', { deviceId, metricsArray });
          const { data: refinedData, error: refineryError } = await supabase.functions.invoke(
            'industrial-data-refinery',
            {
              body: { 
                rawData: {
                  deviceId,
                  dataType: 'simulation',
                  metrics: metricsArray,
                  timestamp: new Date().toISOString(),
                  metadata: {
                    simulation: true,
                    source: 'simulation_engine',
                    quality_score: 0.95,
                    owner_id: session.user.id
                  }
                }
              }
            }
          );

          if (refineryError) throw refineryError;
          console.log('Received refined data:', refinedData);

          // Update history with new entries
          const timestamp = new Date().toISOString();
          const newEntries: RegisterWriteHistoryEntry[] = Object.entries(values).map(([key, value], index) => ({
            timestamp,
            address: index,
            value: typeof value === 'number' ? value : 0
          }));

          setWriteHistory(prev => [...newEntries, ...prev].slice(0, 50));

          // Send refined data to MES engine with proper structure
          const { error: mesError } = await supabase.functions.invoke(
            'mes-tokenization-engine',
            {
              body: {
                refinedData: {
                  deviceId,
                  metrics: metricsArray, // Ensure we're sending an array of metrics
                  timestamp: new Date().toISOString(),
                  metadata: {
                    simulation: true,
                    source: 'simulation_engine',
                    quality_score: 0.95,
                    owner_id: session.user.id
                  }
                }
              }
            }
          );

          if (mesError) {
            console.error('Error sending data to MES engine:', mesError);
            toast.error('Failed to process in MES engine');
            return;
          }

          console.log('Successfully processed simulation data');
        } catch (error) {
          console.error('Error in simulation pipeline:', error);
          toast.error('Failed to process simulation data');
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, deviceId, simulationEngine]);

  return { writeHistory };
};