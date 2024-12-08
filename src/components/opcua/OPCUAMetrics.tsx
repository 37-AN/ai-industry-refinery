import { Card } from "@/components/ui/card";
import { MetricsChart } from "@/components/MetricsChart";
import { ModbusRegisterData } from "@/types/modbus";

interface OPCUAMetricsProps {
  simulatedData: Record<string, number>;
}

export function OPCUAMetrics({ simulatedData }: OPCUAMetricsProps) {
  // Convert simulated data to chart format
  const chartData: ModbusRegisterData[] = Object.entries(simulatedData).map(([key, value]) => ({
    timestamp: new Date().toLocaleTimeString(),
    value,
    registerType: 'input',
    address: 1
  }));

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-semibold">OPC UA Metrics</h2>
      <div className="grid grid-cols-1 gap-8">
        {Object.entries(simulatedData).map(([key, value]) => (
          <Card key={key} className="p-6">
            <div className="mb-2">
              <h3 className="text-lg font-semibold capitalize">{key}</h3>
              <p className="text-2xl font-bold">{typeof value === 'number' ? value.toFixed(2) : 'N/A'}</p>
            </div>
            <div className="h-[300px]">
              <MetricsChart
                title={`${key} History`}
                data={chartData}
                registerType="input"
                className="h-full transition-transform hover:scale-[1.01]"
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}