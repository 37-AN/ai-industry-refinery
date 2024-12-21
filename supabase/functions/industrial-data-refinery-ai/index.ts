import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { HfInference } from 'https://esm.sh/@huggingface/inference@2.3.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawDataPoint {
  timestamp: string;
  value: number;
  metric_type: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rawData } = await req.json();
    console.log('Processing raw industrial data:', rawData);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Format data for analysis
    const dataPoints = rawData.metrics.map((metric: RawDataPoint) => 
      `${metric.metric_type}: ${metric.value} at ${metric.timestamp}`
    ).join('\n');

    const prompt = `Analyze and refine this industrial data:
${dataPoints}

Provide analysis focusing on:
1. Data quality assessment
2. Anomaly detection
3. Trend identification
4. Recommended adjustments
5. Quality scores for each metric

Format the response as a structured analysis.`;

    console.log('Sending request to HuggingFace...');
    
    const hf = new HfInference();
    const result = await hf.textGeneration({
      model: 'tiiuae/falcon-7b-instruct',
      inputs: prompt,
      parameters: {
        max_new_tokens: 500,
        temperature: 0.7,
        top_p: 0.95,
        return_full_text: false,
      },
    });

    console.log('Received HuggingFace response:', result);
    const analysis = result.generated_text;

    // Process and refine the data based on AI analysis
    const refinedMetrics = rawData.metrics.map((metric: RawDataPoint) => {
      // Extract quality score from analysis if mentioned, otherwise use default
      const qualityScore = analysis.toLowerCase().includes(metric.metric_type.toLowerCase()) ? 
        (analysis.toLowerCase().includes('high quality') ? 0.95 : 
         analysis.toLowerCase().includes('low quality') ? 0.6 : 0.8) : 
        0.85;

      return {
        device_id: rawData.deviceId,
        data_type: metric.metric_type,
        value: metric.value,
        quality_score: qualityScore,
        timestamp: metric.timestamp || new Date().toISOString(),
        metadata: {
          ...metric.metadata,
          refined: true,
          ai_analysis: true,
          refinement_timestamp: new Date().toISOString(),
          original_value: metric.value,
          analysis_excerpt: analysis.substring(0, 200) // Store first 200 chars of analysis
        }
      };
    });

    // Store refined data
    const { error: storageError } = await supabase
      .from('refined_industrial_data')
      .insert(refinedMetrics);

    if (storageError) {
      console.error('Error storing refined data:', storageError);
      throw storageError;
    }

    // Store the analysis as an insight
    const { error: insightError } = await supabase
      .from('ai_insights')
      .insert({
        device_id: rawData.deviceId,
        insight_type: 'data_refinement',
        message: analysis,
        confidence: 0.85,
        severity: analysis.toLowerCase().includes('critical') ? 'critical' : 
                 analysis.toLowerCase().includes('warning') ? 'warning' : 'info',
        metadata: {
          metrics_processed: refinedMetrics.length,
          average_quality_score: refinedMetrics.reduce((acc, m) => acc + m.quality_score, 0) / refinedMetrics.length,
          model: 'falcon-7b-instruct'
        }
      });

    if (insightError) {
      console.error('Error storing insight:', insightError);
      // Don't throw here as the main refinement was successful
    }

    return new Response(
      JSON.stringify({
        success: true,
        refinedMetrics,
        analysis,
        message: 'Data successfully refined and analyzed'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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