/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Play,
  Power,
  RotateCcw,
  Volume2,
  VolumeX,
  BookOpen,
  AlertTriangle,
  AlertOctagon,
  ArrowRight,
  Map as MapIcon,
  Smartphone,
  ShieldAlert,
  HelpCircle,
  Sun,
  CloudRain,
  CloudFog,
  Radio,
  Zap,
  Monitor,
} from 'lucide-react';
import { VehiclePhysicsEngine } from './physics/VehiclePhysicsEngine';
import { ExerciseRuntimeEngine } from './course/ExerciseRuntimeEngine';
import { SoundEngine } from './audio/SoundEngine';
import {
  DEFAULT_CATEGORY_B_PROFILE,
  DEFAULT_KEY_BINDINGS,
} from './data/vehicleProfiles';
import {
  DRIVING_EXERCISES_LIST,
  OFFICIAL_TT108_2026_SCORING_RULE_SET,
  SELECTABLE_VEHICLE_PROFILES,
} from './data/courseDefinitions';
import {
  BLUEPRINT_CONTINUOUS_ROUTE_POINTS,
  BLUEPRINT_DIAGONAL_HATCH_ZONES,
  BLUEPRINT_GRASS_ISLANDS,
  BLUEPRINT_PAVED_RECESSES,
  BLUEPRINT_ROAD_ARROWS,
  BLUEPRINT_ROAD_SEGMENTS,
  BLUEPRINT_SCURVE_LANES,
  BLUEPRINT_SOLID_LINES,
  COURSE_YARD_BOUNDS,
  SA_HINH_BLUEPRINT_ZONES,
} from './data/saHinhBlueprintData';
import {
  CameraMode,
  KeyBindingsConfig,
  SpawnLocationId,
  TransmissionMode,
  VehicleProfileConfig,
  VehicleTelemetryState,
} from './types/simulation';
import {
  ActiveExerciseRuntimeState,
  DrivingExerciseDefinition,
  ExerciseMode,
  PracticeAttemptResult,
  ScoringRuleSet,
  ViolationEventRecord,
} from './types/course';
import { DrivingSceneView } from './three/DrivingSceneView';
import {
  DEFAULT_GLB_MODEL_PATH,
  VehicleAssetMetadata,
} from './three/CarModelBuilder';
import { InspectorTuningModal } from './components/InspectorTuningModal';
import { UnityWorkbenchModal } from './components/UnityWorkbenchModal';
import { CourseSelectionModal } from './components/CourseSelectionModal';
import { ExerciseResultsModal } from './components/ExerciseResultsModal';
import {
  MobileSteeringStyle,
  MobileTouchControls,
  TouchControlInputState,
} from './components/MobileTouchControls';
import { FirstTimeTutorialModal } from './components/FirstTimeTutorialModal';
import { TheoryStudyModal } from './components/TheoryStudyModal';
import { InstructorScoringConsoleModal } from './components/InstructorScoringConsoleModal';

export default function App() {
  // Core mutable simulation & course engines (Lazy initialized ONCE so re-renders never reset physics state!)
  const physicsInstanceRef = useRef<VehiclePhysicsEngine | null>(null);
  if (!physicsInstanceRef.current) {
    physicsInstanceRef.current = new VehiclePhysicsEngine(
      DEFAULT_CATEGORY_B_PROFILE
    );
  }
  const physicsRef =
    physicsInstanceRef as React.MutableRefObject<VehiclePhysicsEngine>;

  const exerciseInstanceRef = useRef<ExerciseRuntimeEngine | null>(null);
  if (!exerciseInstanceRef.current) {
    exerciseInstanceRef.current = new ExerciseRuntimeEngine(physicsRef.current);
  }
  const exerciseEngineRef =
    exerciseInstanceRef as React.MutableRefObject<ExerciseRuntimeEngine>;

  const soundInstanceRef = useRef<SoundEngine | null>(null);
  if (!soundInstanceRef.current) {
    soundInstanceRef.current = new SoundEngine();
  }
  const soundRef = soundInstanceRef as React.MutableRefObject<SoundEngine>;
  const touchInputRef = useRef<TouchControlInputState>({
    throttle: 0,
    brake: 0,
    steer: 0,
    clutch: 0,
    active: false,
  });

  // Viewport & Automatic Phone Landscape Mode state (Only on Mobile App / Phone, never on Desktop Web)
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>(
    () => ({
      w: typeof window !== 'undefined' ? window.innerWidth : 1280,
      h: typeof window !== 'undefined' ? window.innerHeight : 720,
    })
  );
  const isMobilePhoneOrTablet =
    typeof window !== 'undefined' &&
    (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 0 &&
        Math.min(viewportSize.w, viewportSize.h) < 920));
  const [autoLandscapeLock, setAutoLandscapeLock] = useState<boolean>(true);
  const isCssRotated90 =
    isMobilePhoneOrTablet &&
    autoLandscapeLock &&
    viewportSize.h > viewportSize.w;

  // Shell & UI states
  const [isTitleScreen, setIsTitleScreen] = useState<boolean>(true);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);
  const [showWheelDebugGizmos] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(false);
  const [showRearviewMirrors, setShowRearviewMirrors] = useState<boolean>(
    () => !isMobilePhoneOrTablet
  );
  const [showViolationLogDrawer, setShowViolationLogDrawer] =
    useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  // Only enable touch controls on Mobile App/Phone by default; keep Desktop Web clean
  const [isMobileTouchEnabled, setIsMobileTouchEnabled] = useState<boolean>(
    () => isMobilePhoneOrTablet
  );
  const [mobileSteeringStyle, setMobileSteeringStyle] =
    useState<MobileSteeringStyle>('BUTTONS');

  // Modals
  const [isCourseModalOpen, setIsCourseModalOpen] = useState<boolean>(false);
  const [isUnityWorkbenchOpen, setIsUnityWorkbenchOpen] =
    useState<boolean>(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState<boolean>(false);
  const [isTheoryModalOpen, setIsTheoryModalOpen] = useState<boolean>(false);
  const [isInstructorConsoleOpen, setIsInstructorConsoleOpen] =
    useState<boolean>(false);
  const [completedAttemptResult, setCompletedAttemptResult] =
    useState<PracticeAttemptResult | null>(null);
  const [failureNotice, setFailureNotice] = useState<{
    result: PracticeAttemptResult;
    primaryViolation?: ViolationEventRecord;
    remainingSeconds: number;
  } | null>(null);
  const failureNoticeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Simulation settings & 3D Vehicle Appearance
  const [cameraMode, setCameraMode] = useState<CameraMode>('CHASE');
  const [carPaintHex] = useState<number>(0x0284c7);
  const [showRoofSign] = useState<boolean>(true);
  const [customGlbUpload, setCustomGlbUpload] = useState<{
    buffer: ArrayBuffer;
    fileName: string;
  } | null>(null);
  const [, setVehicleAssetMeta] = useState<VehicleAssetMetadata>({
    assetName: 'Khronos CarConcept 3D Passenger Vehicle (sedan_car_concept.glb)',
    sourceUrl: DEFAULT_GLB_MODEL_PATH,
    licenseName: 'CC-BY-4.0 (Creative Commons Attribution 4.0 International)',
    authorCredit: 'Eric Chadwick / Darmstadt Graphics Group GmbH / Khronos Group',
    meshCount: 97,
    isExternalGlbLoaded: false,
  });
  const glbFileInputRef = useRef<HTMLInputElement | null>(null);
  const [autoClutchAssist, setAutoClutchAssist] = useState<boolean>(true);
  const [manualClutchSlider, setManualClutchSlider] = useState<number>(0);
  const [activeSpawnId] = useState<SpawnLocationId>('start_line');

  const [profile, setProfile] = useState<VehicleProfileConfig>(() =>
    structuredClone(DEFAULT_CATEGORY_B_PROFILE)
  );
  const [currentRuleSet, setCurrentRuleSet] = useState<ScoringRuleSet>(
    OFFICIAL_TT108_2026_SCORING_RULE_SET
  );
  const [keyBindings, setKeyBindings] = useState<KeyBindingsConfig>(() => ({
    ...DEFAULT_KEY_BINDINGS,
  }));

  const [telemetry, setTelemetry] = useState<VehicleTelemetryState>(() =>
    physicsRef.current.getTelemetrySnapshot()
  );
  const [exerciseState, setExerciseState] =
    useState<ActiveExerciseRuntimeState>(() =>
      exerciseEngineRef.current.getRuntimeStateSnapshot()
    );
  const [practiceHistory, setPracticeHistory] = useState<
    PracticeAttemptResult[]
  >(() => exerciseEngineRef.current.loadPracticeHistory());

  // Attempt native Screen Orientation API landscape lock when supported
  const tryLockNativeLandscape = () => {
    try {
      const scr = window.screen as Screen & {
        orientation?: { lock?: (mode: string) => Promise<void> };
      };
      if (scr?.orientation?.lock) {
        scr.orientation.lock('landscape').catch(() => {
          // Ignore when browser requires fullscreen or relies on CSS 90deg auto-landscape
        });
      }
    } catch {
      // Ignore
    }
  };

  // Track viewport size for automatic 90deg landscape rotation on portrait phones
  useEffect(() => {
    const updateViewport = () => {
      const w = window.visualViewport
        ? Math.round(window.visualViewport.width)
        : window.innerWidth;
      const h = window.visualViewport
        ? Math.round(window.visualViewport.height)
        : window.innerHeight;
      setViewportSize({ w, h });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    const exEngine = exerciseEngineRef.current;
    exEngine.onCheckpointCompleted = () => {
      soundRef.current.playShiftClick();
    };
    exEngine.onViolationTriggered = (record) => {
      if (record.code === 'OBSTACLE_OR_CONE_HIT') {
        soundRef.current.playCollisionImpact(1.2);
      }
    };
    exEngine.onVoiceAnnouncement = (
      messageVi,
      withChime,
      remainingScoreForVoice,
      directClipUrl
    ) => {
      soundRef.current.announceExerciseVoiceVi(
        messageVi,
        withChime ?? true,
        remainingScoreForVoice,
        directClipUrl
      );
    };
    exEngine.onExerciseFinished = (result) => {
      setPracticeHistory(exEngine.loadPracticeHistory());
      if (result.passed) {
        setCompletedAttemptResult(result);
      } else {
        if (failureNoticeTimerRef.current) {
          clearInterval(failureNoticeTimerRef.current);
          failureNoticeTimerRef.current = null;
        }
        const primary =
          result.violations && result.violations.length > 0
            ? result.violations[0]
            : undefined;
        let sec = 4;
        setFailureNotice({
          result,
          primaryViolation: primary,
          remainingSeconds: sec,
        });

        failureNoticeTimerRef.current = setInterval(() => {
          sec -= 1;
          if (sec <= 0) {
            if (failureNoticeTimerRef.current) {
              clearInterval(failureNoticeTimerRef.current);
              failureNoticeTimerRef.current = null;
            }
            setFailureNotice(null);
            setCompletedAttemptResult(result);
          } else {
            setFailureNotice((prev) =>
              prev ? { ...prev, remainingSeconds: sec } : null
            );
          }
        }, 1000);
      }
    };
  }, []);

  const handleDismissFailureNoticeAndShowModal = () => {
    if (failureNoticeTimerRef.current) {
      clearInterval(failureNoticeTimerRef.current);
      failureNoticeTimerRef.current = null;
    }
    const res = failureNotice?.result;
    setFailureNotice(null);
    if (res) {
      setCompletedAttemptResult(res);
    }
  };

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const isSpace = e.code === 'Space' || e.key === ' ';
      const k = (e.key || '').toLowerCase();
      const isThrottleKey =
        e.code === 'KeyW' ||
        e.code === 'ArrowUp' ||
        k === 'w' ||
        k === 'ư' ||
        e.keyCode === 87 ||
        e.keyCode === 38;

      if (isTheoryModalOpen || isInstructorConsoleOpen) {
        if (e.code === 'Escape') {
          setIsTheoryModalOpen(false);
          setIsInstructorConsoleOpen(false);
        }
        return;
      }

      if (isTitleScreen) {
        if (isCourseModalOpen || isTutorialModalOpen) {
          if (e.code === 'Escape') {
            setIsCourseModalOpen(false);
            setIsTutorialModalOpen(false);
          }
          return;
        }
        if (e.code === 'Enter' || isSpace || isThrottleKey) {
          e.preventDefault();
          handleStartSimulation();
        } else if (e.code === 'KeyB') {
          setIsCourseModalOpen((prev) => !prev);
        } else if (e.code === 'KeyL') {
          setIsTheoryModalOpen((prev) => !prev);
        }
        return;
      }

      if (failureNotice) {
        if (e.code === 'KeyR' || e.code === keyBindings.resetVehicle) {
          e.preventDefault();
          handleRetryCurrent();
        } else if (
          e.code === 'Space' ||
          e.code === 'Enter' ||
          e.code === 'Escape'
        ) {
          e.preventDefault();
          handleDismissFailureNoticeAndShowModal();
        }
        return;
      }

      if (
        isThrottleKey &&
        (isTutorialModalOpen || isPaused)
      ) {
        setIsTutorialModalOpen(false);
        setIsPaused(false);
        return;
      }

      if (e.code === 'Escape') {
        if (completedAttemptResult) {
          setCompletedAttemptResult(null);
        } else if (isTutorialModalOpen) {
          setIsTutorialModalOpen(false);
        } else if (isCourseModalOpen) {
          setIsCourseModalOpen(false);
        } else if (isUnityWorkbenchOpen) {
          setIsUnityWorkbenchOpen(false);
        } else if (isInspectorOpen) {
          setIsInspectorOpen(false);
        } else {
          setIsPaused((prev) => !prev);
        }
      } else if (e.code === 'Slash' && e.shiftKey) {
        setIsTutorialModalOpen((prev) => !prev);
      } else if (e.code === 'KeyB') {
        setIsCourseModalOpen((prev) => !prev);
      } else if (e.code === keyBindings.switchCamera) {
        setCameraMode((prev) =>
          prev === 'CHASE'
            ? 'COCKPIT'
            : prev === 'COCKPIT'
            ? 'HOOD'
            : prev === 'HOOD'
            ? 'ORBIT_INSPECT'
            : prev === 'ORBIT_INSPECT'
            ? 'TOP_DOWN'
            : 'CHASE'
        );
      } else if (e.code === 'KeyG') {
        setShowRearviewMirrors((prev) => !prev);
      } else if (e.code === 'KeyI') {
        setIsInspectorOpen((prev) => !prev);
      } else if (e.code === 'KeyM') {
        soundRef.current.isMuted = !soundRef.current.isMuted;
        setIsMuted(soundRef.current.isMuted);
      } else if (
        (e.code === 'KeyR' || e.code === keyBindings.resetVehicle) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        handleRetryCurrent();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [
    isTitleScreen,
    isTheoryModalOpen,
    isTutorialModalOpen,
    isCourseModalOpen,
    isUnityWorkbenchOpen,
    isInspectorOpen,
    completedAttemptResult,
    failureNotice,
    keyBindings,
  ]);

  const handleStartSimulation = (mode?: TransmissionMode) => {
    tryLockNativeLandscape();
    soundRef.current.init();
    if (mode) {
      physicsRef.current.transmissionMode = mode;
      if (mode === 'MANUAL') {
        setAutoClutchAssist(false);
        physicsRef.current.autoClutchEnabled = false;
      }
    }
    physicsRef.current.handbrakeActive = true;
    physicsRef.current.isEngineRunning = false;
    physicsRef.current.engineRpm = 0;
    physicsRef.current.isStalled = false;
    physicsRef.current.stallReasonVi = null;
    physicsRef.current.currentGear = 0;
    physicsRef.current.atSelectorPosition = 'P';
    setTelemetry(physicsRef.current.getTelemetrySnapshot());
    setIsTitleScreen(false);
    setIsPaused(false);
    soundRef.current.announceExerciseVoiceVi(
      exerciseEngineRef.current.getCurrentVoicePromptVi(),
      true
    );
    window.focus();
  };

  // Instant 1-tap Ready-to-Drive helper for mobile users
  const handleQuickReadyToDrive = () => {
    soundRef.current.init();
    const phys = physicsRef.current;
    if (!phys.isEngineRunning) {
      phys.toggleEngineIgnition();
    }
    if (phys.currentGear === 0) {
      if (phys.transmissionMode === 'AUTOMATIC') {
        phys.selectDirectGearPosition('D', true);
      } else {
        phys.shiftGearUp(true);
      }
    }
    if (phys.handbrakeActive) {
      phys.handbrakeActive = false;
      soundRef.current.playShiftClick();
    }
    if (
      exerciseState.activeStationNumber === 1 &&
      phys.turnSignal !== 'LEFT'
    ) {
      phys.toggleTurnSignal('LEFT');
    }
    phys.isStalled = false;
    phys.stallReasonVi = null;
    setTelemetry(phys.getTelemetrySnapshot());
  };

  const handleLaunchExercise = (
    exercise: DrivingExerciseDefinition,
    mode: ExerciseMode = 'SINGLE_EXERCISE'
  ) => {
    tryLockNativeLandscape();
    soundRef.current.init();
    soundRef.current.clearVoiceQueue();
    setCompletedAttemptResult(null);
    exerciseEngineRef.current.startExercise(
      exercise,
      mode,
      physicsRef.current
    );
    setManualClutchSlider(0);
    setTelemetry(physicsRef.current.getTelemetrySnapshot());
    setExerciseState(exerciseEngineRef.current.getRuntimeStateSnapshot());
    setIsTitleScreen(false);
    setIsPaused(false);
    soundRef.current.announceExerciseVoiceVi(
      exerciseEngineRef.current.getCurrentVoicePromptVi(),
      true
    );
  };

  const handleLaunchFreePractice = () => {
    tryLockNativeLandscape();
    soundRef.current.init();
    soundRef.current.clearVoiceQueue();
    setCompletedAttemptResult(null);
    exerciseEngineRef.current.startFreePractice(physicsRef.current);
    physicsRef.current.resetToPreset(activeSpawnId);
    setManualClutchSlider(0);
    setTelemetry(physicsRef.current.getTelemetrySnapshot());
    setExerciseState(exerciseEngineRef.current.getRuntimeStateSnapshot());
    setIsTitleScreen(false);
    setIsPaused(false);
  };

  const handleRetryCurrent = () => {
    if (failureNoticeTimerRef.current) {
      clearInterval(failureNoticeTimerRef.current);
      failureNoticeTimerRef.current = null;
    }
    setFailureNotice(null);
    setCompletedAttemptResult(null);
    soundRef.current.clearVoiceQueue();
    const exEngine = exerciseEngineRef.current;
    if (exEngine.activeExercise && exEngine.mode !== 'FREE_PRACTICE') {
      exEngine.startExercise(
        exEngine.activeExercise,
        exEngine.mode,
        physicsRef.current
      );
      soundRef.current.announceExerciseVoiceVi(
        exEngine.getCurrentVoicePromptVi(),
        true
      );
    } else {
      physicsRef.current.resetToPreset(activeSpawnId);
    }
    setManualClutchSlider(0);
    setTelemetry(physicsRef.current.getTelemetrySnapshot());
    setExerciseState(exEngine.getRuntimeStateSnapshot());
  };

  const handleNextExercise = () => {
    setCompletedAttemptResult(null);
    const currentId = exerciseEngineRef.current.activeExercise?.id;
    const idx = DRIVING_EXERCISES_LIST.findIndex((e) => e.id === currentId);
    const nextEx =
      DRIVING_EXERCISES_LIST[(idx + 1) % DRIVING_EXERCISES_LIST.length];
    handleLaunchExercise(nextEx, 'SINGLE_EXERCISE');
  };

  const handleUpdateProfile = (nextProfile: VehicleProfileConfig) => {
    setProfile(nextProfile);
    physicsRef.current.profile = structuredClone(nextProfile);
    const exEngine = exerciseEngineRef.current;
    if (exEngine.activeExercise && exEngine.mode !== 'FREE_PRACTICE') {
      const baseEx =
        DRIVING_EXERCISES_LIST.find(
          (e) => e.id === exEngine.activeExercise?.id
        ) ?? exEngine.activeExercise;
      exEngine.startExercise(baseEx, exEngine.mode, physicsRef.current);
      setExerciseState(exEngine.getRuntimeStateSnapshot());
    }
  };

  const handleToggleTransmission = () => {
    const next: TransmissionMode =
      physicsRef.current.transmissionMode === 'MANUAL' ? 'AUTOMATIC' : 'MANUAL';
    physicsRef.current.transmissionMode = next;
    if (next === 'AUTOMATIC') {
      physicsRef.current.atSelectorPosition =
        physicsRef.current.currentGear === -1
          ? 'R'
          : physicsRef.current.currentGear === 0
          ? 'P'
          : 'D';
    }
    setTelemetry(physicsRef.current.getTelemetrySnapshot());
  };

  const handleToggleMute = () => {
    soundRef.current.init();
    soundRef.current.isMuted = !soundRef.current.isMuted;
    setIsMuted(soundRef.current.isMuted);
  };

  const isAnyModalOpen =
    isPaused ||
    isTutorialModalOpen ||
    isCourseModalOpen ||
    isUnityWorkbenchOpen ||
    isInspectorOpen ||
    isInstructorConsoleOpen ||
    completedAttemptResult !== null;

  const needsStartupStrip =
    !telemetry.isEngineRunning ||
    telemetry.currentGear === 0 ||
    telemetry.handbrakeActive ||
    Boolean(telemetry.stallReasonVi);

  return (
    <div
      className="overflow-hidden bg-slate-950 select-none"
      style={
        isCssRotated90
          ? {
              position: 'fixed',
              top: '50%',
              left: '50%',
              width: `${viewportSize.h}px`,
              height: `${viewportSize.w}px`,
              transform: 'translate(-50%, -50%) rotate(90deg)',
              transformOrigin: 'center center',
            }
          : {
              position: 'fixed',
              inset: 0,
              width: '100%',
              height: '100%',
            }
      }
    >
      {/* 1. Isolated 3D WebGL Viewport */}
      <DrivingSceneView
        physicsRef={physicsRef}
        exerciseEngineRef={exerciseEngineRef}
        soundRef={soundRef}
        touchInputRef={touchInputRef}
        cameraMode={cameraMode}
        carPaintHex={carPaintHex}
        showRoofSign={showRoofSign}
        isTitleScreen={isTitleScreen}
        isPaused={isAnyModalOpen}
        autoClutchAssist={autoClutchAssist}
        showWheelDebugGizmos={showWheelDebugGizmos}
        keyBindings={keyBindings}
        manualClutchSlider={manualClutchSlider}
        showRearviewMirrors={showRearviewMirrors}
        isCssRotated90={isCssRotated90}
        customGlbUpload={customGlbUpload}
        onVehicleAssetLoaded={(meta) => setVehicleAssetMeta(meta)}
        onTelemetryUpdate={(snap, exSnap) => {
          setTelemetry(snap);
          setExerciseState(exSnap);
        }}
      />

      {/* Hidden File Input for Custom .GLB / .GLTF Vehicle Asset Import */}
      <input
        ref={glbFileInputRef}
        type="file"
        accept=".glb,.gltf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (reader.result instanceof ArrayBuffer) {
              setCustomGlbUpload({
                buffer: reader.result,
                fileName: file.name,
              });
            }
          };
          reader.readAsArrayBuffer(file);
          e.target.value = '';
        }}
      />

      {/* 2. Landscape-Optimized Title Screen Overlay */}
      {isTitleScreen && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-3 sm:p-6 md:p-10 bg-gradient-to-t from-slate-950/92 via-slate-950/45 to-slate-950/75 pointer-events-auto">
          {/* Top Navigation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-sky-500/20 border border-sky-400/40 text-[11px] font-mono font-extrabold text-sky-300 tracking-wider">
                SA HÌNH LÁI XE 3D · 11 BÀI THI
              </span>
              {viewportSize.h > viewportSize.w && (
                <button
                  type="button"
                  onClick={() => setAutoLandscapeLock((prev) => !prev)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border transition-colors ${
                    autoLandscapeLock
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50'
                      : 'bg-slate-900/90 text-slate-300 border-slate-700'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5 rotate-90" />
                  {autoLandscapeLock ? 'Màn Hình Ngang: BẬT' : 'Xoay Ngang'}
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setIsCourseModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow transition-colors whitespace-nowrap shrink-0"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Chọn Bài & Sơ Đồ (11 Bài)
              </button>

              <button
                onClick={() => {
                  soundRef.current.init();
                  setIsInstructorConsoleOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/95 text-amber-300 border border-slate-700 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                Chip Chấm Điểm
              </button>

              <button
                onClick={() => setIsTheoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900/95 text-sky-300 border border-slate-700 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <BookOpen className="w-3.5 h-3.5" />
                600 Câu Lý Thuyết
              </button>

              <button
                onClick={() => setIsTutorialModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors whitespace-nowrap shrink-0 shadow"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Hướng Dẫn
              </button>
            </div>
          </div>

          {/* Center-Bottom Horizontal Landscape Hero Panel */}
          <div className="my-auto flex flex-col lg:flex-row lg:items-end justify-between gap-4 bg-slate-950/75 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl">
            <div className="space-y-2.5 max-w-xl">
              <div className="inline-flex items-center gap-2 text-[11px] font-mono text-amber-300 bg-amber-500/15 border border-amber-400/30 px-2.5 py-0.5 rounded-md">
                <span>✓ Chuẩn Sát Hạch QCVN 41 & Thông Tư 108</span>
                <span>·</span>
                <span>Hỗ Trợ Điện Thoại Ngang & PC</span>
              </div>
              <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Mô Phỏng Sát Hạch Lái Xe Sa Hình 3D
              </h1>

              {/* Vehicle Category + Weather Row in a single compact line */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {(['B', 'C1', 'C'] as const).map((catCode) => {
                  const vehProfile = SELECTABLE_VEHICLE_PROFILES.find(
                    (v) => v.category === catCode
                  );
                  if (!vehProfile) return null;
                  const isActiveCat = profile.category === catCode;
                  return (
                    <button
                      key={catCode}
                      onClick={() => handleUpdateProfile(vehProfile)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-all ${
                        isActiveCat
                          ? 'bg-amber-500 text-slate-950 border-amber-300 shadow'
                          : 'bg-slate-900/90 text-slate-200 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      Xe Hạng {catCode}
                    </button>
                  );
                })}

                <span className="text-slate-700 mx-0.5">|</span>

                {(
                  [
                    { mode: 'CLEAR', label: '☀️ Nắng' },
                    { mode: 'RAIN', label: '🌧️ Mưa' },
                    { mode: 'FOG', label: '🌫️ Sương Mù' },
                  ] as const
                ).map((wItem) => {
                  const isActiveWeather = telemetry.weatherMode === wItem.mode;
                  return (
                    <button
                      key={wItem.mode}
                      type="button"
                      onClick={() => {
                        physicsRef.current.setWeatherMode(wItem.mode);
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isActiveWeather
                          ? 'bg-sky-500 text-slate-950 border-sky-300 shadow'
                          : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {wItem.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Launch Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => handleStartSimulation('MANUAL')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold bg-sky-500 text-slate-950 hover:bg-sky-400 shadow-[0_0_20px_rgba(14,165,233,0.45)] transition-all active:scale-95 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                Vào Lái Số Sàn (MT)
              </button>

              <button
                onClick={() => handleStartSimulation('AUTOMATIC')}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-extrabold bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all active:scale-95 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" />
                Vào Lái Số Tự Động (AT)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Active Simulation Perimeter HUD (Optimized for Landscape Phone & Clear Road View) */}
      {!isTitleScreen && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-1.5 sm:p-2.5">
          {/* Top Bar: Single-Row Sleek Status & Action Strip */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-1.5">
              {/* Top-Left: Exit, Score, Timer, Current Exercise Name */}
              <div className="pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-xl bg-slate-950/88 backdrop-blur-md border border-slate-800/90 shadow-lg min-w-0">
                <button
                  onClick={() => setIsTitleScreen(true)}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition-colors whitespace-nowrap shrink-0"
                  title="Thoát ra màn hình chính"
                >
                  ← Thoát
                </button>

                <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums shrink-0 pl-1.5 border-l border-slate-800">
                  <strong
                    className={`text-sm font-extrabold ${
                      exerciseState.currentScore >= exerciseState.passingScore
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {exerciseState.currentScore}đ
                  </strong>
                  <span className="text-slate-300 text-[11px]">
                    {exerciseState.remainingSeconds}s
                  </span>
                </div>

                {/* Current Station / Exercise Title */}
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="hidden sm:flex items-center gap-1 pl-1.5 border-l border-slate-800 text-[11px] font-bold text-sky-300 hover:text-sky-200 truncate max-w-[180px] md:max-w-[260px]"
                  title="Nhấn để đổi bài thi (Phím B)"
                >
                  <span className="truncate">
                    {exerciseState.exercise
                      ? exerciseState.exercise.titleVi
                      : `Bài ${exerciseState.activeStationNumber}/11`}
                  </span>
                </button>

                {exerciseState.violations.length > 0 && (
                  <button
                    onClick={() =>
                      setShowViolationLogDrawer((prev) => !prev)
                    }
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-700/70 hover:bg-rose-900/80 transition-colors shrink-0"
                  >
                    <ShieldAlert className="w-3 h-3 text-rose-400" />
                    Lỗi: {exerciseState.violations.length}
                  </button>
                )}
              </div>

              {/* Top-Right: Single-Row Compact Controls */}
              <div className="pointer-events-auto flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar">
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-600/90 text-white border border-emerald-400/50 hover:bg-emerald-500 transition-colors whitespace-nowrap shrink-0"
                  title="Chọn bài thi sát hạch (Phím B)"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Chọn Bài</span>
                </button>

                <button
                  onClick={() => setShowMinimap((prev) => !prev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                    showMinimap
                      ? 'bg-sky-500 text-slate-950 border-sky-300'
                      : 'bg-slate-950/85 text-sky-300 border-slate-800 hover:bg-slate-800'
                  }`}
                  title="Bật/Tắt Sơ Đồ Sa Hình 2D"
                >
                  <MapIcon className="w-3 h-3" />
                  <span>Sơ Đồ</span>
                </button>

                <button
                  onClick={() =>
                    setCameraMode((prev) =>
                      prev === 'CHASE'
                        ? 'COCKPIT'
                        : prev === 'COCKPIT'
                        ? 'HOOD'
                        : prev === 'HOOD'
                        ? 'ORBIT_INSPECT'
                        : prev === 'ORBIT_INSPECT'
                        ? 'TOP_DOWN'
                        : 'CHASE'
                    )
                  }
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-950/85 text-slate-200 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  title="Đổi góc nhìn Camera (Phím C)"
                >
                  <Camera className="w-3 h-3 text-sky-400" />
                  <span>
                    {cameraMode === 'CHASE'
                      ? 'Sau Xe'
                      : cameraMode === 'COCKPIT'
                      ? 'Buồng Lái'
                      : cameraMode === 'HOOD'
                      ? 'Ca-pô'
                      : cameraMode === 'ORBIT_INSPECT'
                      ? '360°'
                      : 'Trên Cao'}
                  </span>
                </button>

                <button
                  onClick={() => setShowRearviewMirrors((prev) => !prev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                    showRearviewMirrors
                      ? 'bg-sky-950/90 text-sky-300 border-sky-500/60'
                      : 'bg-slate-950/85 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                  title="Bật/Tắt Gương Chiếu Hậu (Phím G)"
                >
                  Gương
                </button>

                <button
                  onClick={handleRetryCurrent}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-950/85 text-amber-400 border border-slate-800 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  title="Đặt lại bài tập hiện tại (Phím R)"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden md:inline">Đặt Lại</span>
                </button>

                {/* Toggle between Mobile Landscape Touch UI and PC Cockpit Bar */}
                <button
                  onClick={() => setIsMobileTouchEnabled((prev) => !prev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors whitespace-nowrap shrink-0 ${
                    isMobileTouchEnabled
                      ? 'bg-amber-500/20 text-amber-300 border-amber-400/50'
                      : 'bg-slate-950/85 text-slate-300 border-slate-800'
                  }`}
                  title="Chuyển đổi giao diện Vô-lăng Điện Thoại Ngang / Bảng Điều Khiển PC"
                >
                  {isMobileTouchEnabled ? (
                    <>
                      <Smartphone className="w-3 h-3 rotate-90 text-amber-400" />
                      <span className="hidden sm:inline">ĐT Ngang</span>
                    </>
                  ) : (
                    <>
                      <Monitor className="w-3 h-3 text-sky-400" />
                      <span className="hidden sm:inline">PC</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleToggleMute}
                  className="p-1.5 rounded-lg bg-slate-950/85 text-slate-300 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0"
                  aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
                >
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </button>

                <button
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setIsTutorialModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg bg-slate-950/85 text-amber-400 border border-slate-800 hover:bg-slate-800 transition-colors shrink-0"
                  title="Hướng dẫn điều khiển (?)"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expandable Violation History Drawer (under Top-Left) */}
            {showViolationLogDrawer && exerciseState.violations.length > 0 && (
              <div className="pointer-events-auto self-start w-72 rounded-xl bg-slate-950/95 border border-rose-800/70 p-2 max-h-28 overflow-y-auto space-y-1 shadow-xl">
                {exerciseState.violations.map((v) => (
                  <div
                    key={v.id}
                    className="px-2 py-0.5 rounded bg-slate-900/95 border border-rose-900/50 text-[10px] flex items-center justify-between gap-2"
                  >
                    <span className="font-semibold text-rose-300 truncate">
                      {v.titleVi}
                    </span>
                    <span className="font-mono font-bold text-rose-400 shrink-0">
                      -{v.pointsDeducted}đ
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Compact Top-Center Banners (Startup Quick Strip / Stop Prompt / Violation Toast) */}
            <div className="mx-auto max-w-2xl w-full flex flex-col gap-1 items-center">
              {/* Prominent Real-Time Failure Notification Banner */}
              {failureNotice && !completedAttemptResult && (
                <div className="pointer-events-auto w-full max-w-xl mx-auto rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900/95 to-slate-950 border-2 border-rose-500 shadow-[0_0_36px_rgba(239,68,68,0.7)] p-4 space-y-2.5 z-50">
                  <div className="flex items-center justify-between gap-2 border-b border-rose-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-rose-600 text-white animate-pulse">
                        <AlertOctagon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-black text-rose-200 tracking-wide uppercase">
                          {failureNotice.result.summaryNoteVi.includes('Truất quyền') ||
                          failureNotice.result.summaryNoteVi.includes('trượt trực tiếp')
                            ? 'BẠN ĐÃ BỊ TRUẤT QUYỀN SÁT HẠCH'
                            : 'CHƯA ĐẠT YÊU CẦU (< 80 ĐIỂM)'}
                        </div>
                        <div className="text-[11px] text-rose-300">
                          Điểm còn lại: <strong className="text-white">{failureNotice.result.finalScore}/100</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRetryCurrent}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow transition-all cursor-pointer"
                        title="Thi lại bài này ngay (Phím R)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Thi Lại (R)
                      </button>
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm font-bold text-white bg-slate-950/80 p-2.5 rounded-xl border border-rose-700/60 leading-relaxed shadow-inner">
                    {failureNotice.result.summaryNoteVi}
                  </div>

                  {failureNotice.primaryViolation && (
                    <div className="text-xs text-rose-100 bg-rose-950/60 p-2.5 rounded-xl border border-rose-800/60 space-y-1">
                      <div className="flex items-center justify-between text-rose-300 font-bold">
                        <span>Lỗi vi phạm: {failureNotice.primaryViolation.titleVi}</span>
                        <span className="font-mono text-rose-400 font-extrabold">
                          {failureNotice.primaryViolation.pointsDeducted > 0
                            ? `-${failureNotice.primaryViolation.pointsDeducted}đ`
                            : 'Truất quyền'}
                        </span>
                      </div>
                      {failureNotice.primaryViolation.stationNameVi && (
                        <div className="text-[11px] text-amber-300 font-mono">
                          Vị trí: {failureNotice.primaryViolation.stationNameVi}
                        </div>
                      )}
                      <div className="text-sky-300 text-[11px] pt-0.5">
                        💡 {failureNotice.primaryViolation.correctiveFeedbackVi}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400 italic">
                      Xe đã dừng an toàn · Mở bảng kết quả sau {failureNotice.remainingSeconds}s...
                    </span>
                    <button
                      type="button"
                      onClick={handleDismissFailureNoticeAndShowModal}
                      className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 font-bold text-xs transition-colors cursor-pointer"
                    >
                      <span>Xem Chi Tiết Ngay</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Stop Zone Prompt */}
              {exerciseState.isInsideStopZone && telemetry.speedKmh > 0.8 && (
                <div className="pointer-events-auto px-3 py-1 rounded-full bg-amber-500 text-slate-950 text-xs font-extrabold shadow-lg animate-pulse">
                  🛑 ĐẾN VẠCH DỪNG: Đạp phanh (S) dừng hẳn xe (0 km/h)!
                </div>
              )}

              {/* Bài 10 Emergency Alert */}
              {exerciseState.emergencyAlertActive && (
                <div className="pointer-events-auto w-full max-w-lg px-3 py-2 rounded-xl bg-rose-950/95 border-2 border-rose-500 shadow-[0_0_24px_rgba(239,68,68,0.65)] space-y-1.5 animate-pulse">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-white">
                      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                      <span>TÌNH HUỐNG KHẨN CẤP — DỪNG XE & BẬT ĐÈN (V)!</span>
                    </div>
                    <button
                      onClick={() => {
                        soundRef.current.init();
                        physicsRef.current.toggleTurnSignal('HAZARD');
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors shrink-0 ${
                        telemetry.turnSignal === 'HAZARD'
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                      }`}
                    >
                      {telemetry.turnSignal === 'HAZARD'
                        ? '✓ ĐÃ BẬT ĐÈN KHẨN CẤP'
                        : '▲ BẤM ĐÈN KHẨN CẤP (V)'}
                    </button>
                  </div>
                  <div className="h-1.5 w-full rounded bg-slate-900 overflow-hidden border border-rose-400/50">
                    <div
                      className="h-full bg-amber-400 transition-all duration-75"
                      style={{
                        width: `${Math.min(
                          100,
                          (exerciseState.emergencyHoldProgressS / 2.2) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Compact Violation Toast */}
              {exerciseState.latestViolationToast && (
                <div className="pointer-events-auto px-3 py-1.5 rounded-xl bg-slate-950/92 border border-rose-500/80 shadow-lg flex items-center gap-2 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="font-bold text-rose-300">
                    {exerciseState.latestViolationToast.titleVi}
                  </span>
                  <span className="font-mono font-extrabold text-rose-400">
                    -{exerciseState.latestViolationToast.pointsDeducted}đ
                  </span>
                </div>
              )}

              {/* Ultra-Compact 1-Line Quick-Start Strip (Only visible before car is ready to move) */}
              {needsStartupStrip && (
                <div className="pointer-events-auto px-2.5 py-1 rounded-xl bg-slate-950/88 backdrop-blur-md border border-slate-700/90 shadow-lg flex flex-wrap items-center justify-center gap-1 text-[10px]">
                  {telemetry.stallReasonVi && (
                    <span className="font-bold text-amber-300 mr-1">
                      ⚠️ {telemetry.stallReasonVi}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={handleQuickReadyToDrive}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow transition-colors"
                    title="Tự động Đề nổ + Vào số 1/D + Hạ phanh tay + Bật xi-nhan trái"
                  >
                    <Zap className="w-3 h-3 fill-current" />
                    Khởi Hành Nhanh
                  </button>

                  <span className="text-slate-600 mx-0.5">|</span>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.init();
                      if (!physicsRef.current.isEngineRunning) {
                        physicsRef.current.toggleEngineIgnition();
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      telemetry.isEngineRunning
                        ? 'bg-slate-800/90 text-emerald-300 border border-slate-700'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {telemetry.isEngineRunning ? '✓ 1.Đã nổ' : '① Đề nổ (F)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.init();
                      if (physicsRef.current.currentGear === 0) {
                        if (
                          physicsRef.current.transmissionMode === 'AUTOMATIC'
                        ) {
                          physicsRef.current.selectDirectGearPosition(
                            'D',
                            true
                          );
                        } else {
                          physicsRef.current.shiftGearUp(true);
                        }
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      telemetry.currentGear !== 0
                        ? 'bg-slate-800/90 text-emerald-300 border border-slate-700'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {telemetry.currentGear !== 0
                      ? `✓ 2.Số ${telemetry.gearLabel}`
                      : '② Vào số (E)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.init();
                      if (physicsRef.current.handbrakeActive) {
                        physicsRef.current.handbrakeActive = false;
                        physicsRef.current.stallReasonVi = null;
                        soundRef.current.playShiftClick();
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      !telemetry.handbrakeActive
                        ? 'bg-slate-800/90 text-emerald-300 border border-slate-700'
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    {!telemetry.handbrakeActive
                      ? '✓ 3.Phanh tay'
                      : '③ Hạ phanh (Space)'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundRef.current.init();
                      if (physicsRef.current.turnSignal !== 'LEFT') {
                        physicsRef.current.toggleTurnSignal('LEFT');
                        setTelemetry(physicsRef.current.getTelemetrySnapshot());
                      }
                    }}
                    className={`px-1.5 py-0.5 rounded font-mono font-bold transition-colors ${
                      telemetry.turnSignal === 'LEFT'
                        ? 'bg-slate-800/90 text-emerald-300 border border-slate-700'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {telemetry.turnSignal === 'LEFT'
                      ? '✓ 4.Xi-nhan Trái'
                      : '④ Xi-nhan (Z)'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Live 2D "11 BÀI THI SÁT HẠCH" Unified Blueprint Minimap Overlay */}
          {showMinimap && (
            <div className="pointer-events-auto absolute top-11 right-2.5 z-30 w-64 sm:w-72 rounded-xl bg-slate-950/95 border border-slate-700 shadow-2xl p-2 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="font-bold text-sky-400 uppercase tracking-wider">
                  SƠ ĐỒ 11 BÀI SÁT HẠCH
                </span>
                <button
                  onClick={() => setShowMinimap(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white text-[10px] font-bold"
                >
                  Đóng ×
                </button>
              </div>
              <svg
                viewBox="-96 -68 192 136"
                className="w-full h-36 sm:h-40 rounded-lg bg-[#1e293b] border border-slate-800 select-none"
              >
                <rect
                  x={COURSE_YARD_BOUNDS.minX}
                  y={COURSE_YARD_BOUNDS.minZ}
                  width={COURSE_YARD_BOUNDS.widthM}
                  height={COURSE_YARD_BOUNDS.lengthM}
                  fill="#262e38"
                  stroke="#f8fafc"
                  strokeWidth="0.9"
                  rx="2.5"
                />

                {BLUEPRINT_GRASS_ISLANDS.map((isl) => (
                  <rect
                    key={isl.id}
                    x={isl.minX}
                    y={isl.minZ}
                    width={isl.maxX - isl.minX}
                    height={isl.maxZ - isl.minZ}
                    fill="#64748b"
                    stroke="#475569"
                    strokeWidth="0.35"
                  />
                ))}

                {BLUEPRINT_PAVED_RECESSES.map((rec) => (
                  <rect
                    key={rec.id}
                    x={rec.minX}
                    y={rec.minZ}
                    width={rec.maxX - rec.minX}
                    height={rec.maxZ - rec.minZ}
                    fill="#262e38"
                  />
                ))}

                {BLUEPRINT_SCURVE_LANES.map((sc) => (
                  <g key={sc.id}>
                    <polyline
                      points={sc.centerPoints
                        .map((p) => `${p.x},${p.z}`)
                        .join(' ')}
                      fill="none"
                      stroke="#262e38"
                      strokeWidth={sc.halfWidthM * 2 + 0.35}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}

                {BLUEPRINT_SOLID_LINES.map((sLine) => (
                  <line
                    key={sLine.id}
                    x1={sLine.x1}
                    y1={sLine.z1}
                    x2={sLine.x2}
                    y2={sLine.z2}
                    stroke={
                      sLine.hasRedWhiteCurb
                        ? '#ef4444'
                        : sLine.colorHex === 0xfacc15
                        ? '#facc15'
                        : '#f8fafc'
                    }
                    strokeWidth={sLine.colorHex === 0xfacc15 ? '0.65' : '0.52'}
                    strokeDasharray={
                      sLine.hasRedWhiteCurb ? '1.1 0.9' : undefined
                    }
                  />
                ))}

                {BLUEPRINT_ROAD_SEGMENTS.filter(
                  (s) => s.hasCenterDashedLine
                ).map((seg) => (
                  <line
                    key={seg.id}
                    x1={seg.start.x}
                    y1={seg.start.z}
                    x2={seg.end.x}
                    y2={seg.end.z}
                    stroke="#facc15"
                    strokeWidth="0.45"
                    strokeDasharray="2.2 1.8"
                  />
                ))}

                {BLUEPRINT_DIAGONAL_HATCH_ZONES.map((hz) => (
                  <rect
                    key={hz.id}
                    x={hz.minX}
                    y={hz.minZ}
                    width={hz.maxX - hz.minX}
                    height={hz.maxZ - hz.minZ}
                    fill="#94a3b8"
                    fillOpacity="0.45"
                    stroke="#f8fafc"
                    strokeWidth="0.3"
                  />
                ))}

                {BLUEPRINT_ROAD_ARROWS.map((arr, idx) => (
                  <g
                    key={`mm_arr_${idx}`}
                    transform={`translate(${arr.x}, ${arr.z}) rotate(${-arr.yawDeg})`}
                    opacity="0.9"
                  >
                    {(arr.type === 'STRAIGHT' ||
                      arr.type === 'STRAIGHT_LEFT' ||
                      arr.type === 'STRAIGHT_RIGHT') && (
                      <>
                        <line
                          x1="-1.1"
                          y1="0"
                          x2="0.8"
                          y2="0"
                          stroke="#f8fafc"
                          strokeWidth="0.34"
                          strokeLinecap="round"
                        />
                        <polygon
                          points="1.4,0 0.52,-0.5 0.52,0.5"
                          fill="#f8fafc"
                        />
                      </>
                    )}
                    {(arr.type === 'LEFT' || arr.type === 'STRAIGHT_LEFT') && (
                      <>
                        <polyline
                          points="-1.0,0 0.15,0 0.15,-0.8"
                          fill="none"
                          stroke="#f8fafc"
                          strokeWidth="0.34"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polygon
                          points="0.15,-1.38 -0.35,-0.6 0.65,-0.6"
                          fill="#f8fafc"
                        />
                      </>
                    )}
                    {(arr.type === 'RIGHT' ||
                      arr.type === 'STRAIGHT_RIGHT') && (
                      <>
                        <polyline
                          points="-1.0,0 0.15,0 0.15,0.8"
                          fill="none"
                          stroke="#f8fafc"
                          strokeWidth="0.34"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polygon
                          points="0.15,1.38 -0.35,0.6 0.65,0.6"
                          fill="#f8fafc"
                        />
                      </>
                    )}
                  </g>
                ))}

                <polyline
                  points={BLUEPRINT_CONTINUOUS_ROUTE_POINTS.map(
                    (pt) => `${pt.x},${pt.z}`
                  ).join(' ')}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="0.55"
                  strokeDasharray="1.8 1.2"
                  opacity="0.85"
                />

                {SA_HINH_BLUEPRINT_ZONES.map((z) => {
                  const isActiveStation =
                    exerciseState.activeStationNumber === z.orderIndex ||
                    exerciseState.exercise?.id === z.linkedExerciseId;
                  return (
                    <g
                      key={z.id}
                      className="cursor-pointer"
                      onClick={() => {
                        const targetEx = DRIVING_EXERCISES_LIST.find(
                          (e) => e.id === z.linkedExerciseId
                        );
                        if (targetEx) {
                          handleLaunchExercise(targetEx, 'SINGLE_EXERCISE');
                        }
                      }}
                    >
                      <circle
                        cx={z.checkpointPointM.x}
                        cy={z.checkpointPointM.z}
                        r={isActiveStation ? 5.6 : 4.5}
                        fill={isActiveStation ? '#10b981' : '#dc2626'}
                        stroke="#ffffff"
                        strokeWidth="0.8"
                      />
                      <text
                        x={z.checkpointPointM.x}
                        y={z.checkpointPointM.z + 1.5}
                        textAnchor="middle"
                        fill="#ffffff"
                        fontSize="4.4"
                        fontWeight="bold"
                      >
                        {z.orderIndex}
                      </text>
                    </g>
                  );
                })}

                <g
                  transform={`translate(${telemetry.position.x}, ${telemetry.position.z}) rotate(${telemetry.headingDeg})`}
                >
                  <rect
                    x="-2.0"
                    y="-3.8"
                    width="4.0"
                    height="7.6"
                    rx="0.8"
                    fill="#38bdf8"
                    stroke="#ffffff"
                    strokeWidth="0.65"
                  />
                  <polygon points="0,-5.2 -1.8,-2.2 1.8,-2.2" fill="#facc15" />
                </g>
              </svg>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>Chạm số (1–11) để nhảy tới bài</span>
                <button
                  onClick={() => setIsCourseModalOpen(true)}
                  className="text-sky-400 hover:text-sky-300 font-semibold"
                >
                  Phóng To →
                </button>
              </div>
            </div>
          )}

          {/* Streamlined PC Cockpit Control Console (Shown when user switches from ĐT Ngang to PC mode) */}
          {!isMobileTouchEnabled && (
            <div className="pointer-events-auto mx-auto w-full max-w-[760px] flex flex-col items-center">
              <div className="flex items-center gap-2 mb-1">
                <button
                  onClick={() => setIsHudCollapsed((prev) => !prev)}
                  className="flex items-center gap-1 px-2.5 py-0.5 rounded-t-lg bg-slate-950/90 border border-b-0 border-slate-800 text-[10px] font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
                >
                  {isHudCollapsed ? (
                    <>
                      <ChevronUp className="w-3 h-3 text-sky-400" />
                      Hiện Bảng Điều Khiển PC
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3 text-sky-400" />
                      Thu Gọn
                    </>
                  )}
                </button>
              </div>

              {!isHudCollapsed && (
                <div className="w-full rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 shadow-2xl px-2.5 py-1.5">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    {/* 1. Nút Đề Nổ & Đồng Hồ Tốc Độ */}
                    <div className="md:col-span-3 flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          soundRef.current.init();
                          physicsRef.current.toggleEngineIgnition();
                          setTelemetry(
                            physicsRef.current.getTelemetrySnapshot()
                          );
                        }}
                        className={`flex flex-col items-center justify-center w-11 h-10 rounded-full border-2 font-mono transition-all shrink-0 ${
                          telemetry.isEngineRunning
                            ? 'bg-slate-800 border-sky-400 text-sky-300 hover:bg-slate-700'
                            : 'bg-amber-500 border-amber-300 text-slate-950 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.5)] hover:bg-amber-400'
                        }`}
                        title="Đề Nổ Máy / Tắt Máy (Phím F)"
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span className="text-[8px] leading-none font-bold mt-0.5">
                          {telemetry.isEngineRunning ? 'ON (F)' : 'START'}
                        </span>
                      </button>

                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-extrabold font-mono tabular-nums text-white leading-none">
                            {Math.round(telemetry.speedKmh)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            km/h
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-mono ${
                            telemetry.isEngineRunning
                              ? 'text-slate-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {telemetry.isEngineRunning
                            ? `${telemetry.engineRpm} RPM`
                            : 'MÁY TẮT'}
                        </span>
                      </div>
                    </div>

                    {/* 2. Cần Gạt Trái: Công Tắc Đèn (L) & Gạt Xi-Nhan (Z / X) */}
                    <div className="md:col-span-4 flex flex-col gap-1 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                          Đèn & Xi-Nhan
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.currentTarget.blur();
                            soundRef.current.init();
                            soundRef.current.playShiftClick();
                            physicsRef.current.cycleHeadlightMode();
                            setTelemetry(
                              physicsRef.current.getTelemetrySnapshot()
                            );
                          }}
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold border transition-colors ${
                            telemetry.headlightMode === 'HIGH_BEAM'
                              ? 'bg-sky-500 text-slate-950 border-sky-300'
                              : telemetry.headlightMode === 'LOW_BEAM'
                              ? 'bg-amber-500 text-slate-950 border-amber-300'
                              : 'bg-slate-950 text-slate-400 border-slate-700'
                          }`}
                        >
                          💡 Đèn (L):{' '}
                          {telemetry.headlightMode === 'HIGH_BEAM'
                            ? 'PHA'
                            : telemetry.headlightMode === 'LOW_BEAM'
                            ? 'CỐT'
                            : 'TẮT'}
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            soundRef.current.init();
                            physicsRef.current.toggleTurnSignal('LEFT');
                            setTelemetry(
                              physicsRef.current.getTelemetrySnapshot()
                            );
                          }}
                          className={`py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            telemetry.turnSignal === 'LEFT' ||
                            telemetry.turnSignal === 'HAZARD'
                              ? telemetry.turnSignalBlinkOn
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-amber-950/90 text-amber-300 border border-amber-500/50'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          ◀ Trái (Z)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            soundRef.current.init();
                            physicsRef.current.toggleTurnSignal('HAZARD');
                            setTelemetry(
                              physicsRef.current.getTelemetrySnapshot()
                            );
                          }}
                          className={`py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            telemetry.turnSignal === 'HAZARD'
                              ? telemetry.turnSignalBlinkOn
                                ? 'bg-rose-600 text-white'
                                : 'bg-rose-950/90 text-rose-300 border border-rose-500/50'
                              : 'bg-slate-950 text-rose-300 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          ▲ Khẩn (V)
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            soundRef.current.init();
                            physicsRef.current.toggleTurnSignal('RIGHT');
                            setTelemetry(
                              physicsRef.current.getTelemetrySnapshot()
                            );
                          }}
                          className={`py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                            telemetry.turnSignal === 'RIGHT' ||
                            telemetry.turnSignal === 'HAZARD'
                              ? telemetry.turnSignalBlinkOn
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-amber-950/90 text-amber-300 border border-amber-500/50'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          Phải (X) ▶
                        </button>
                      </div>
                    </div>

                    {/* 3. Cần Số (Q/E), Cần Phanh Tay (Space) & Còi */}
                    <div className="md:col-span-5 flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-800/80">
                      <div className="flex items-center gap-1.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-700 flex flex-col items-center justify-center shrink-0">
                          <span className="text-[8px] text-slate-400 font-mono leading-none">
                            {telemetry.transmissionMode === 'AUTOMATIC'
                              ? 'AT'
                              : 'MT'}
                          </span>
                          <span
                            className={`text-sm font-extrabold font-mono tabular-nums leading-tight ${
                              telemetry.currentGear === -1
                                ? 'text-rose-400'
                                : telemetry.currentGear === 0
                                ? 'text-amber-400'
                                : 'text-sky-400'
                            }`}
                          >
                            {telemetry.gearLabel}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          {telemetry.transmissionMode === 'AUTOMATIC' ? (
                            <div className="flex items-center gap-0.5">
                              {(['P', 'R', 'N', 'D'] as const).map((pos) => (
                                <button
                                  key={pos}
                                  type="button"
                                  onClick={() => {
                                    soundRef.current.init();
                                    physicsRef.current.selectDirectGearPosition(
                                      pos,
                                      true
                                    );
                                    setTelemetry(
                                      physicsRef.current.getTelemetrySnapshot()
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                                    telemetry.atSelectorPosition === pos
                                      ? 'bg-sky-500 text-slate-950'
                                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                                  }`}
                                >
                                  {pos}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  soundRef.current.init();
                                  physicsRef.current.shiftGearDown(true);
                                  setTelemetry(
                                    physicsRef.current.getTelemetrySnapshot()
                                  );
                                }}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-200"
                              >
                                - (Q)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  soundRef.current.init();
                                  physicsRef.current.shiftGearUp(true);
                                  setTelemetry(
                                    physicsRef.current.getTelemetrySnapshot()
                                  );
                                }}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono font-bold text-slate-200"
                              >
                                + (E)
                              </button>
                              <span
                                className={`px-1 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  telemetry.clutchInput >= 0.9
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                                }`}
                              >
                                Côn {Math.round(telemetry.clutchInput * 100)}%
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={handleToggleTransmission}
                              className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 hover:bg-slate-800 text-[9px] font-mono font-semibold text-sky-400 whitespace-nowrap"
                            >
                              {telemetry.transmissionMode === 'MANUAL'
                                ? 'Số Sàn (MT)'
                                : 'Số Tự Động (AT)'}
                            </button>
                            {telemetry.transmissionMode === 'MANUAL' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = !autoClutchAssist;
                                  setAutoClutchAssist(next);
                                  physicsRef.current.autoClutchEnabled = next;
                                }}
                                className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-semibold whitespace-nowrap ${
                                  !autoClutchAssist
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                                    : 'bg-slate-950 border-slate-700 text-slate-400'
                                }`}
                              >
                                {!autoClutchAssist ? 'Côn Thật' : 'Tự Đỡ Côn'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          soundRef.current.init();
                          soundRef.current.playShiftClick();
                          physicsRef.current.handbrakeActive =
                            !physicsRef.current.handbrakeActive;
                          setTelemetry(
                            physicsRef.current.getTelemetrySnapshot()
                          );
                        }}
                        className={`flex flex-col items-center justify-center px-2 py-1 rounded-lg border text-[10px] font-mono font-bold transition-colors whitespace-nowrap shrink-0 ${
                          telemetry.handbrakeActive
                            ? 'bg-rose-600 border-rose-400 text-white shadow'
                            : 'bg-slate-800 border-slate-600 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        <span>
                          {telemetry.handbrakeActive ? 'PHANH TAY' : 'ĐÃ HẠ (P)'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3B. Multi-Touch Landscape Phone Driving Controls Overlay */}
      {!isTitleScreen && !isPaused && isMobileTouchEnabled && (
        <MobileTouchControls
          touchInputRef={touchInputRef}
          telemetry={telemetry}
          steeringStyle={mobileSteeringStyle}
          isCssRotated90={isCssRotated90}
          onToggleSteeringStyle={() =>
            setMobileSteeringStyle((prev) =>
              prev === 'WHEEL' ? 'BUTTONS' : 'WHEEL'
            )
          }
          onShiftUp={() => {
            soundRef.current.init();
            physicsRef.current.shiftGearUp(true);
            setTelemetry(physicsRef.current.getTelemetrySnapshot());
          }}
          onShiftDown={() => {
            soundRef.current.init();
            physicsRef.current.shiftGearDown(true);
            setTelemetry(physicsRef.current.getTelemetrySnapshot());
          }}
          onToggleTransmission={() => {
            soundRef.current.init();
            handleToggleTransmission();
          }}
          onToggleHandbrake={() => {
            soundRef.current.init();
            physicsRef.current.handbrakeActive =
              !physicsRef.current.handbrakeActive;
            setTelemetry(physicsRef.current.getTelemetrySnapshot());
          }}
          onToggleIgnition={() => {
            soundRef.current.init();
            physicsRef.current.toggleEngineIgnition();
            setTelemetry(physicsRef.current.getTelemetrySnapshot());
          }}
          onToggleTurnSignal={(sig) => {
            soundRef.current.init();
            physicsRef.current.toggleTurnSignal(sig);
            setTelemetry(physicsRef.current.getTelemetrySnapshot());
          }}
          onCycleCamera={() =>
            setCameraMode((prev) =>
              prev === 'CHASE'
                ? 'COCKPIT'
                : prev === 'COCKPIT'
                ? 'HOOD'
                : prev === 'HOOD'
                ? 'ORBIT_INSPECT'
                : prev === 'ORBIT_INSPECT'
                ? 'TOP_DOWN'
                : 'CHASE'
            )
          }
          onRetryExercise={handleRetryCurrent}
          onHornStart={() => soundRef.current.startCarHorn()}
          onHornStop={() => soundRef.current.stopCarHorn()}
        />
      )}

      {/* 4. Pause Overlay Modal */}
      {isPaused &&
        !isTitleScreen &&
        !isCourseModalOpen &&
        !isUnityWorkbenchOpen &&
        !isInspectorOpen &&
        !completedAttemptResult && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3 pointer-events-auto">
            <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-4 shadow-2xl">
              <div>
                <h2 className="text-lg font-bold text-white">
                  Tạm Dừng Mô Phỏng
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {exerciseState.exercise
                    ? exerciseState.exercise.titleVi
                    : 'Chế độ Luyện Tập Tự Do'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => setIsPaused(false)}
                  className="py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition-colors"
                >
                  Tiếp Tục Lái (Esc)
                </button>

                <button
                  onClick={() => {
                    handleRetryCurrent();
                    setIsPaused(false);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  Thực Hiện Lại Bài Này (R)
                </button>

                <button
                  onClick={() => {
                    setIsPaused(false);
                    setIsCourseModalOpen(true);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold transition-colors"
                >
                  Chọn Bài Thi & Hạng Xe (B)
                </button>

                <button
                  onClick={() => {
                    setIsPaused(false);
                    setIsTitleScreen(true);
                  }}
                  className="py-2.5 px-4 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 text-xs font-medium transition-colors"
                >
                  Về Màn Hình Chính
                </button>
              </div>
            </div>
          </div>
        )}

      {/* 5. Course Selection, Vehicle Selector & Practice History Modal */}
      <CourseSelectionModal
        isOpen={isCourseModalOpen}
        onClose={() => setIsCourseModalOpen(false)}
        currentExercise={exerciseState.exercise}
        currentMode={exerciseState.mode}
        currentProfile={profile}
        currentRuleSet={currentRuleSet}
        practiceHistory={practiceHistory}
        onStartExercise={handleLaunchExercise}
        onStartFreePractice={handleLaunchFreePractice}
        onSelectVehicleProfile={(nextVeh) => {
          handleUpdateProfile(nextVeh);
        }}
        onSelectRuleSet={(nextRuleSet) => {
          exerciseEngineRef.current.setScoringRuleSet(nextRuleSet);
          setCurrentRuleSet(nextRuleSet);
          setExerciseState(
            exerciseEngineRef.current.getRuntimeStateSnapshot()
          );
        }}
        onClearHistory={() => {
          exerciseEngineRef.current.clearPracticeHistory();
          setPracticeHistory([]);
        }}
      />

      {/* 6. Exercise Completion / Failure Results Screen (Tiếng Việt) */}
      <ExerciseResultsModal
        result={completedAttemptResult}
        onClose={() => setCompletedAttemptResult(null)}
        onRetryExercise={handleRetryCurrent}
        onNextExercise={handleNextExercise}
        onOpenCourseMenu={() => {
          setCompletedAttemptResult(null);
          setIsCourseModalOpen(true);
        }}
      />

      {/* 7. Unity 6 C# Codebase & Architecture Workbench Modal */}
      <UnityWorkbenchModal
        isOpen={isUnityWorkbenchOpen}
        onClose={() => setIsUnityWorkbenchOpen(false)}
      />

      {/* 8. Live Unity Inspector Physics & Keybindings Tuning Modal */}
      <InspectorTuningModal
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        profile={profile}
        onUpdateProfile={handleUpdateProfile}
        keyBindings={keyBindings}
        onUpdateKeyBindings={setKeyBindings}
      />

      {/* 9. First-Time Player Interactive Tutorial & Quick-Start Onboarding Modal */}
      <FirstTimeTutorialModal
        isOpen={isTutorialModalOpen}
        onClose={() => {
          setIsTutorialModalOpen(false);
          window.focus();
        }}
        onStartWithMode={(mode) => {
          setIsTutorialModalOpen(false);
          handleStartSimulation(mode);
        }}
      />

      {/* 10. 600 Câu Hỏi Ôn Tập & Thi Thử Lý Thuyết Sát Hạch Lái Xe Modal */}
      <TheoryStudyModal
        isOpen={isTheoryModalOpen}
        onClose={() => {
          setIsTheoryModalOpen(false);
          window.focus();
        }}
        defaultCategory={
          profile.category === 'C1'
            ? 'C1'
            : profile.category === 'C'
            ? 'C'
            : 'B'
        }
      />

      {/* 11. Giảng Viên Sát Hạch Ảo & Hệ Thống Chip Chấm Điểm Tự Động (2026) */}
      <InstructorScoringConsoleModal
        isOpen={isInstructorConsoleOpen}
        onClose={() => {
          setIsInstructorConsoleOpen(false);
          window.focus();
        }}
        soundEngine={soundRef.current}
        liveScore={exerciseState.currentScore}
        licenseCategory={profile.category}
        onSyncScoreToSim={(nextScore) => {
          exerciseEngineRef.current.currentScore = nextScore;
          setExerciseState(
            exerciseEngineRef.current.getRuntimeStateSnapshot()
          );
        }}
      />
    </div>
  );
}
