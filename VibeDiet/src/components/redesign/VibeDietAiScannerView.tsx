import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { AnimatePresence, motion } from "motion/react";
import "./VibeDietTheme.css";

export interface AiDraftItem {
  title: string;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidenceTier: string;
}

export interface VibeDietAiScannerViewProps {
  onUploadPhoto: (file: File, note: string) => void;
  onOpenBarcode: () => void;
  isProcessing: boolean;
  pipelineStage?: string;
  draftItem?: AiDraftItem | null;
  onConfirmDraft: (multiplier: number, adjustedGrams: number) => void;
  // Extended interactive actions for multimodal dictation & sample scan
  onSimulateSampleScan?: () => void;
  onTextSubmit?: (text: string) => void;
  textInput?: string;
  onChangeTextInput?: (text: string) => void;
  autoSendEnabled?: boolean;
  onToggleAutoSend?: () => void;
  isListening?: boolean;
  onToggleSpeech?: () => void;
  isSubmittingText?: boolean;
  textError?: string | null;
  onClearTextError?: () => void;
}

const multipliers = [0.5, 1, 1.5, 2] as const;
const stages = ["Capture", "AI Vision", "Nutrition"] as const;

const whole = (value: number) => Math.round(value).toLocaleString("en-US");
const decimal = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

function getStageIndex(stage?: string): number {
  const value = stage?.toLowerCase() ?? "";
  if (/nutrition|macro|final|verif|complete|result|atwater/.test(value)) return 2;
  if (/analy|vision|detect|identify|classif|recogn|spatial|grounding/.test(value)) return 1;
  return 0;
}

function CameraIllustration() {
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" fill="none" aria-hidden="true">
      <rect x="8" y="17" width="48" height="36" rx="13" fill="#FFF" stroke="#BAE6FD" strokeWidth="2" />
      <path d="m22 17 3.2-5h13.6l3.2 5" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="32" cy="35" r="10" fill="#EFF6FF" stroke="#38BDF8" strokeWidth="2.4" />
      <circle cx="32" cy="35" r="5" fill="#0EA5E9" />
      <circle cx="47" cy="25" r="2" fill="#FF9248" />
      <path d="M51 8v8M47 12h8" stroke="#FF6B2C" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden="true">
      <path d="m3.5 8.2 2.7 2.7 6.3-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface PipelineProps {
  isProcessing: boolean;
  pipelineStage?: string;
  hasDraft: boolean;
  hasInput?: boolean;
}

function PipelineIndicator({ isProcessing, pipelineStage, hasDraft, hasInput }: PipelineProps) {
  let activeStage = 0;
  if (hasDraft) {
    activeStage = 2;
  } else if (isProcessing || (hasInput && pipelineStage)) {
    activeStage = getStageIndex(pipelineStage);
  }
  const finished = !isProcessing && hasDraft;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -5, scale: 0.98 }}
      className="rounded-[18px] border border-[rgba(14,165,233,0.16)] bg-[rgba(14,165,233,0.055)] p-3.5"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center">
        {stages.map((stage, index) => {
          const complete = finished || index < activeStage;
          const active = !finished && index === activeStage;

          return (
            <div key={stage} className={`flex items-center ${index < stages.length - 1 ? "flex-1" : ""}`}>
              <div className="flex flex-col items-center gap-1.5">
                <motion.span
                  animate={{
                    scale: active ? [1, 1.08, 1] : 1,
                    backgroundColor:
                      complete || active ? "#0EA5E9" : "var(--active)",
                  }}
                  className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white shadow-sm"
                >
                  {complete ? <CheckIcon /> : index + 1}
                </motion.span>
                <span
                  className={`text-[9px] font-semibold tracking-[-0.01em] ${
                    active
                      ? "text-[#0284C7] dark:text-[#38BDF8]"
                      : complete
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-tertiary)]"
                  }`}
                >
                  {stage}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div
                  className={`mx-2 h-0.5 flex-1 rounded-full transition-colors ${
                    complete ? "bg-[#0EA5E9]" : "bg-[var(--border-strong)]"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default function VibeDietAiScannerView({
  onUploadPhoto,
  onOpenBarcode,
  isProcessing,
  pipelineStage,
  draftItem,
  onConfirmDraft,
  onSimulateSampleScan,
  onTextSubmit,
  textInput: controlledTextInput,
  onChangeTextInput,
  autoSendEnabled = false,
  onToggleAutoSend,
  isListening = false,
  onToggleSpeech,
  isSubmittingText = false,
  textError,
  onClearTextError,
}: VibeDietAiScannerViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState<number>(1);
  const [localTextInput, setLocalTextInput] = useState("");

  const currentTextInput = controlledTextInput !== undefined ? controlledTextInput : localTextInput;
  const setInputVal = (val: string) => {
    if (onChangeTextInput) onChangeTextInput(val);
    else setLocalTextInput(val);
  };

  const acceptFile = useCallback((incomingFile?: File) => {
    if (!incomingFile) return;

    if (!incomingFile.type.startsWith("image/")) {
      setError("Please choose an image file such as JPG, PNG, or WEBP.");
      return;
    }

    setError(null);
    setFile(incomingFile);
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const pastedFile = Array.from(event.clipboardData?.files ?? []).find((item) =>
        item.type.startsWith("image/"),
      );

      if (pastedFile) {
        event.preventDefault();
        acceptFile(pastedFile);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [acceptFile]);

  useEffect(() => {
    setMultiplier(1);
  }, [draftItem?.title, draftItem?.grams, draftItem?.calories]);

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  };

  const analyze = () => {
    if (!file || isProcessing) return;
    onUploadPhoto(file, note.trim());
  };

  const handleFormTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onTextSubmit && currentTextInput.trim()) {
      onTextSubmit(currentTextInput.trim());
    }
  };

  const adjustedGrams = draftItem
    ? Math.round(draftItem.grams * multiplier * 10) / 10
    : 0;

  const confidence = draftItem?.confidenceTier.toLowerCase() ?? "";
  const confidenceClass = confidence.includes("high") || confidence.includes("tier 1") || confidence.includes("tier 2")
    ? "border-[rgba(16,185,129,0.18)] bg-[rgba(16,185,129,0.1)] text-[var(--emerald-text)]"
    : confidence.includes("low") || confidence.includes("tier 4")
      ? "border-[rgba(244,63,94,0.16)] bg-[rgba(244,63,94,0.08)] text-[#F43F5E]"
      : "border-[rgba(245,158,11,0.2)] bg-[rgba(245,158,11,0.1)] text-[#B45309]";

  return (
    <div className="vibediet-canvas px-4 py-6 pb-36 sm:px-6 sm:py-8 lg:px-8 select-none" data-testid="photo-log-screen">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 230, damping: 26 }}
        className="apple-card mx-auto max-w-[1240px] p-5 sm:p-7 lg:p-8"
        aria-labelledby="ai-scanner-title"
      >
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgba(14,165,233,0.15)] bg-[rgba(14,165,233,0.08)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-[#0284C7]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#0EA5E9] shadow-[0_0_0_4px_rgba(14,165,233,0.1)]" />
              <span data-testid="demo-ai-mode-banner">AI Vision Nutrition Studio · Adaptive Precision</span>
            </div>
            <h1
              id="ai-scanner-title"
              className="text-2xl font-extrabold tracking-[-0.045em] text-[var(--text-primary)] sm:text-[32px]"
            >
              Your meal, understood in a snap.
            </h1>
            <p className="mt-2 max-w-xl text-xs leading-5 text-[var(--text-secondary)] sm:text-sm">
              Capture the whole plate, add a little kitchen context, and review every estimated value before logging.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onSimulateSampleScan && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={onSimulateSampleScan}
                data-testid="simulate-photo-scan-btn"
                className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[15px] bg-gradient-to-r from-[#FF6B2C] to-[#FF9248] px-4 text-xs font-bold text-white shadow-sm transition hover:brightness-105 cursor-pointer"
              >
                <span>⚡</span>
                <span>Scan Sample Meal</span>
              </motion.button>
            )}

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onOpenBarcode}
              data-testid="scan-barcode-action-btn"
              className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-[15px] border border-[var(--border-strong)] bg-[var(--card-subtle)] px-4 text-xs font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--hover)] cursor-pointer"
            >
              <span className="text-base" aria-hidden="true">🏷️</span>
              Scan Barcode
            </motion.button>
          </div>
        </div>

        {/* Smart Meal Parser Bar with Auto-Send Chip */}
        <form onSubmit={handleFormTextSubmit} data-testid="describe-meal-form" className="mb-6 rounded-[20px] border border-[var(--border)] bg-[var(--card-subtle)] p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="dictate-meal-input" className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <span>🎙️</span>
              <span>Smart Meal Parser</span>
            </label>
            {onToggleAutoSend && (
              <button
                type="button"
                onClick={onToggleAutoSend}
                data-testid="toggle-auto-send"
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition flex items-center gap-1 cursor-pointer ${
                  autoSendEnabled
                    ? "bg-[#38BDF8]/20 text-[#0284c7] dark:text-[#38BDF8] border-[#38BDF8] shadow-xs"
                    : "bg-[var(--card)] text-[var(--text-secondary)] border-[var(--border)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>⚡ Auto-Send (1.5s Pause)</span>
                {autoSendEnabled && <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              id="dictate-meal-input"
              type="text"
              value={currentTextInput}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Describe meal in English or Hinglish (e.g. 2 rotis, 1 bowl dal tadka, 150g paneer)..."
              data-testid="dictate-meal-input"
              className="satin-input flex-1 rounded-[14px] px-3.5 py-2 text-xs"
            />
            {onToggleSpeech && (
              <button
                type="button"
                onClick={onToggleSpeech}
                data-testid="dictate-speech-btn"
                title="Voice Dictation"
                className={`px-3 py-2 rounded-[14px] text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${
                  isListening
                    ? "bg-rose-500/20 text-[#F43F5E] border-rose-500/40 animate-pulse"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span>{isListening ? "🔴 Recording" : "🎤 Mic"}</span>
              </button>
            )}
            <button
              type="submit"
              disabled={isSubmittingText || !currentTextInput.trim()}
              data-testid="submit-text-meal-btn"
              className="px-4 py-2 rounded-[14px] bg-[#0EA5E9] hover:bg-[#0284c7] disabled:opacity-50 text-white font-extrabold text-xs transition cursor-pointer shadow-xs"
            >
              {isSubmittingText ? "Parsing..." : "Parse Meal"}
            </button>
          </div>
          {textError && (
            <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5 font-medium">
                <span>⚠️</span>
                <span>{textError}</span>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {onSimulateSampleScan && (
                  <button
                    type="button"
                    onClick={onSimulateSampleScan}
                    className="font-bold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer"
                  >
                    Scan Sample
                  </button>
                )}
                {onClearTextError && (
                  <button
                    type="button"
                    onClick={onClearTextError}
                    aria-label="Dismiss message"
                    className="opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </form>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          <div className="min-w-0">
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
              className={`relative overflow-hidden rounded-[24px] border-2 border-dashed transition-all ${
                isDragging
                  ? "border-[#0EA5E9] bg-[rgba(14,165,233,0.09)] shadow-[0_0_0_5px_rgba(14,165,233,0.07)]"
                  : "border-[var(--border-strong)] bg-[var(--card-subtle)]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleInput}
                className="sr-only"
                aria-label="Choose a meal photo"
              />

              <AnimatePresence mode="wait" initial={false}>
                {previewUrl && file ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative"
                  >
                    <img
                      src={previewUrl}
                      alt="Selected meal preview"
                      className="h-[310px] w-full object-cover sm:h-[370px]"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent p-4 pt-16">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold text-white" title={file.name}>
                        {file.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="shrink-0 rounded-full border border-white/25 bg-white/15 px-3.5 py-2 text-[10px] font-bold text-white backdrop-blur-md transition-colors hover:bg-white/25 cursor-pointer"
                      >
                        Replace photo
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.button
                    key="empty"
                    type="button"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => inputRef.current?.click()}
                    className="flex min-h-[310px] w-full flex-col items-center justify-center px-6 py-10 text-center sm:min-h-[370px] cursor-pointer"
                  >
                    <motion.div
                      animate={isDragging ? { scale: 1.08, y: -3 } : { scale: 1, y: 0 }}
                      className="mb-4 grid h-24 w-24 place-items-center rounded-[28px] bg-gradient-to-br from-[rgba(14,165,233,0.1)] to-[rgba(255,107,44,0.08)]"
                    >
                      <CameraIllustration />
                    </motion.div>
                    <span className="text-base font-bold tracking-[-0.02em] text-[var(--text-primary)]">
                      {isDragging ? "Drop your meal here" : "Drop, browse, or paste a meal photo"}
                    </span>
                    <span className="mt-2 max-w-xs text-[11px] leading-5 text-[var(--text-secondary)]">
                      Use bright, natural light and keep the full plate in frame for the best estimate.
                    </span>
                    <span className="mt-5 rounded-full border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-[10px] font-bold text-[var(--text-primary)] shadow-sm">
                      Choose photo
                    </span>
                    <span className="numeric mt-3 text-[9px] text-[var(--text-tertiary)]">
                      JPG · PNG · WEBP · ⌘/CTRL + V
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div aria-live="polite">
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 rounded-xl bg-[rgba(244,63,94,0.08)] px-3 py-2.5 text-[11px] font-medium text-[#F43F5E]"
                >
                  {error}
                </motion.p>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["☀️", "Use daylight"],
                ["🍽️", "Show the plate"],
                ["🥄", "Add portions"],
              ].map(([icon, label]) => (
                <div key={label} className="apple-subcard flex flex-col items-center gap-1.5 px-2 py-3 text-center">
                  <span className="text-base" aria-hidden="true">{icon}</span>
                  <span className="text-[9px] font-semibold text-[var(--text-secondary)]">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <div>
              <label htmlFor="kitchen-context" className="mb-2 block text-xs font-bold text-[var(--text-primary)]">
                Kitchen context <span className="font-medium text-[var(--text-tertiary)]">(optional)</span>
              </label>
              <textarea
                id="kitchen-context"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Example: homemade chicken rice bowl, one ladle of rice, olive oil dressing"
                className="satin-input w-full resize-none rounded-[17px] px-4 py-3 text-xs leading-5"
              />
              <div className="mt-1.5 flex justify-between gap-3 text-[9px] text-[var(--text-tertiary)]">
                <span>Ingredients, cooking oils, and portion clues improve estimates.</span>
                <span className="numeric shrink-0">{note.length}/500</span>
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={file && !isProcessing ? { y: -1 } : undefined}
              whileTap={file && !isProcessing ? { scale: 0.985 } : undefined}
              onClick={analyze}
              disabled={!file || isProcessing}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-[16px] bg-gradient-to-r from-[#FF6B2C] to-[#FF9248] text-xs font-extrabold text-white shadow-[0_12px_26px_-10px_rgba(255,107,44,0.7)] transition-all disabled:from-slate-200 disabled:to-slate-200 dark:disabled:from-slate-800 dark:disabled:to-slate-800 disabled:text-slate-500 dark:disabled:text-zinc-500 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Analyzing your meal…
                </>
              ) : (
                <>
                  <span className="text-base" aria-hidden="true">📸</span>
                  Analyze meal photo
                </>
              )}
            </motion.button>

            <div className="mt-4">
              <AnimatePresence>
                {(isProcessing || pipelineStage) && (
                  <PipelineIndicator
                    isProcessing={isProcessing}
                    pipelineStage={pipelineStage}
                    hasDraft={Boolean(draftItem)}
                    hasInput={Boolean(file || previewUrl || isProcessing)}
                  />
                )}
              </AnimatePresence>
            </div>

            <div className="mt-5 flex-1 border-t border-[var(--border)] pt-5">
              <AnimatePresence mode="wait" initial={false}>
                {draftItem ? (
                  <motion.div
                    key={`${draftItem.title}-${draftItem.grams}-${draftItem.calories}`}
                    data-testid="draft-review-panel"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 27 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                          Review your draft
                        </p>
                        <h2 className="text-lg font-extrabold tracking-[-0.035em] text-[var(--text-primary)]">
                          {draftItem.title}
                        </h2>
                        <p className="numeric mt-1 text-[10px] text-[var(--text-secondary)]">
                          Estimated serving: {decimal(draftItem.grams)} g
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[9px] font-bold ${confidenceClass}`}>
                        {draftItem.confidenceTier} confidence
                      </span>
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold text-[var(--text-primary)]">Serving size</span>
                        <span className="numeric text-[10px] font-semibold text-[var(--tangerine-text)]">
                          {decimal(adjustedGrams)} g
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 rounded-[15px] bg-[var(--card-subtle)] p-1.5">
                        {multipliers.map((value) => {
                          const selected = multiplier === value;
                          return (
                            <motion.button
                              key={value}
                              type="button"
                              whileTap={{ scale: 0.94 }}
                              onClick={() => setMultiplier(value)}
                              aria-pressed={selected}
                              className={`relative h-8 rounded-[10px] text-[10px] font-bold cursor-pointer ${
                                selected
                                  ? "text-[var(--tangerine-text)]"
                                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                              }`}
                            >
                              {selected && (
                                <motion.span
                                  layoutId="serving-multiplier"
                                  className="absolute inset-0 rounded-[10px] border border-[rgba(255,107,44,0.15)] bg-[var(--card)] shadow-sm"
                                  transition={{ type: "spring", stiffness: 480, damping: 34 }}
                                />
                              )}
                              <span className="numeric relative z-10">{value}×</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-4 gap-2">
                      <div className="col-span-4 flex items-end justify-between rounded-[18px] bg-[rgba(255,107,44,0.08)] px-4 py-3.5 sm:col-span-1 sm:flex-col sm:items-start">
                        <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--tangerine-text)]">Energy</span>
                        <div className="text-right sm:mt-1 sm:text-left">
                          <span className="numeric text-2xl font-extrabold tracking-[-0.06em] text-[var(--text-primary)]">
                            {whole(draftItem.calories * multiplier)}
                          </span>
                          <span className="ml-1 text-[9px] font-medium text-[var(--text-secondary)]">kcal</span>
                        </div>
                      </div>

                      {([
                        ["Protein", draftItem.protein * multiplier, "#0EA5E9"],
                        ["Carbs", draftItem.carbs * multiplier, "#FF6B2C"],
                        ["Fat", draftItem.fat * multiplier, "#F43F5E"],
                      ] as const).map(([label, value, color]) => (
                        <div key={label} className="apple-subcard col-span-4 flex items-center justify-between px-4 py-3 sm:col-span-1 sm:block sm:px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-[9px] font-semibold text-[var(--text-secondary)]">{label}</span>
                          </div>
                          <p className="numeric text-sm font-bold text-[var(--text-primary)] sm:mt-2">
                            {decimal(value)}<span className="ml-0.5 text-[9px] font-medium text-[var(--text-tertiary)]">g</span>
                          </p>
                        </div>
                      ))}
                    </div>

                    <motion.button
                      type="button"
                      data-testid="confirm-draft-btn"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      disabled={isProcessing}
                      onClick={() => onConfirmDraft(multiplier, adjustedGrams)}
                      className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-[17px] bg-[#FF6B2C] py-4 text-sm font-extrabold text-white shadow-[0_14px_28px_-10px_rgba(255,107,44,0.75)] transition-colors hover:bg-[#ED5B1E] disabled:opacity-50 cursor-pointer"
                    >
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                        <path d="m4 10.5 3.5 3.5L16 5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Confirm &amp; Log
                    </motion.button>

                    <p className="mt-2.5 text-center text-[9px] leading-4 text-[var(--text-tertiary)]">
                      AI estimates can vary. Check the serving and ingredients before adding this meal.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="draft-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex min-h-[210px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[var(--border-strong)] px-6 py-8 text-center"
                  >
                    <div className="mb-3 grid h-12 w-12 place-items-center rounded-[16px] bg-[rgba(14,165,233,0.08)] text-xl">
                      ✨
                    </div>
                    <h2 className="text-xs font-bold text-[var(--text-primary)]">
                      Your editable nutrition draft appears here
                    </h2>
                    <p className="mt-2 max-w-xs text-[10px] leading-5 text-[var(--text-secondary)]">
                      We’ll identify the meal, estimate its serving, and calculate calories and macronutrients for your review.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
