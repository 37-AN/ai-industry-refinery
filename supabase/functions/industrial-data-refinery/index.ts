import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Received request to industrial-data-refinery');
    
    const requestData = await req.json();
    console.log('Request data:', JSON.stringify(requestData, null, 2));

    // Validate request structure
    if (!requestData?.rawData) {
      console.error('No raw data provided in request');
      return new Response(
        JSON.stringify({
          error: 'No raw data provided',
          details: 'rawData object is required'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { rawData } = requestData;

    // Validate required fields
    if (!rawData.deviceId || !rawData.metrics || !Array.isArray(rawData.metrics)) {
      console.error('Invalid data structure:', { deviceId: rawData.deviceId, metrics: rawData.metrics });
      return new Response(
        JSON.stringify({
          error: 'Invalid data structure',
          details: 'deviceId and metrics array are required'
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Processing metrics:', rawData.metrics.length);

    // Process metrics in smaller batches to prevent timeouts
    const BATCH_SIZE = 10;
    const refinedMetrics = [];

    for (let i = 0; i < rawData.metrics.length; i += BATCH_SIZE) {
      const batch = rawData.metrics.slice(i, i + BATCH_SIZE);
      const refinedBatch = batch.map((metric: any) => {
        if (!metric.metric_type || typeof metric.value === 'undefined') {
          console.warn('Invalid metric structure:', metric);
          return null;
        }

        // Normalize and validate the value
        const refinedValue = normalizeValue(metric.value, metric.metric_type);
        
        // Calculate quality score based on data characteristics
        const qualityScore = calculateQualityScore(metric);

        return {
          device_id: rawData.deviceId,
          data_type: metric.metric_type,
          value: refinedValue,
          quality_score: qualityScore,
          timestamp: new Date().toISOString(),
          metadata: {
            ...metric.metadata,
            refined: true,
            original_value: metric.value,
            refinement_timestamp: new Date().toISOString(),
            unit: metric.unit || getDefaultUnit(metric.metric_type)
          }
        };
      }).filter(Boolean);

      refinedMetrics.push(...refinedBatch);
    }

    console.log('Refined metrics:', refinedMetrics.length);

    // Store refined data efficiently using a single batch insert
    if (refinedMetrics.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('refined_industrial_data')
        .insert(refinedMetrics);

      if (insertError) {
        console.error('Error storing refined data:', insertError);
        throw insertError;
      }
    }

    console.log('Successfully processed and stored data');

    return new Response(
      JSON.stringify({
        success: true,
        refinedMetrics,
        message: 'Data successfully refined and stored'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in data refinement:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: 'Error occurred during data refinement process'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Utility function to normalize values based on metric type
function normalizeValue(value: number, metricType: string): number {
  const thresholds: Record<string, { min: number; max: number }> = {
    temperature: { min: -20, max: 120 },
    pressure: { min: 0, max: 1000 },
    vibration: { min: 0, max: 100 },
    production_rate: { min: 0, max: 1000 },
    downtime_minutes: { min: 0, max: 1440 },
    defect_rate: { min: 0, max: 100 },
    energy_consumption: { min: 0, max: 10000 },
    machine_efficiency: { min: 0, max: 100 }
  };

  const range = thresholds[metricType] || { min: -Infinity, max: Infinity };
  return Math.max(range.min, Math.min(range.max, value));
}

// Utility function to calculate data quality score
function calculateQualityScore(metric: any): number {
  let score = 1.0;

  // Check for missing metadata
  if (!metric.metadata) score -= 0.1;

  // Check for value within expected ranges
  const normalizedValue = normalizeValue(metric.value, metric.metric_type);
  if (normalizedValue !== metric.value) score -= 0.2;

  // Check for timestamp freshness
  if (metric.timestamp) {
    const age = Date.now() - new Date(metric.timestamp).getTime();
    if (age > 60000) score -= 0.1; // Penalize data older than 1 minute
  } else {
    score -= 0.1;
  }

  return Math.max(0, Math.min(1, score));
}

// Utility function to get default unit based on metric type
function getDefaultUnit(metricType: string): string {
  const unitMap: Record<string, string> = {
    temperature: '°C',
    pressure: 'bar',
    vibration: 'mm/s',
    production_rate: 'units/hr',
    downtime_minutes: 'min',
    defect_rate: '%',
    energy_consumption: 'kWh',
    machine_efficiency: '%'
  };
  return unitMap[metricType] || 'unit';
}