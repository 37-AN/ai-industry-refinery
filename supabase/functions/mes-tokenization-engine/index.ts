import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { refinedData } = await req.json();
    console.log('Received data in MES engine:', refinedData);

    if (!refinedData?.deviceId || typeof refinedData.deviceId !== 'string') {
      console.error('Invalid or missing deviceId:', refinedData);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or missing deviceId' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (!Array.isArray(refinedData.metrics)) {
      console.error('Invalid metrics format:', refinedData.metrics);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid metrics format' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Store metrics
    const mesMetricsPromises = refinedData.metrics.map(metric => {
      const metricData = {
        device_id: refinedData.deviceId,
        metric_type: metric.metric_type,
        value: metric.value,
        unit: metric.unit || 'unit',
        timestamp: metric.timestamp || new Date().toISOString(),
        metadata: {
          quality_score: metric.metadata?.quality_score || 0.95,
          source: refinedData.metadata?.source || 'mes_engine',
          source_device_id: refinedData.deviceId
        }
      };

      console.log('Storing MES metric:', metricData);
      return supabaseClient.from('mes_metrics').insert(metricData);
    });

    await Promise.all(mesMetricsPromises);

    // Create tokenized asset
    const assetData = {
      asset_type: 'industrial_metric',
      name: `Device ${refinedData.deviceId} Metrics`,
      token_symbol: 'MES',
      total_supply: 1000000,
      price_per_token: 0.001,
      metadata: {
        source_device_id: refinedData.deviceId,
        last_update: new Date().toISOString(),
        quality_score: refinedData.metadata?.quality_score || 0.95
      }
    };

    console.log('Creating tokenized asset:', assetData);
    const { error: assetError } = await supabaseClient
      .from('tokenized_assets')
      .upsert(assetData);

    if (assetError) {
      console.error('Error creating tokenized asset:', assetError);
      throw assetError;
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Data processed successfully',
        metrics_count: refinedData.metrics.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in MES processing:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});