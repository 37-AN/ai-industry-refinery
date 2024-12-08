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
          "Xenova/all-MiniLM-L6-v2",
          {
            revision: "main"
          }
        );
        
        if (!extractor) {
          console.error('Feature extractor initialization failed');
          throw new Error('Failed to initialize feature extractor');
        }

        console.log('Feature extractor created successfully');

        // Test the model with a simple string
        const testInput = "Hello world";
        console.log('Testing model with input:', testInput);

        if (!testInput || typeof testInput !== 'string') {
          console.error('Invalid test input:', testInput);
          throw new Error('Invalid test input format');
        }

        const testFeatures = await extractor(testInput, {
          pooling: "mean",
          normalize: true
        });

        if (!testFeatures) {
          console.error('Test feature extraction failed');
          throw new Error('Model test failed - no features returned');
        }

        console.log('Model test successful:', testFeatures !== null);
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