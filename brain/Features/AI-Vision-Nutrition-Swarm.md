# 📸 AI Vision Nutrition Swarm

#ai-model #feature

Linked: [[00-Home]] | [[Architecture]] | [[Gemini-Recognition-Swarm]] | [[Key-Pool-Router]] | [[AI-Meal-Scan]] | [[Atwater-Verifier]]

## Overview
The AI Vision Nutrition Swarm automates food logging from camera captures and photo uploads using multimodal Gemini models (`gemini-2.5-flash` primary, `gemini-2.5-pro` fallback).

## Workflow Pipeline
1. **Client Pre-Processing (`src/utils/imageCompressor.ts`):** Downscales images via HTML canvas to under 500KB JPEG to stay within mobile network budgets and prevent memory spikes.
2. **Key Pool Routing (`src/services/keyPoolRouter.ts`):** Distributes inference requests across a pool of API keys using round-robin rotation, automatic cooldown on HTTP 429/503, and exponential backoff.
3. **Progressive Analysis Stages:**
   - `plate_detected`: Identifies distinct food components and boundaries.
   - `volumetric_depth`: Estimates serving mass in grams using geometric heuristics and portion memory calibrations.
   - `usda_mapped`: Matches items against USDA FoodData Central and IFCT nutrient profiles.
   - `atwater_verified`: Recalculates total energy using the 4-9-4 factor equation and establishes confidence bounds.
4. **Interactive Review (`src/components/DraftReviewModal.tsx`):** Users can adjust gram weights, answer clarifying questions (e.g., cooking oil type, milk fat percentage), and scale serving multipliers before confirming into their meal log.
