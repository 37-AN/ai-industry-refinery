import { useState, useEffect } from 'react';
import { pipeline } from "@huggingface/transformers";
import { toast } from 'sonner';

export const useFeatureExtractor = () => {
  const [featureExtractor, setFeatureExtractor] = useState<any>(null);

  useEffect(() => {
    const initializeAI = async () => {
      try {
        console.log('Starting AI model initialization...');
        
        const extractor = await pipeline(
          "feature-extraction",
          "Xenova/all-MiniLM-L6-v2"
        );
        
        if (!extractor) {
          console.error('Feature extractor initialization failed');
          throw new Error('Failed to initialize feature extractor');
        }

        console.log('Feature extractor created successfully');

        // Test the model with a simple string
        const testInput = "Test initialization string";
        console.log('Testing model with input:', testInput);

        // Validate test input
        if (!testInput || typeof testInput !== 'string') {
          throw new Error('Invalid test input type');
        }

        const trimmedInput = testInput.trim();
        if (!trimmedInput) {
          throw new Error('Empty test input after trimming');
        }

        const testFeatures = await extractor(trimmedInput, {
          pooling: "mean",
          normalize: true
        });

        if (!testFeatures) {
          console.error('Test feature extraction failed');
          throw new Error('Model test failed - no features returned');
        }

        const featuresList = testFeatures.tolist();
        console.log('Model test successful, features dimensions:', 
          Array.isArray(featuresList) ? featuresList.length : 'unknown');
        
        setFeatureExtractor(extractor);
        console.log('AI model initialization completed successfully');
        toast.success('AI models loaded successfully');
      } catch (error) {
        console.error('Error in AI initialization:', error);
        toast.error('Failed to load AI models');
      }
    };

    initializeAI();
  }, []);

  return featureExtractor;
};