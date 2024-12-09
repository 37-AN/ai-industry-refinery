import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { IndustrialSimulationEngine } from "@/utils/industrial/simulationEngine";
import { ChartData, RegisterWriteHistoryEntry } from "@/types/simulation";

export const useSimulationData = (
  isRunning: boolean,
  deviceId: string | null,
  simulationEngine?: IndustrialSimulationEngine
) => {
  const [writeHistory, setWriteHistory] = useState<RegisterWriteHistoryEntry[]>([]);
  const [chartData, setChartData] = useState<ChartData>({});

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
            unit: 'unit',
            metadata: {
              quality_score: 0.95,
              source: 'simulation_engine'
            }
          }));

          // Update chart data
          const newChartData: ChartData = {};
          Object.entries(values).forEach(([key, value]) => {
            const timestamp = new Date().toISOString();
            if (!newChartData[key]) {
              newChartData[key] = [];
            }
            newChartData[key].push({
              timestamp,
              value: typeof value === 'number' ? value : 0,
              registerType: 'input',
              address: 0
            });
          });
          setChartData(prev => ({
            ...prev,
            ...newChartData
          }));

          // Send to data refinery
          console.log('Sending metrics to refinery:', { deviceId, metricsArray });
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

          // Update history with register-style entries
          setWriteHistory(prev => [
            {
              timestamp: new Date().toISOString(),
              address: 0,
              value: Object.values(values)[0] as number
            },
            ...prev
          ].slice(0, 50));

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

  return { writeHistory, chartData };
};