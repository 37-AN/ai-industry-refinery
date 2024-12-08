import { SimulationControl } from "@/components/SimulationControl";
import { MetricsSection } from "@/components/MetricsSection";
import { ArduinoPLCDataGrid } from "@/components/ArduinoPLCDataGrid";
import { AIInsights } from "@/components/AIInsights";
import { AdvancedAIInsights } from "@/components/ai/AdvancedAIInsights";
import { DataAnalyzer } from "@/components/analysis/DataAnalyzer";
import { generatePerformanceData, generateResourceData } from "@/utils/sampleDataGenerator";

interface SimulationDashboardProps {
  deviceId: string;
  simulatedData: Record<string, number>;
}

export function SimulationDashboard({ deviceId, simulatedData }: SimulationDashboardProps) {
  return (
    <div className="grid grid-cols-1 gap-8">
      <SimulationControl />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AIInsights deviceId={deviceId} />
        <AdvancedAIInsights deviceId={deviceId} metrics={simulatedData} />
      </div>
      
      <MetricsSection 
        refinedPerformance={generatePerformanceData()}
        refinedResources={generateResourceData()}
      />

      <ArduinoPLCDataGrid />

      <DataAnalyzer
        selectedDeviceId={deviceId}
        simulatedData={simulatedData}
      />
    </div>
  );
}