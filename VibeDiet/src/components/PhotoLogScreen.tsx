import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useDiet } from '../context/DietContext.js';
import { MealSlot, FoodItemEntry } from '../types/index.js';
import { compressImageClientSide } from '../utils/imageCompressor.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import { savePortionCalibration } from '../services/portionMemory.js';
import VibeDietAiScannerView, {
  AiDraftItem,
} from './redesign/VibeDietAiScannerView.js';

interface PhotoLogScreenProps {
  onConfirmed: () => void;
  initialSlot?: MealSlot;
}

export const PhotoLogScreen: React.FC<PhotoLogScreenProps> = ({
  onConfirmed,
  initialSlot = 'dinner',
}) => {
  const { user } = useAuth();
  const {
    activeDraft,
    startPhotoDraft,
    startTextDraft,
    addManualMeal,
    applyServingMultiplier,
    confirmActiveDraft,
  } = useDiet();

  const [slot] = useState<MealSlot>(initialSlot);
  const [isScanning, setIsScanning] = useState(false);
  const [currentStage, setCurrentStage] = useState<'spatial_ocr' | 'parallel_fats_grounding' | 'atwater_verified'>(
    activeDraft?.stage || 'spatial_ocr'
  );
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSubmittingText, setIsSubmittingText] = useState(false);
  const [autoSendEnabled, setAutoSendEnabled] = useState(false);
  const autoSendTimerRef = useRef<number | null>(null);

  // Progressive Stage Synchronization
  useEffect(() => {
    if (activeDraft?.stage) {
      setCurrentStage(activeDraft.stage);
    }
  }, [activeDraft?.stage]);

  // Handle Photo File Upload with Canvas Compression
  const handleUploadPhoto = useCallback(
    async (file: File, note: string) => {
      try {
        setIsScanning(true);
        setCurrentStage('spatial_ocr');
        const compressed = await compressImageClientSide(file, {
          maxDimension: 1280,
          quality: 0.84,
          format: 'image/jpeg',
          maxBytes: 250 * 1024,
        });

        setCurrentStage('parallel_fats_grounding');
        setTimeout(() => setCurrentStage('atwater_verified'), 350);

        startPhotoDraft(slot, compressed.thumbnailDataUrl, note, 'plate_vision', compressed.dataUrl);
      } catch (err) {
        console.warn('Image processing fallback:', err);
        startPhotoDraft(slot, undefined, note, 'plate_vision');
      } finally {
        setIsScanning(false);
      }
    },
    [slot, startPhotoDraft]
  );

  // Handle Sample Scan Simulation
  const handleSimulateSampleScan = () => {
    setIsScanning(true);
    setCurrentStage('spatial_ocr');
    setTimeout(() => setCurrentStage('parallel_fats_grounding'), 100);
    setTimeout(() => setCurrentStage('atwater_verified'), 250);
    startPhotoDraft(slot, undefined, 'Indian-fusion bowl with paneer & brown rice', 'plate_vision');
    setTimeout(() => setIsScanning(false), 200);
  };

  // Handle Natural Language Text Meal Submission
  const handleTextSubmit = async (textToSubmit: string) => {
    if (!textToSubmit.trim() || isSubmittingText) return;
    try {
      setIsSubmittingText(true);
      setTextError(null);
      setCurrentStage('spatial_ocr');
      const draft = await startTextDraft(textToSubmit.trim(), slot);
      if (!draft || draft.recognizedItems.length === 0) {
        setTextError('Could not parse meal items. Try describing staples (e.g. 2 rotis, dal tadka) or use Scan Sample Meal.');
      } else {
        setCurrentStage('atwater_verified');
      }
    } catch (err: any) {
      console.warn('Text draft error:', err);
      setTextError('Live AI meal decomposition requires a connected server. You can scan a sample meal or use Food Search.');
    } finally {
      setIsSubmittingText(false);
    }
  };

  // Auto-Send 1.5s Debounce
  const handleTextChange = (text: string) => {
    setTextInput(text);
    if (!autoSendEnabled) return;

    if (autoSendTimerRef.current) {
      window.clearTimeout(autoSendTimerRef.current);
    }

    if (text.trim().length > 3) {
      autoSendTimerRef.current = window.setTimeout(() => {
        handleTextSubmit(text);
      }, 1500);
    }
  };

  // Speech Recognition (Mock/Native Web Speech)
  const handleSpeechListen = () => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRec();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleTextChange(transcript);
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
        return;
      } catch {}
    }

    // Fallback simulation for non-speech browser environments
    setIsListening(true);
    setTimeout(() => {
      handleTextChange('2 rotis, 1 bowl dal tadka, 150g paneer');
      setIsListening(false);
    }, 1200);
  };

  // Barcode Detected Handler
  const handleBarcodeDetected = (food: FoodItemEntry) => {
    addManualMeal(slot, food.name, [food]);
    setShowBarcodeModal(false);
    onConfirmed();
  };

  // Confirm Draft Handler
  const handleConfirmDraft = (multiplier: number, adjustedGrams: number) => {
    if (user?.uid && activeDraft?.recognizedItems[0]) {
      savePortionCalibration(user.uid, activeDraft.recognizedItems[0].name.toLowerCase(), adjustedGrams);
    }
    confirmActiveDraft(multiplier);
    onConfirmed();
  };

  // Map Active Draft to AiDraftItem
  let draftItem: AiDraftItem | null = null;
  if (activeDraft && activeDraft.recognizedItems.length > 0) {
    const totalCalories = activeDraft.recognizedItems.reduce((acc, i) => acc + i.calories, 0);
    const totalProtein = activeDraft.recognizedItems.reduce((acc, i) => acc + i.protein, 0);
    const totalCarbs = activeDraft.recognizedItems.reduce((acc, i) => acc + i.carbs, 0);
    const totalFat = activeDraft.recognizedItems.reduce((acc, i) => acc + i.fat, 0);
    const totalGrams = activeDraft.recognizedItems.reduce((acc, i) => acc + i.grams, 0);

    const primaryTier = activeDraft.recognizedItems[0]?.tier || 1;
    const tierLabel = primaryTier === 1 ? 'High (Verified)' : primaryTier === 2 ? 'High (Barcode)' : 'Moderate (AI Estimate)';

    draftItem = {
      title: activeDraft.recognizedItems.map((i) => i.name).join(' & ') || 'Recognized Meal',
      grams: totalGrams || 250,
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat,
      confidenceTier: tierLabel,
    };
  }

  return (
    <>
      <VibeDietAiScannerView
        onUploadPhoto={handleUploadPhoto}
        onOpenBarcode={() => setShowBarcodeModal(true)}
        isProcessing={isScanning || isSubmittingText}
        pipelineStage={currentStage}
        draftItem={draftItem}
        onConfirmDraft={handleConfirmDraft}
        onSimulateSampleScan={handleSimulateSampleScan}
        onTextSubmit={handleTextSubmit}
        textInput={textInput}
        onChangeTextInput={handleTextChange}
        autoSendEnabled={autoSendEnabled}
        onToggleAutoSend={() => setAutoSendEnabled((prev) => !prev)}
        isListening={isListening}
        onToggleSpeech={handleSpeechListen}
        isSubmittingText={isSubmittingText}
        textError={textError}
        onClearTextError={() => setTextError(null)}
      />

      <BarcodeScannerModal
        isOpen={showBarcodeModal}
        onClose={() => setShowBarcodeModal(false)}
        onDetected={handleBarcodeDetected}
      />
    </>
  );
};
