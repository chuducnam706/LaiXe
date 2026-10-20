export interface UnityCSharpFileSpec {
  id: string;
  fileName: string;
  relativePath: string;
  namespaceName: string;
  summaryVi: string;
  inspectorRefs: Array<{
    field: string;
    type: string;
    recommendedValue: string;
    descriptionVi: string;
  }>;
  code: string;
}

export const UNITY_SCENE_AND_PREFAB_HIERARCHY = `TestDrivingCourse_Vietnam (Unity 6 LTS Scene — URP)
│
├── [01] Course_Management_Systems   (Hệ thống Quản lý Sân Tập, Bài Thi & Chấm Điểm)
│   ├── CourseManager                (CourseManager.cs — Tham chiếu DrivingCourseDefinition SO)
│   ├── ExerciseManager              (ExerciseManager.cs — Điều phối Checkpoint, Timer, Hoàn thành/Trượt)
│   └── ScoringService               (ScoringService.cs — Tham chiếu ScoringRuleSet SO có phiên bản)
│
├── [02] Environment_Static          (Mặt đường nhựa, Vạch kẻ, Cầu dốc 10%, Chuồng đỗ, Biển báo)
│   ├── Visual_Meshes
│   │   ├── Road_Asphalt_Network     (Đường thẳng 88m, Ngã tư trung tâm, Nhánh Đông & Sân đỗ)
│   │   ├── Ramp_10Percent_Visual    (Cầu dốc Đề-pa 10%: 18m Lên / 8m Đỉnh / 18m Xuống)
│   │   ├── ParkingBays_Markings     (Chuồng ghép dọc & ngang có vạch giới hạn vàng/trắng)
│   │   └── TrafficSigns_Group       (Cổng Xuất Phát, Biển Dừng Ngã Tư, Biển Cầu Dốc, Cổng Đích)
│   └── Physics_Colliders            (Layer: Ground / Obstacle — Tách biệt khỏi Mesh hiển thị)
│       ├── Ground_BoxCollider       (BoxCollider: Size [102, 1.0, 102], Center [0, -0.5, 0])
│       ├── Ramp_Slope_Colliders     (3x BoxCollider: Approach +5.71°, Crest 0°, Descent -5.71°)
│       └── Solid_Barriers_Group     (BoxColliders: Thành cầu dốc, tường chuồng ghép xe, rào chắn)
│
├── [03] Course_Checkpoints_And_Zones (Các Prefab Checkpoint & Hành lang giới hạn cho từng bài tập)
│   ├── Exercise_01_StartAndRoute_Root
│   │   ├── CP_00_StartGate          (Checkpoint.cs + BoxCollider [isTrigger=true, Size: 8.0 x 3.0 x 3.0])
│   │   ├── CP_01_DesignatedStopBox  (Checkpoint.cs [requiresFullStop=true, stopDuration=1.5s])
│   │   ├── CP_02_MidLaneGate        (Checkpoint.cs [requiresFullStop=false])
│   │   ├── CP_03_FinishStopBox      (Checkpoint.cs [requiresFullStop=true, isFinishLine=true])
│   │   └── BoundaryTriggers_Ex01    (BoxColliders [isTrigger=true, Tag="BoundaryZone"] dọc 2 mép làn)
│   └── Exercise_02_to_08_Roots      (Cấu trúc tương tự, kích hoạt động qua ExerciseManager)
│
├── [04] Dynamic_Props
│   └── TrafficCones_Container       (14x Cone Prefabs: Rigidbody [1.8 kg] + Convex MeshCollider [Tag="ObstacleCone"])
│
├── [05] Vehicle_CategoryB_Sedan     (Root Prefab — Layer: Vehicle)
│   │   [Components on Root]:
│   │   • Rigidbody (Mass = 1280 kg, Interpolate = Interpolate, CollisionDetection = ContinuousDynamic)
│   │   • VehicleInputHandler.cs
│   │   • VehicleTransmission.cs
│   │   • VehicleController.cs
│   │   • VehicleVisualsController.cs (Điều khiển ngoại thất/buồng lái 3D, đèn pha/phanh/lùi/xi-nhan 1.5Hz, cùm phanh & mâm xe tách rời)
│   │   • VehicleTelemetry.cs
│   │   • DrivingViolationDetector.cs (Phát hiện đè vạch, đâm cọc tiêu, chết máy, trôi dốc với chống lặp frame)
│   ├── CenterOfMass_Pivot           (Transform: LocalPos [0.00, 0.32, 0.14])
│   ├── Body_Colliders               (LowerHull_Collider & Cabin_Collider — Tách biệt khỏi Mesh ngoại thất)
│   ├── WheelColliders_Root          (WC_FrontLeft, WC_FrontRight, WC_RearLeft, WC_RearRight)
│   ├── Visuals_Root
│   │   ├── Exterior_Body_Group      (Contoured_BodyShell, Hood_Mesh, Doors_FL..RR, Trunk_Mesh, WheelArches, Bumpers, Grille, Mirrors_L_R, RoofSign_XeTapLai)
│   │   ├── Exterior_Lights_Group    (Headlights_SpotL_R [Low/High Beam], Taillights_Brake_CHMSL, ReverseLights_L_R, TurnIndicators_FL_FR_RL_RR_Mirror)
│   │   ├── Cockpit_Interior_Group   (Dashboard_Binnacle, InstrumentCluster_Canvas, SteeringWheel_Pivot, GearShifter_Pivot, Handbrake_Pivot, Pedals_Clutch_Brake_Throttle, Seats_Driver_Instructor)
│   │   └── Wheels_Visual_Root
│   │       ├── WheelKnuckle_FL..RR  (Theo vị trí + góc lái WheelCollider — Chứa BrakeCaliper_Mesh cố định không quay theo lốp)
│   │       └── WheelSpin_FL..RR     (Con của WheelKnuckle — Quay quanh trục X theo tốc độ lăn: Tire_195_65_R15, AlloyRim_5TwinSpoke, BrakeDisc_Mesh)
│   └── Camera_Anchors               (ChaseCamera_Target, CockpitDriverEye_Mount, HoodCamera_Mount, OrbitInspect_Pivot)
│
└── [06] Cameras_And_UI
    ├── MainCamera                   (Camera + VehicleCameraController.cs — 4 Chế độ: Chase, Cockpit, Hood, 360° Orbit)
    └── DrivingHUD_And_Menus_Canvas  (DrivingHUD.cs + CourseSelectionUI.cs + ResultsUI.cs)`;

export const UNITY_CSHARP_FILES: UnityCSharpFileSpec[] = [
  {
    id: 'vehicle_profile',
    fileName: 'VehicleProfile.cs',
    relativePath: 'Assets/Scripts/Vehicles/VehicleProfile.cs',
    namespaceName: 'VietnamDrivingSim.Vehicles',
    summaryVi:
      'ScriptableObject lưu trữ toàn bộ thông số vật lý theo từng hạng giấy phép lái xe Việt Nam (Hạng B, C1, C, D1, D2, D theo Luật TTATGTĐB 2024): khối lượng, chiều dài cơ sở, trọng tâm, biểu đồ mô-men xoắn, tỷ số truyền, điểm bám côn, giảm xóc và độ bám lốp.',
    inspectorRefs: [
      {
        field: 'licenseCategory',
        type: 'VietnameseLicenseCategory',
        recommendedValue: 'CategoryB',
        descriptionVi: 'Hạng giấy phép lái xe (B, C1, C, D1, D2, D).',
      },
      {
        field: 'massKg',
        type: 'float',
        recommendedValue: '1280f',
        descriptionVi: 'Khối lượng toàn bộ xe (kg) áp dụng cho Rigidbody.',
      },
      {
        field: 'centerOfMassOffset',
        type: 'Vector3',
        recommendedValue: '(0f, 0.32f, 0.14f)',
        descriptionVi: 'Tọa độ trọng tâm cục bộ giúp xe ổn định khi vào cua và lên dốc.',
      },
      {
        field: 'maxEngineTorqueNm',
        type: 'float',
        recommendedValue: '148f',
        descriptionVi: 'Mô-men xoắn cực đại của động cơ (Nm) tại 4.000 RPM.',
      },
    ],
    code: `using UnityEngine;

namespace VietnamDrivingSim.Vehicles
{
    /// <summary>
    /// Phân hạng giấy phép lái xe theo Luật Trật tự, an toàn giao thông đường bộ 2024 (hiệu lực 2025).
    /// </summary>
    public enum VietnameseLicenseCategory
    {
        CategoryB,   // Ô tô chở người đến 8 chỗ (không kể người lái); xe tải đến 3.500 kg
        CategoryC1,  // Ô tô tải trên 3.500 kg đến 7.500 kg
        CategoryC,   // Ô tô tải trên 7.500 kg
        CategoryD1,  // Ô tô chở người trên 8 chỗ đến 16 chỗ
        CategoryD2,  // Ô tô chở người trên 16 chỗ đến 29 chỗ
        CategoryD    // Ô tô chở người trên 29 chỗ; xe giường nằm
    }

    public enum DriveTrainType
    {
        FWD, // Dẫn động cầu trước
        RWD, // Dẫn động cầu sau
        AWD  // Dẫn động 4 bánh toàn thời gian
    }

    [CreateAssetMenu(fileName = "SO_VehicleProfile_CatB", menuName = "VietnamDrivingSim/Vehicle Profile", order = 1)]
    public class VehicleProfile : ScriptableObject
    {
        [Header("1. Định Danh & Phân Hạng (Tiếng Việt)")]
        public string vehicleNameVi = "Sedan Tập Lái Hạng B (1.5L)";
        public VietnameseLicenseCategory licenseCategory = VietnameseLicenseCategory.CategoryB;
        [TextArea(2, 4)]
        public string descriptionVi = "Xe con 5 chỗ tiêu chuẩn đào tạo và sát hạch lái xe Hạng B.";

        [Header("2. Khối Lượng & Hình Học Khung Gầm (SI: kg, m)")]
        [Range(800f, 20000f)]
        public float massKg = 1280f;
        public float wheelbaseM = 2.58f;
        public float trackWidthM = 1.50f;
        public Vector3 centerOfMassOffset = new Vector3(0f, 0.32f, 0.14f);

        [Header("3. Động Cơ & Đường Đặc Tính Mô-Men Xoắn (Nm / RPM)")]
        public DriveTrainType driveType = DriveTrainType.FWD;
        [Range(80f, 2500f)]
        public float maxEngineTorqueNm = 148f;
        public AnimationCurve normalizedTorqueCurve = new AnimationCurve(
            new Keyframe(500f, 0.52f),
            new Keyframe(800f, 0.66f),
            new Keyframe(2500f, 0.92f),
            new Keyframe(4000f, 1.00f),
            new Keyframe(5200f, 0.94f),
            new Keyframe(6300f, 0.75f),
            new Keyframe(6800f, 0.20f)
        );
        public float idleRpm = 800f;
        public float redlineRpm = 6300f;
        public float stallRpm = 460f;
        [Range(0.05f, 0.5f)]
        public float engineBrakingCoefficient = 0.18f;

        [Header("4. Hộp Số & Ly Hợp (Côn)")]
        public float reverseGearRatio = -3.45f;
        public float[] forwardGearRatios = new float[] { 3.54f, 1.95f, 1.31f, 0.97f, 0.78f };
        public float finalDriveRatio = 4.12f;
        [Range(0.15f, 0.55f)] public float clutchBiteMin = 0.35f;
        [Range(0.55f, 0.90f)] public float clutchBiteMax = 0.68f;

        [Header("5. Hệ Thống Lái Phụ Thuộc Tốc Độ")]
        [Range(20f, 45f)] public float maxSteerAngleLowSpeed = 35f;
        [Range(5f, 20f)] public float minSteerAngleHighSpeed = 11f;
        public float maxSpeedForSteerReductionKmh = 90f;
        public float steeringRateDegPerSec = 135f;

        [Header("6. Hệ Thống Phanh Chính & Phanh Tay (Nm)")]
        public float serviceBrakeTorqueNm = 2900f;
        [Range(0.5f, 0.8f)] public float frontBrakeBias = 0.65f;
        public float handbrakeTorqueNm = 3400f;

        [Header("7. Hệ Thống Treo & Lốp (WheelCollider)")]
        public float wheelRadiusM = 0.315f;
        public float wheelMassKg = 18f;
        public float suspensionDistanceM = 0.16f;
        public float suspensionSpringNm = 31000f;
        public float suspensionDamperNsm = 4100f;
        [Range(0.2f, 0.8f)] public float suspensionTargetPosition = 0.5f;
        [Range(0.5f, 2.5f)] public float forwardFrictionStiffness = 1.25f;
        [Range(0.5f, 2.5f)] public float sidewaysFrictionStiffness = 1.32f;

        public float EvaluateEngineTorque(float currentRpm)
        {
            float factor = Mathf.Clamp01(normalizedTorqueCurve.Evaluate(currentRpm));
            return maxEngineTorqueNm * factor;
        }
    }
}
`,
  },
  {
    id: 'driving_exercise_definition',
    fileName: 'DrivingExerciseDefinition.cs',
    relativePath: 'Assets/Scripts/Exercises/DrivingExerciseDefinition.cs',
    namespaceName: 'VietnamDrivingSim.Exercises',
    summaryVi:
      'ScriptableObject cấu hình từng bài tập độc lập (Bài 1 đến Bài 8): vị trí/hướng xuất phát, danh sách hướng dẫn Tiếng Việt, giới hạn thời gian, điều kiện hoàn thành/trượt, và nhãn xác minh quy chuẩn (Provisional vs. Official Verified).',
    inspectorRefs: [
      {
        field: 'exerciseCode / titleVi',
        type: 'string',
        recommendedValue: '"BAI_01" / "Bài 1: Xuất phát và đi theo lộ trình"',
        descriptionVi: 'Mã định danh và tên bài tập hiển thị bằng Tiếng Việt.',
      },
      {
        field: 'isOfficialLayoutVerified',
        type: 'bool',
        recommendedValue: 'false (Provisional Training Layout)',
        descriptionVi: 'Chỉ bật true khi kích thước hình học và quy tắc chấm điểm đã được xác minh chính thức.',
      },
      {
        field: 'timeLimitSeconds',
        type: 'float',
        recommendedValue: '120f',
        descriptionVi: 'Thời gian tối đa thực hiện bài tập (giây).',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Vehicles;

namespace VietnamDrivingSim.Exercises
{
    [CreateAssetMenu(fileName = "SO_Exercise_01", menuName = "VietnamDrivingSim/Driving Exercise Definition", order = 2)]
    public class DrivingExerciseDefinition : ScriptableObject
    {
        [Header("1. Định Danh & Phân Hạng Áp Dụng")]
        public string exerciseId = "ex_01_start_and_route";
        public int exerciseNumber = 1;
        public string exerciseCode = "BAI_01";
        public string titleVi = "Bài 1: Xuất phát, dừng xe đúng vị trí và đi theo lộ trình";
        [TextArea(2, 3)]
        public string subtitleVi = "Khởi hành qua vạch xuất phát, giữ đúng làn, dừng xe tại ô quy định và về đích.";
        public VietnameseLicenseCategory[] applicableCategories = new VietnameseLicenseCategory[]
        {
            VietnameseLicenseCategory.CategoryB,
            VietnameseLicenseCategory.CategoryC1
        };

        [Header("2. Trạng Thái Xác Minh Quy Chuẩn (Verification Status)")]
        [Tooltip("Chỉ đánh dấu true khi kích thước sân và quy chuẩn sát hạch đã được kiểm chứng chính thức")]
        public bool isOfficialLayoutVerified = false;
        [TextArea(2, 3)]
        public string dimensionVerificationNoteVi = "Kích thước huấn luyện tạm tính (Provisional): Làn rộng 8.4m, lộ trình dài 72m.";

        [Header("3. Vị Trí & Hướng Xuất Phát (Start Pose)")]
        public Vector3 startPosition = new Vector3(0f, 0.72f, 40f);
        public Vector3 startEulerRotation = Vector3.zero;

        [Header("4. Hướng Dẫn & Điều Kiện Đạt / Trượt (Tiếng Việt)")]
        [TextArea(2, 4)]
        public string[] stepByStepInstructionsVi = new string[]
        {
            "1. Kiểm tra số 1, hạ phanh tay (Space) và tiến qua Cổng Xuất Phát #1.",
            "2. Giữ xe đi thẳng trong vạch giới hạn làn đường, không chạm cọc tiêu.",
            "3. Giảm tốc độ và DỪNG HẲN XE trong 1.5 giây tại Ô Dừng Quy Định #2.",
            "4. Tiến qua Cổng Giữa Sân #3 và dừng hẳn tại Vạch Đích #4 để hoàn thành."
        };

        [TextArea(2, 3)]
        public string completionConditionVi = "Đi qua đủ các Checkpoint theo đúng thứ tự và dừng đúng tại Vạch Đích với điểm >= ngưỡng đạt.";

        [TextArea(2, 3)]
        public string failureConditionVi = "Điểm số tụt dưới mức tối thiểu hoặc vượt quá thời gian quy định.";

        [Header("5. Giới Hạn Thời Gian")]
        [Range(30f, 600f)]
        public float timeLimitSeconds = 120f;
    }
}
`,
  },
  {
    id: 'driving_course_definition',
    fileName: 'DrivingCourseDefinition.cs',
    relativePath: 'Assets/Scripts/Exercises/DrivingCourseDefinition.cs',
    namespaceName: 'VietnamDrivingSim.Exercises',
    summaryVi:
      'ScriptableObject định nghĩa toàn bộ khóa huấn luyện / sân tập tổng hợp gồm danh sách các bài tập (DrivingExerciseDefinition) và bộ quy tắc chấm điểm (ScoringRuleSet) tương ứng.',
    inspectorRefs: [
      {
        field: 'exercises',
        type: 'DrivingExerciseDefinition[]',
        recommendedValue: 'Danh sách 8 SO_Exercise (Bài 1 -> Bài 8)',
        descriptionVi: 'Mảng các bài tập cấu thành khóa luyện tập hoặc lộ trình thi thử.',
      },
      {
        field: 'defaultRuleSet',
        type: 'ScoringRuleSet',
        recommendedValue: 'SO_ScoringRuleSet_Training_v1',
        descriptionVi: 'Bộ quy tắc chấm điểm có phiên bản áp dụng cho khóa học.',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Scoring;
using VietnamDrivingSim.Vehicles;

namespace VietnamDrivingSim.Exercises
{
    [CreateAssetMenu(fileName = "SO_DrivingCourse_CatB", menuName = "VietnamDrivingSim/Driving Course Definition", order = 3)]
    public class DrivingCourseDefinition : ScriptableObject
    {
        [Header("Thông Tin Sân Tập & Khóa Huấn Luyện")]
        public string courseId = "vn_sa_hinh_course_v1";
        public string courseNameVi = "Sân Tập Thực Hành Lái Xe Tổng Hợp (8 Bài Tập Mô-đun)";
        public string version = "1.0.0-PROVISIONAL";
        public VietnameseLicenseCategory primaryCategory = VietnameseLicenseCategory.CategoryB;

        [TextArea(2, 4)]
        public string descriptionVi = "Hệ thống sân tập mô-đun tích hợp 8 bài luyện tập từ cơ bản đến liên hoàn.";

        [Header("Danh Sách Bài Tập & Bộ Quy Tắc Chấm Điểm")]
        public ScoringRuleSet defaultRuleSet;
        public DrivingExerciseDefinition[] exercises;
    }
}
`,
  },
  {
    id: 'checkpoint_script',
    fileName: 'Checkpoint.cs',
    relativePath: 'Assets/Scripts/Exercises/Checkpoint.cs',
    namespaceName: 'VietnamDrivingSim.Exercises',
    summaryVi:
      'Component gắn lên các cổng kiểm tra 3D và ô dừng xe trên sân tập. Hỗ trợ kiểm tra thứ tự (orderIndex), yêu cầu dừng hẳn xe trong khoảng thời gian quy định (requiresFullStop / requiredStopDuration), và kiểm tra số bắt buộc (ví dụ Số Lùi R khi ghép xe).',
    inspectorRefs: [
      {
        field: 'orderIndex',
        type: 'int',
        recommendedValue: '0, 1, 2, 3...',
        descriptionVi: 'Thứ tự bắt buộc của Checkpoint trong chuỗi bài tập.',
      },
      {
        field: 'requiresFullStop / requiredStopDurationS',
        type: 'bool / float',
        recommendedValue: 'true / 1.5f (Cho ô dừng quy định & vạch đích)',
        descriptionVi: 'Bắt buộc xe phải dừng hẳn (< 0.8 km/h) trong ô đủ số giây quy định.',
      },
      {
        field: 'enforceRequiredGear / requiredGear',
        type: 'bool / int',
        recommendedValue: 'true / -1 (Cho bài lùi chuồng Số R)',
        descriptionVi: 'Kiểm tra xe có đang cài đúng cấp số yêu cầu hay không.',
      },
    ],
    code: `using System;
using UnityEngine;
using VietnamDrivingSim.Vehicle;

namespace VietnamDrivingSim.Exercises
{
    [RequireComponent(typeof(BoxCollider))]
    public class Checkpoint : MonoBehaviour
    {
        [Header("1. Thứ Tự & Hướng Dẫn Tiếng Việt")]
        public int orderIndex = 0;
        public string checkpointNameVi = "Cổng Kiểm Tra";
        [TextArea(1, 3)]
        public string instructionVi = "Điều khiển xe đi qua cổng kiểm tra";
        public bool isFinishLine = false;

        [Header("2. Điều Kiện Dừng Xe & Cấp Số")]
        [Tooltip("Nếu bật, xe phải dừng hẳn (< 0.8 km/h) bên trong vùng Trigger đủ thời gian quy định")]
        public bool requiresFullStop = false;
        [Range(0.5f, 5.0f)]
        public float requiredStopDurationS = 1.5f;

        [Tooltip("Nếu bật, xe phải đang cài đúng số yêu cầu (ví dụ -1 cho Số Lùi R)")]
        public bool enforceRequiredGear = false;
        public int requiredGear = -1;

        [Header("3. Hiển Thị Trực Quan (Visual Feedback)")]
        [SerializeField] private Renderer gateVisualRenderer;
        [SerializeField] private Color activeGateColor = new Color(0.06f, 0.72f, 0.50f, 0.65f);
        [SerializeField] private Color stopRequiredColor = new Color(0.96f, 0.62f, 0.04f, 0.65f);
        [SerializeField] private Color inactiveGateColor = new Color(0.22f, 0.74f, 0.97f, 0.25f);

        public float CurrentStopHoldTime { get; private set; }
        public bool IsCompleted { get; private set; }

        public event Action<Checkpoint> OnCheckpointTriggered;

        private BoxCollider _triggerCollider;

        private void Awake()
        {
            _triggerCollider = GetComponent<BoxCollider>();
            _triggerCollider.isTrigger = true;
        }

        public void ResetCheckpoint(bool isCurrentTarget)
        {
            IsCompleted = false;
            CurrentStopHoldTime = 0f;
            UpdateVisualState(isCurrentTarget);
        }

        public void UpdateVisualState(bool isCurrentTarget)
        {
            if (gateVisualRenderer == null) return;
            if (IsCompleted)
            {
                gateVisualRenderer.gameObject.SetActive(false);
                return;
            }

            gateVisualRenderer.gameObject.SetActive(true);
            Color c = isCurrentTarget
                ? (requiresFullStop ? stopRequiredColor : activeGateColor)
                : inactiveGateColor;
            gateVisualRenderer.material.color = c;
        }

        private void OnTriggerStay(Collider other)
        {
            if (IsCompleted) return;

            VehicleController vehicle = other.GetComponentInParent<VehicleController>();
            if (vehicle == null) return;

            if (enforceRequiredGear && vehicle.Transmission.CurrentGear != requiredGear)
            {
                return;
            }

            if (!requiresFullStop)
            {
                CompleteCheckpoint();
            }
            else
            {
                if (vehicle.CurrentSpeedKmh < 0.85f)
                {
                    CurrentStopHoldTime += Time.deltaTime;
                    if (CurrentStopHoldTime >= requiredStopDurationS)
                    {
                        CompleteCheckpoint();
                    }
                }
                else
                {
                    CurrentStopHoldTime = Mathf.Max(0f, CurrentStopHoldTime - Time.deltaTime * 0.5f);
                }
            }
        }

        private void OnTriggerExit(Collider other)
        {
            if (other.GetComponentInParent<VehicleController>() != null)
            {
                CurrentStopHoldTime = 0f;
            }
        }

        private void CompleteCheckpoint()
        {
            IsCompleted = true;
            UpdateVisualState(false);
            OnCheckpointTriggered?.Invoke(this);
        }
    }
}
`,
  },
  {
    id: 'scoring_service',
    fileName: 'ScoringService.cs',
    relativePath: 'Assets/Scripts/Scoring/ScoringService.cs',
    namespaceName: 'VietnamDrivingSim.Scoring',
    summaryVi:
      'Dịch vụ chấm điểm độc lập nhận các sự kiện vi phạm đã được xác thực. Hỗ trợ bộ quy tắc có phiên bản (ScoringRuleSet ScriptableObject), chống trừ điểm lặp lại theo từng frame cho cùng một lỗi kéo dài, và xuất báo cáo Tiếng Việt.',
    inspectorRefs: [
      {
        field: 'activeRuleSet',
        type: 'ScoringRuleSet (ScriptableObject)',
        recommendedValue: 'SO_ScoringRuleSet_Training_v1',
        descriptionVi: 'Bộ quy tắc cấu hình mức trừ điểm và thời gian khóa lặp lỗi (cooldown).',
      },
    ],
    code: `using System;
using System.Collections.Generic;
using UnityEngine;

namespace VietnamDrivingSim.Scoring
{
    public enum DrivingViolationType
    {
        ObstacleOrConeHit,       // Va chạm cọc tiêu hoặc chướng ngại vật
        BoundaryCrossed,         // Bánh xe đè hoặc vượt vạch giới hạn làn đường
        MissedCheckpoint,        // Bỏ qua hoặc đi sai thứ tự Checkpoint
        IncorrectStopPosition,   // Dừng xe ngoài ô quy định
        EngineStalled,           // Để chết máy động cơ (Số Sàn)
        HandbrakeDriving,        // Lái xe khi chưa hạ phanh tay
        SlopeRollback,           // Trôi dốc quá giới hạn khi Đề-pa
        TimeLimitExceeded        // Vượt quá thời gian quy định
    }

    [Serializable]
    public class ViolationRuleEntry
    {
        public DrivingViolationType violationType;
        public string titleVi;
        [TextArea(1, 2)] public string explanationVi;
        [TextArea(1, 2)] public string correctiveFeedbackVi;
        public int pointsDeducted = 5;
        public bool isImmediateDisqualification = false;
        [Tooltip("Thời gian tối thiểu (giây) giữa 2 lần ghi nhận cùng 1 lỗi để tránh trừ điểm mỗi frame")]
        public float cooldownSeconds = 3.0f;
    }

    [CreateAssetMenu(fileName = "SO_ScoringRuleSet_Training_v1", menuName = "VietnamDrivingSim/Scoring Rule Set", order = 4)]
    public class ScoringRuleSet : ScriptableObject
    {
        public string ruleSetId = "vn_training_ruleset_v1_provisional";
        public string version = "1.0.0-PROVISIONAL";
        public string ruleSetNameVi = "Bộ Quy Tắc Đánh Giá Thực Hành (Cấu Hình Huấn Luyện v1.0)";
        public bool isOfficialRegulationVerified = false;
        public int initialScore = 100;
        public int passingThresholdScore = 80;
        public List<ViolationRuleEntry> rules = new List<ViolationRuleEntry>();

        public ViolationRuleEntry GetRule(DrivingViolationType type)
        {
            return rules.Find(r => r.violationType == type);
        }
    }

    [Serializable]
    public struct RecordedViolationEvent
    {
        public DrivingViolationType violationType;
        public float timestampSeconds;
        public string titleVi;
        public string explanationVi;
        public string correctiveFeedbackVi;
        public int pointsDeducted;
    }

    public class ScoringService : MonoBehaviour
    {
        [Header("Bộ Quy Tắc Chấm Điểm Đang Áp Dụng")]
        [SerializeField] private ScoringRuleSet activeRuleSet;

        public int CurrentScore { get; private set; } = 100;
        public int PassingScore => activeRuleSet != null ? activeRuleSet.passingThresholdScore : 80;
        public bool IsDisqualified { get; private set; }
        public IReadOnlyList<RecordedViolationEvent> RecordedViolations => _violations;

        public event Action<RecordedViolationEvent> OnViolationRecorded;
        public event Action<string> OnDisqualificationTriggered;

        private readonly List<RecordedViolationEvent> _violations = new List<RecordedViolationEvent>();
        private readonly Dictionary<DrivingViolationType, float> _lastViolationTime = new Dictionary<DrivingViolationType, float>();
        private float _sessionStartTime;

        public void ResetScoringSession(ScoringRuleSet customRuleSet = null)
        {
            if (customRuleSet != null) activeRuleSet = customRuleSet;

            CurrentScore = activeRuleSet != null ? activeRuleSet.initialScore : 100;
            IsDisqualified = false;
            _violations.Clear();
            _lastViolationTime.Clear();
            _sessionStartTime = Time.time;
        }

        /// <summary>
        /// Ghi nhận một sự kiện vi phạm đã được kiểm chứng, tự động lọc bỏ các vi phạm liên tục trong thời gian Cooldown.
        /// </summary>
        public bool TryReportViolation(DrivingViolationType type)
        {
            if (activeRuleSet == null || IsDisqualified) return false;

            ViolationRuleEntry rule = activeRuleSet.GetRule(type);
            if (rule == null) return false;

            float now = Time.time;
            if (_lastViolationTime.TryGetValue(type, out float lastTime))
            {
                if (now - lastTime < rule.cooldownSeconds)
                {
                    return false; // Ngăn chặn trừ điểm lặp lại mỗi frame cho một lỗi kéo dài
                }
            }

            _lastViolationTime[type] = now;
            CurrentScore = Mathf.Max(0, CurrentScore - rule.pointsDeducted);

            RecordedViolationEvent evt = new RecordedViolationEvent
            {
                violationType = type,
                timestampSeconds = now - _sessionStartTime,
                titleVi = rule.titleVi,
                explanationVi = rule.explanationVi,
                correctiveFeedbackVi = rule.correctiveFeedbackVi,
                pointsDeducted = rule.pointsDeducted
            };

            _violations.Add(evt);
            OnViolationRecorded?.Invoke(evt);

            if (rule.isImmediateDisqualification || CurrentScore < 50)
            {
                IsDisqualified = true;
                OnDisqualificationTriggered?.Invoke(rule.titleVi);
            }

            return true;
        }
    }
}
`,
  },
  {
    id: 'driving_violation_detector',
    fileName: 'DrivingViolationDetector.cs',
    relativePath: 'Assets/Scripts/Scoring/DrivingViolationDetector.cs',
    namespaceName: 'VietnamDrivingSim.Scoring',
    summaryVi:
      'Bộ cảm biến phát hiện lỗi gắn trên xe: tự động phát hiện va chạm cọc tiêu/chướng ngại vật, đè vạch giới hạn làn đường, chết máy động cơ, lái xe khi quên hạ phanh tay, và trôi dốc khi Đề-pa. Sử dụng chốt trạng thái (State Latch) để một vi phạm kéo dài chỉ bị tính 1 lần duy nhất.',
    inspectorRefs: [
      {
        field: 'scoringService',
        type: 'ScoringService',
        recommendedValue: 'ScoringService trong Scene',
        descriptionVi: 'Dịch vụ chấm điểm nhận các sự kiện vi phạm.',
      },
      {
        field: 'maxAllowedSlopeRollbackM',
        type: 'float',
        recommendedValue: '0.50f',
        descriptionVi: 'Quãng đường trôi lùi tối đa cho phép trên dốc trước khi tính lỗi.',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Vehicle;

namespace VietnamDrivingSim.Scoring
{
    [RequireComponent(typeof(VehicleController))]
    public class DrivingViolationDetector : MonoBehaviour
    {
        [Header("Tham Chiếu Hệ Thống Chấm Điểm")]
        [SerializeField] private ScoringService scoringService;

        [Header("Ngưỡng Phát Hiện Lỗi Thực Hành")]
        [Tooltip("Quãng đường trôi lùi tối đa trên dốc (m) trước khi báo lỗi Đề-pa")]
        public float maxAllowedSlopeRollbackM = 0.50f;
        public string boundaryTriggerTag = "BoundaryZone";
        public string obstacleTag = "ObstacleCone";

        private VehicleController _vehicle;
        private bool _stallLatched;
        private bool _handbrakeDriveLatched;
        private bool _boundaryLatched;
        private float _boundaryClearTimer;
        private float _maxForwardProgressOnSlope;
        private bool _onSlopeActive;

        private void Awake()
        {
            _vehicle = GetComponent<VehicleController>();
        }

        public void ResetDetectorState()
        {
            _stallLatched = false;
            _handbrakeDriveLatched = false;
            _boundaryLatched = false;
            _boundaryClearTimer = 0f;
            _onSlopeActive = false;
        }

        private void FixedUpdate()
        {
            if (scoringService == null || _vehicle == null) return;

            // 1. Kiểm tra lỗi Chết Máy (Chỉ ghi nhận 1 lần cho mỗi sự cố chết máy)
            if (_vehicle.Transmission.IsStalled)
            {
                if (!_stallLatched)
                {
                    _stallLatched = true;
                    scoringService.TryReportViolation(DrivingViolationType.EngineStalled);
                }
            }
            else
            {
                _stallLatched = false;
            }

            // 2. Kiểm tra lỗi Lái Xe Quên Hạ Phanh Tay (> 6 km/h)
            if (_vehicle.InputHandler.HandbrakeActive && _vehicle.CurrentSpeedKmh > 6.0f)
            {
                if (!_handbrakeDriveLatched)
                {
                    _handbrakeDriveLatched = true;
                    scoringService.TryReportViolation(DrivingViolationType.HandbrakeDriving);
                }
            }
            else if (!_vehicle.InputHandler.HandbrakeActive || _vehicle.CurrentSpeedKmh < 1.0f)
            {
                _handbrakeDriveLatched = false;
            }

            // 3. Mở khóa chốt đè vạch sau khi xe đã trở lại làn hợp lệ đủ 1.2 giây
            if (_boundaryLatched)
            {
                _boundaryClearTimer += Time.fixedDeltaTime;
                if (_boundaryClearTimer >= 1.2f)
                {
                    _boundaryLatched = false;
                }
            }

            // 4. Kiểm tra lỗi Trôi Dốc khi đang ở trên dốc (> 3.5 độ)
            float pitchDeg = -transform.eulerAngles.x;
            if (pitchDeg < -180f) pitchDeg += 360f;

            if (pitchDeg > 3.5f)
            {
                float forwardProj = Vector3.Dot(transform.position, transform.forward);
                if (!_onSlopeActive)
                {
                    _onSlopeActive = true;
                    _maxForwardProgressOnSlope = forwardProj;
                }
                else
                {
                    if (forwardProj > _maxForwardProgressOnSlope)
                    {
                        _maxForwardProgressOnSlope = forwardProj;
                    }
                    else if (_maxForwardProgressOnSlope - forwardProj > maxAllowedSlopeRollbackM)
                    {
                        scoringService.TryReportViolation(DrivingViolationType.SlopeRollback);
                        _maxForwardProgressOnSlope = forwardProj;
                    }
                }
            }
            else
            {
                _onSlopeActive = false;
            }
        }

        private void OnCollisionEnter(Collision collision)
        {
            if (scoringService == null) return;

            if (collision.gameObject.CompareTag(obstacleTag) || collision.relativeVelocity.magnitude > 1.1f)
            {
                scoringService.TryReportViolation(DrivingViolationType.ObstacleOrConeHit);
            }
        }

        private void OnTriggerEnter(Collider other)
        {
            if (scoringService == null) return;

            if (other.CompareTag(boundaryTriggerTag))
            {
                _boundaryClearTimer = 0f;
                if (!_boundaryLatched)
                {
                    _boundaryLatched = true;
                    scoringService.TryReportViolation(DrivingViolationType.BoundaryCrossed);
                }
            }
        }

        private void OnTriggerStay(Collider other)
        {
            if (other.CompareTag(boundaryTriggerTag))
            {
                _boundaryClearTimer = 0f;
            }
        }
    }
}
`,
  },
  {
    id: 'exercise_manager',
    fileName: 'ExerciseManager.cs',
    relativePath: 'Assets/Scripts/Exercises/ExerciseManager.cs',
    namespaceName: 'VietnamDrivingSim.Exercises',
    summaryVi:
      'Quản lý vòng đời của một bài tập (Bắt đầu, Đang thực hiện, Tạm dừng, Đặt lại, Hoàn thành hoặc Không đạt). Kiểm soát chuỗi Checkpoint theo đúng thứ tự, đồng hồ đếm ngược và kích hoạt màn hình Kết Quả Tiếng Việt.',
    inspectorRefs: [
      {
        field: 'activeExercise',
        type: 'DrivingExerciseDefinition',
        recommendedValue: 'SO_Exercise_01',
        descriptionVi: 'Bài tập hiện tại đang được nạp trên sân.',
      },
      {
        field: 'orderedCheckpoints',
        type: 'Checkpoint[]',
        recommendedValue: 'Danh sách các Checkpoint theo thứ tự 0..N',
        descriptionVi: 'Mảng các cổng Checkpoint thuộc bài tập hiện tại.',
      },
    ],
    code: `using System;
using UnityEngine;
using VietnamDrivingSim.Scoring;
using VietnamDrivingSim.Vehicle;

namespace VietnamDrivingSim.Exercises
{
    public enum ExerciseState
    {
        NotStarted,
        InProgress,
        Completed,
        Failed
    }

    public class ExerciseManager : MonoBehaviour
    {
        [Header("Tham Chiếu Hệ Thống")]
        [SerializeField] private VehicleController playerVehicle;
        [SerializeField] private DrivingViolationDetector violationDetector;
        [SerializeField] private ScoringService scoringService;

        [Header("Cấu Hình Bài Tập Hiện Tại")]
        [SerializeField] private DrivingExerciseDefinition activeExercise;
        [SerializeField] private Checkpoint[] orderedCheckpoints;

        public ExerciseState CurrentState { get; private set; } = ExerciseState.NotStarted;
        public int CurrentCheckpointIndex { get; private set; }
        public float ElapsedTimeSeconds { get; private set; }
        public float RemainingTimeSeconds => activeExercise != null
            ? Mathf.Max(0f, activeExercise.timeLimitSeconds - ElapsedTimeSeconds)
            : 0f;

        public event Action<DrivingExerciseDefinition> OnExerciseStarted;
        public event Action<int, int> OnCheckpointAdvanced;
        public event Action<bool, int, float, string> OnExerciseEnded;

        private void OnEnable()
        {
            if (scoringService != null)
            {
                scoringService.OnDisqualificationTriggered += HandleDisqualification;
            }

            if (orderedCheckpoints != null)
            {
                foreach (Checkpoint cp in orderedCheckpoints)
                {
                    if (cp != null) cp.OnCheckpointTriggered += HandleCheckpointTriggered;
                }
            }
        }

        private void OnDisable()
        {
            if (scoringService != null)
            {
                scoringService.OnDisqualificationTriggered -= HandleDisqualification;
            }

            if (orderedCheckpoints != null)
            {
                foreach (Checkpoint cp in orderedCheckpoints)
                {
                    if (cp != null) cp.OnCheckpointTriggered -= HandleCheckpointTriggered;
                }
            }
        }

        public void StartExercise(DrivingExerciseDefinition exerciseDef, Checkpoint[] checkpointsForExercise)
        {
            if (exerciseDef != null) activeExercise = exerciseDef;
            if (checkpointsForExercise != null) orderedCheckpoints = checkpointsForExercise;

            ElapsedTimeSeconds = 0f;
            CurrentCheckpointIndex = 0;
            CurrentState = ExerciseState.InProgress;

            if (scoringService != null) scoringService.ResetScoringSession();
            if (violationDetector != null) violationDetector.ResetDetectorState();

            // Đưa xe về đúng vị trí và hướng xuất phát của bài tập
            if (playerVehicle != null && activeExercise != null)
            {
                playerVehicle.ResetVehicle();
                playerVehicle.VehicleRigidbody.position = activeExercise.startPosition;
                playerVehicle.VehicleRigidbody.rotation = Quaternion.Euler(activeExercise.startEulerRotation);
                playerVehicle.transform.SetPositionAndRotation(
                    activeExercise.startPosition,
                    Quaternion.Euler(activeExercise.startEulerRotation)
                );
            }

            for (int i = 0; i < orderedCheckpoints.Length; i++)
            {
                if (orderedCheckpoints[i] != null)
                {
                    orderedCheckpoints[i].orderIndex = i;
                    orderedCheckpoints[i].ResetCheckpoint(i == 0);
                }
            }

            OnExerciseStarted?.Invoke(activeExercise);
        }

        private void Update()
        {
            if (CurrentState != ExerciseState.InProgress || activeExercise == null) return;

            ElapsedTimeSeconds += Time.deltaTime;
            if (ElapsedTimeSeconds >= activeExercise.timeLimitSeconds)
            {
                scoringService?.TryReportViolation(DrivingViolationType.TimeLimitExceeded);
                FinishExercise(false, "Vượt quá thời gian quy định của bài tập.");
            }
        }

        private void HandleCheckpointTriggered(Checkpoint triggeredCp)
        {
            if (CurrentState != ExerciseState.InProgress) return;

            if (triggeredCp.orderIndex == CurrentCheckpointIndex)
            {
                CurrentCheckpointIndex++;
                OnCheckpointAdvanced?.Invoke(CurrentCheckpointIndex, orderedCheckpoints.Length);

                if (CurrentCheckpointIndex >= orderedCheckpoints.Length)
                {
                    bool passed = scoringService == null || scoringService.CurrentScore >= scoringService.PassingScore;
                    string msg = passed
                        ? "Hoàn thành bài tập đúng lộ trình và đạt yêu cầu!"
                        : "Đã về đích nhưng tổng điểm dưới mức đạt cấu hình.";
                    FinishExercise(passed, msg);
                }
                else
                {
                    orderedCheckpoints[CurrentCheckpointIndex].UpdateVisualState(true);
                }
            }
            else if (triggeredCp.orderIndex > CurrentCheckpointIndex)
            {
                // Người lái đã bỏ qua Checkpoint hiện tại và đi tắt tới Checkpoint phía sau
                scoringService?.TryReportViolation(DrivingViolationType.MissedCheckpoint);
                triggeredCp.ResetCheckpoint(false);
            }
        }

        private void HandleDisqualification(string reasonVi)
        {
            if (CurrentState == ExerciseState.InProgress)
            {
                FinishExercise(false, $"Không đạt: {reasonVi}");
            }
        }

        private void FinishExercise(bool passed, string summaryVi)
        {
            CurrentState = passed ? ExerciseState.Completed : ExerciseState.Failed;
            int finalScore = scoringService != null ? scoringService.CurrentScore : 100;
            OnExerciseEnded?.Invoke(passed, finalScore, ElapsedTimeSeconds, summaryVi);
        }
    }
}
`,
  },
  {
    id: 'course_manager',
    fileName: 'CourseManager.cs',
    relativePath: 'Assets/Scripts/Exercises/CourseManager.cs',
    namespaceName: 'VietnamDrivingSim.Exercises',
    summaryVi:
      'Quản lý cấp cao cho toàn bộ sân tập: hỗ trợ chuyển đổi giữa Chế độ Luyện tập tự do (Free Practice), Luyện tập từng bài (Bài 1 -> Bài 8), và Thi thử liên hoàn, đồng thời đổi cấu hình xe (VehicleProfile) theo hạng giấy phép.',
    inspectorRefs: [
      {
        field: 'courseDefinition',
        type: 'DrivingCourseDefinition',
        recommendedValue: 'SO_DrivingCourse_CatB',
        descriptionVi: 'Cấu hình khóa học chứa danh sách 8 bài tập.',
      },
      {
        field: 'exerciseManager',
        type: 'ExerciseManager',
        recommendedValue: 'ExerciseManager trong Scene',
        descriptionVi: 'Bộ điều phối bài tập con.',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Vehicle;
using VietnamDrivingSim.Vehicles;

namespace VietnamDrivingSim.Exercises
{
    public class CourseManager : MonoBehaviour
    {
        [Header("Cấu Hình Khóa Học & Quản Lý Bài Tập")]
        [SerializeField] private DrivingCourseDefinition courseDefinition;
        [SerializeField] private ExerciseManager exerciseManager;
        [SerializeField] private VehicleController playerVehicle;

        [Header("Nhóm Checkpoint Trên Sân Cho Từng Bài Tập")]
        [SerializeField] private GameObject[] exerciseCheckpointRoots;

        public DrivingCourseDefinition CourseDefinition => courseDefinition;
        public bool IsFreePracticeMode { get; private set; }

        private void Start()
        {
            // Khởi chạy Bài Tập #1 mặc định khi vào sân
            if (courseDefinition != null && courseDefinition.exercises.Length > 0)
            {
                LaunchExerciseByIndex(0);
            }
        }

        public void LaunchFreePractice()
        {
            IsFreePracticeMode = true;
            DisableAllCheckpointRoots();
            playerVehicle?.ResetVehicle();
        }

        public void LaunchExerciseByIndex(int index)
        {
            if (courseDefinition == null || index < 0 || index >= courseDefinition.exercises.Length)
                return;

            IsFreePracticeMode = false;
            DisableAllCheckpointRoots();

            Checkpoint[] activeCheckpoints = new Checkpoint[0];
            if (exerciseCheckpointRoots != null && index < exerciseCheckpointRoots.Length && exerciseCheckpointRoots[index] != null)
            {
                exerciseCheckpointRoots[index].SetActive(true);
                activeCheckpoints = exerciseCheckpointRoots[index].GetComponentsInChildren<Checkpoint>(true);
            }

            exerciseManager.StartExercise(courseDefinition.exercises[index], activeCheckpoints);
        }

        private void DisableAllCheckpointRoots()
        {
            if (exerciseCheckpointRoots == null) return;
            foreach (GameObject root in exerciseCheckpointRoots)
            {
                if (root != null) root.SetActive(false);
            }
        }
    }
}
`,
  },
  {
    id: 'vehicle_controller',
    fileName: 'VehicleController.cs',
    relativePath: 'Assets/Scripts/Vehicle/VehicleController.cs',
    namespaceName: 'VietnamDrivingSim.Vehicle',
    summaryVi:
      'Bộ điều khiển vật lý xe trung tâm thực thi hoàn toàn trong FixedUpdate thông qua Rigidbody và 4 WheelCollider. Đồng bộ hóa mô hình bánh xe bằng WheelCollider.GetWorldPose, giảm góc đánh lái theo tốc độ, và cung cấp hàm ResetVehicle() an toàn.',
    inspectorRefs: [
      {
        field: 'vehicleProfile',
        type: 'VehicleProfile (ScriptableObject)',
        recommendedValue: 'SO_VehicleProfile_CatB',
        descriptionVi: 'Tham chiếu tới hồ sơ thông số vật lý xe Hạng B.',
      },
      {
        field: 'frontLeftCollider..rearRightCollider',
        type: 'WheelCollider[4]',
        recommendedValue: 'WC_FrontLeft, WC_FrontRight, WC_RearLeft, WC_RearRight',
        descriptionVi: '4 đối tượng WheelCollider nằm trong nhánh WheelColliders_Root.',
      },
      {
        field: 'frontLeftMesh..rearRightMesh',
        type: 'Transform[4]',
        recommendedValue: 'WM_FrontLeft, WM_FrontRight, WM_RearLeft, WM_RearRight',
        descriptionVi: '4 mô hình 3D bánh xe tách biệt, cập nhật qua GetWorldPose.',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Vehicles;

namespace VietnamDrivingSim.Vehicle
{
    [RequireComponent(typeof(Rigidbody))]
    [RequireComponent(typeof(VehicleInputHandler))]
    [RequireComponent(typeof(VehicleTransmission))]
    public class VehicleController : MonoBehaviour
    {
        [Header("1. Hồ Sơ Thông Số Xe (ScriptableObject)")]
        [SerializeField] private VehicleProfile vehicleProfile;

        [Header("2. Tham Chiếu 4 WheelColliders (Tách Biệt Khỏi Mesh)")]
        [SerializeField] private WheelCollider frontLeftCollider;
        [SerializeField] private WheelCollider frontRightCollider;
        [SerializeField] private WheelCollider rearLeftCollider;
        [SerializeField] private WheelCollider rearRightCollider;

        [Header("3. Tham Chiếu 4 Mô Hình Bánh Xe (Visual Meshes)")]
        [SerializeField] private Transform frontLeftMesh;
        [SerializeField] private Transform frontRightMesh;
        [SerializeField] private Transform rearLeftMesh;
        [SerializeField] private Transform rearRightMesh;

        [Header("4. Trọng Tâm & Vô Lăng Buồng Lái")]
        [SerializeField] private Transform centerOfMassTransform;
        [SerializeField] private Transform cockpitSteeringWheel;
        [SerializeField] private Transform defaultSpawnPoint;

        public Rigidbody VehicleRigidbody { get; private set; }
        public VehicleInputHandler InputHandler { get; private set; }
        public VehicleTransmission Transmission { get; private set; }
        public VehicleProfile Profile => vehicleProfile;

        public float CurrentSpeedKmh { get; private set; }
        public float ForwardVelocityMs { get; private set; }
        public float CurrentSteerAngleDeg { get; private set; }

        private Vector3 _initialSpawnPosition;
        private Quaternion _initialSpawnRotation;
        private WheelCollider[] _allWheelColliders;
        private Transform[] _allWheelMeshes;

        private void Awake()
        {
            VehicleRigidbody = GetComponent<Rigidbody>();
            InputHandler = GetComponent<VehicleInputHandler>();
            Transmission = GetComponent<VehicleTransmission>();

            _allWheelColliders = new WheelCollider[]
            {
                frontLeftCollider, frontRightCollider, rearLeftCollider, rearRightCollider
            };
            _allWheelMeshes = new Transform[]
            {
                frontLeftMesh, frontRightMesh, rearLeftMesh, rearRightMesh
            };

            _initialSpawnPosition = defaultSpawnPoint != null ? defaultSpawnPoint.position : transform.position;
            _initialSpawnRotation = defaultSpawnPoint != null ? defaultSpawnPoint.rotation : transform.rotation;

            ApplyProfileToPhysicsComponents();
            Transmission.Initialize(vehicleProfile);
        }

        public void ApplyProfileToPhysicsComponents()
        {
            if (vehicleProfile == null || VehicleRigidbody == null) return;

            VehicleRigidbody.mass = vehicleProfile.massKg;
            VehicleRigidbody.interpolation = RigidbodyInterpolation.Interpolate;
            VehicleRigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
            VehicleRigidbody.centerOfMass = centerOfMassTransform != null
                ? transform.InverseTransformPoint(centerOfMassTransform.position)
                : vehicleProfile.centerOfMassOffset;

            foreach (WheelCollider wc in _allWheelColliders)
            {
                if (wc == null) continue;
                wc.mass = vehicleProfile.wheelMassKg;
                wc.radius = vehicleProfile.wheelRadiusM;
                wc.suspensionDistance = vehicleProfile.suspensionDistanceM;

                JointSpring spring = wc.suspensionSpring;
                spring.spring = vehicleProfile.suspensionSpringNm;
                spring.damper = vehicleProfile.suspensionDamperNsm;
                spring.targetPosition = vehicleProfile.suspensionTargetPosition;
                wc.suspensionSpring = spring;

                WheelFrictionCurve fwd = wc.forwardFriction;
                fwd.stiffness = vehicleProfile.forwardFrictionStiffness;
                wc.forwardFriction = fwd;

                WheelFrictionCurve side = wc.sidewaysFriction;
                side.stiffness = vehicleProfile.sidewaysFrictionStiffness;
                wc.sidewaysFriction = side;
            }
        }

        private void FixedUpdate()
        {
            if (vehicleProfile == null) return;
            float fixedDt = Time.fixedDeltaTime;

            ForwardVelocityMs = Vector3.Dot(VehicleRigidbody.linearVelocity, transform.forward);
            CurrentSpeedKmh = Mathf.Abs(ForwardVelocityMs) * 3.6f;

            float speedRatio = Mathf.Clamp01(CurrentSpeedKmh / Mathf.Max(10f, vehicleProfile.maxSpeedForSteerReductionKmh));
            float maxAllowedSteer = Mathf.Lerp(vehicleProfile.maxSteerAngleLowSpeed, vehicleProfile.minSteerAngleHighSpeed, speedRatio);
            CurrentSteerAngleDeg = Mathf.MoveTowards(
                CurrentSteerAngleDeg,
                InputHandler.SteerInput * maxAllowedSteer,
                vehicleProfile.steeringRateDegPerSec * fixedDt
            );

            frontLeftCollider.steerAngle = CurrentSteerAngleDeg;
            frontRightCollider.steerAngle = CurrentSteerAngleDeg;

            float avgDrivenWheelRpm = (frontLeftCollider.rpm + frontRightCollider.rpm) * 0.5f;
            float slopePitchDeg = -transform.eulerAngles.x;
            if (slopePitchDeg < -180f) slopePitchDeg += 360f;

            Transmission.StepDrivetrain(
                vehicleProfile,
                InputHandler.ThrottleInput,
                InputHandler.BrakeInput,
                InputHandler.ClutchInput,
                InputHandler.HandbrakeActive,
                ForwardVelocityMs,
                avgDrivenWheelRpm,
                slopePitchDeg,
                fixedDt,
                out float totalDriveTorqueNm,
                out float effectiveBrakeInput
            );

            frontLeftCollider.motorTorque = totalDriveTorqueNm * 0.5f;
            frontRightCollider.motorTorque = totalDriveTorqueNm * 0.5f;

            float frontBrake = effectiveBrakeInput * vehicleProfile.serviceBrakeTorqueNm * vehicleProfile.frontBrakeBias * 0.5f;
            float rearService = effectiveBrakeInput * vehicleProfile.serviceBrakeTorqueNm * (1f - vehicleProfile.frontBrakeBias) * 0.5f;
            float rearHandbrake = InputHandler.HandbrakeActive ? vehicleProfile.handbrakeTorqueNm * 0.5f : 0f;

            frontLeftCollider.brakeTorque = frontBrake;
            frontRightCollider.brakeTorque = frontBrake;
            rearLeftCollider.brakeTorque = Mathf.Max(rearService, rearHandbrake);
            rearRightCollider.brakeTorque = Mathf.Max(rearService, rearHandbrake);
        }

        private void LateUpdate()
        {
            for (int i = 0; i < 4; i++)
            {
                if (_allWheelColliders[i] == null || _allWheelMeshes[i] == null) continue;
                _allWheelColliders[i].GetWorldPose(out Vector3 pos, out Quaternion rot);
                _allWheelMeshes[i].SetPositionAndRotation(pos, rot);
            }
        }

        public void ResetVehicle()
        {
            VehicleRigidbody.linearVelocity = Vector3.zero;
            VehicleRigidbody.angularVelocity = Vector3.zero;
            foreach (WheelCollider wc in _allWheelColliders)
            {
                if (wc == null) continue;
                wc.motorTorque = 0f;
                wc.brakeTorque = vehicleProfile.handbrakeTorqueNm;
                wc.steerAngle = 0f;
            }
            VehicleRigidbody.position = _initialSpawnPosition;
            VehicleRigidbody.rotation = _initialSpawnRotation;
            transform.SetPositionAndRotation(_initialSpawnPosition, _initialSpawnRotation);
            CurrentSteerAngleDeg = 0f;
            InputHandler.SetHandbrakeState(false);
            Transmission.Initialize(vehicleProfile);
        }

        public WheelCollider[] GetWheelColliders() => _allWheelColliders;
    }
}
`,
  },
  {
    id: 'vehicle_visuals_controller',
    fileName: 'VehicleVisualsController.cs',
    relativePath: 'Assets/Scripts/Vehicle/VehicleVisualsController.cs',
    namespaceName: 'VietnamDrivingSim.Vehicle',
    summaryVi:
      'Bộ điều khiển hiển thị 3D chuyên biệt cho xe tập lái: tách biệt cụm ngỗng trục lái & cùm phanh (WheelKnuckle + BrakeCaliper) khỏi mâm đúc & lốp quay (WheelSpin), điều khiển góc quay vô lăng, cần số, phanh tay, bàn đạp, đèn pha Cốt/Pha (SpotLight), đèn phanh, đèn lùi và xi-nhan trái/phải/khẩn cấp 1.5Hz (tự tắt khi trả lái).',
    inspectorRefs: [
      {
        field: 'wheelKnuckleTransforms[4]',
        type: 'Transform[4]',
        recommendedValue: 'WheelKnuckle_FL, WheelKnuckle_FR, WheelKnuckle_RL, WheelKnuckle_RR',
        descriptionVi: 'Nhận vị trí nén giảm xóc + góc đánh lái Yaw (giữ cùm phanh đỏ không bị quay tròn theo bánh).',
      },
      {
        field: 'wheelSpinTransforms[4]',
        type: 'Transform[4]',
        recommendedValue: 'WheelSpin_FL, WheelSpin_FR, WheelSpin_RL, WheelSpin_RR',
        descriptionVi: 'Con của WheelKnuckle; chỉ quay quanh trục X cục bộ theo tốc độ lăn của bánh xe.',
      },
      {
        field: 'steeringWheelPivot / gearShifterPivot / pedals',
        type: 'Transform',
        recommendedValue: 'SteeringWheel_Pivot, GearShifter_Pivot, Clutch/Brake/Throttle Pivots',
        descriptionVi: 'Các khớp chuyển động trực quan trong buồng lái khi nhìn từ Camera Cockpit.',
      },
    ],
    code: `using UnityEngine;

namespace VietnamDrivingSim.Vehicle
{
    public enum TurnSignalMode
    {
        Off,
        Left,
        Right,
        Hazard
    }

    public enum HeadlightBeamMode
    {
        Off,
        LowBeam,
        HighBeam
    }

    /// <summary>
    /// Quản lý toàn bộ mô hình 3D ngoại thất, nội thất buồng lái, hệ thống đèn tín hiệu
    /// và đồng bộ 4 cụm bánh xe (tách riêng Cùm Phanh đứng yên vs. Mâm/Lốp/Đĩa Phanh quay).
    /// </summary>
    [RequireComponent(typeof(VehicleController))]
    public class VehicleVisualsController : MonoBehaviour
    {
        [Header("1. Cụm Ngỗng Trục (Chứa Cùm Phanh) & Cụm Mâm Lốp Quay")]
        [SerializeField] private Transform[] wheelKnuckleTransforms = new Transform[4];
        [SerializeField] private Transform[] wheelSpinTransforms = new Transform[4];

        [Header("2. Nội Thất Buồng Lái (Vô Lăng, Cần Số, Phanh Tay, 3 Bàn Đạp)")]
        [SerializeField] private Transform steeringWheelPivot;
        [SerializeField] private float steeringWheelRatio = 9.0f;
        [SerializeField] private Transform gearShifterPivot;
        [SerializeField] private Transform handbrakeLeverPivot;
        [SerializeField] private Transform clutchPedalPivot;
        [SerializeField] private Transform brakePedalPivot;
        [SerializeField] private Transform throttlePedalPivot;

        [Header("3. Hệ Thống Đèn Chiếu Sáng & Tín Hiệu (Renderers & SpotLights)")]
        [SerializeField] private Light leftHeadlightSpot;
        [SerializeField] private Light rightHeadlightSpot;
        [SerializeField] private Renderer[] brakeLightRenderers;
        [SerializeField] private Renderer[] reverseLightRenderers;
        [SerializeField] private Renderer[] leftTurnIndicatorRenderers;
        [SerializeField] private Renderer[] rightTurnIndicatorRenderers;

        [Header("4. Màu Sơn Xe & Biển Tập Lái")]
        [SerializeField] private Renderer[] bodyPaintRenderers;
        [SerializeField] private GameObject roofTrainingSignObject;

        public TurnSignalMode CurrentTurnSignal { get; private set; } = TurnSignalMode.Off;
        public HeadlightBeamMode CurrentHeadlightMode { get; private set; } = HeadlightBeamMode.LowBeam;
        public bool IsTurnSignalBlinkOn { get; private set; }

        private VehicleController _controller;
        private readonly float[] _wheelRollAnglesDeg = new float[4];
        private float _blinkTimerS;
        private float _peakSteerAngleDuringTurnDeg;
        private MaterialPropertyBlock _propBlock;

        private static readonly int EmissionColorId = Shader.PropertyToID("_EmissionColor");
        private static readonly int BaseColorId = Shader.PropertyToID("_BaseColor");

        private void Awake()
        {
            _controller = GetComponent<VehicleController>();
            _propBlock = new MaterialPropertyBlock();
            ApplyHeadlightMode();
        }

        private void Update()
        {
            HandleLightingShortcuts();
            StepTurnSignalBlinker(Time.deltaTime);
            UpdateCockpitControls(Time.deltaTime);
            UpdateExteriorLights();
        }

        private void LateUpdate()
        {
            SyncDecoupledWheels();
        }

        private void HandleLightingShortcuts()
        {
            if (Input.GetKeyDown(KeyCode.Z) || Input.GetKeyDown(KeyCode.LeftBracket))
                ToggleTurnSignal(TurnSignalMode.Left);
            else if (Input.GetKeyDown(KeyCode.X) || Input.GetKeyDown(KeyCode.RightBracket))
                ToggleTurnSignal(TurnSignalMode.Right);
            else if (Input.GetKeyDown(KeyCode.V))
                ToggleTurnSignal(TurnSignalMode.Hazard);
            else if (Input.GetKeyDown(KeyCode.L))
                CycleHeadlightMode();
        }

        public void ToggleTurnSignal(TurnSignalMode target)
        {
            if (CurrentTurnSignal == target)
            {
                CurrentTurnSignal = TurnSignalMode.Off;
                IsTurnSignalBlinkOn = false;
                _blinkTimerS = 0f;
                _peakSteerAngleDuringTurnDeg = 0f;
            }
            else
            {
                CurrentTurnSignal = target;
                IsTurnSignalBlinkOn = true;
                _blinkTimerS = 0f;
                _peakSteerAngleDuringTurnDeg = Mathf.Abs(_controller.CurrentSteerAngleDeg);
            }
        }

        public void CycleHeadlightMode()
        {
            CurrentHeadlightMode = CurrentHeadlightMode switch
            {
                HeadlightBeamMode.Off => HeadlightBeamMode.LowBeam,
                HeadlightBeamMode.LowBeam => HeadlightBeamMode.HighBeam,
                _ => HeadlightBeamMode.Off
            };
            ApplyHeadlightMode();
        }

        public void SetAutomotivePaintColor(Color paintColor)
        {
            if (bodyPaintRenderers == null) return;
            foreach (Renderer r in bodyPaintRenderers)
            {
                if (r == null) continue;
                r.GetPropertyBlock(_propBlock);
                _propBlock.SetColor(BaseColorId, paintColor);
                r.SetPropertyBlock(_propBlock);
            }
        }

        private void StepTurnSignalBlinker(float dt)
        {
            if (CurrentTurnSignal == TurnSignalMode.Off)
            {
                IsTurnSignalBlinkOn = false;
                return;
            }

            // Chu kỳ nháy 90 lần/phút (1.5 Hz -> nửa chu kỳ 0.34s)
            _blinkTimerS += dt;
            if (_blinkTimerS >= 0.34f)
            {
                _blinkTimerS -= 0.34f;
                IsTurnSignalBlinkOn = !IsTurnSignalBlinkOn;
            }

            // Tự động tắt xi-nhan trái/phải khi trả vô lăng về thẳng sau khi vào cua (> 14 độ)
            if (CurrentTurnSignal == TurnSignalMode.Left || CurrentTurnSignal == TurnSignalMode.Right)
            {
                float steer = _controller.CurrentSteerAngleDeg;
                bool turningInDir = (CurrentTurnSignal == TurnSignalMode.Left && steer < -12f) ||
                                    (CurrentTurnSignal == TurnSignalMode.Right && steer > 12f);

                if (turningInDir)
                {
                    _peakSteerAngleDuringTurnDeg = Mathf.Max(_peakSteerAngleDuringTurnDeg, Mathf.Abs(steer));
                }
                else if (_peakSteerAngleDuringTurnDeg >= 14f && Mathf.Abs(steer) < 3.5f)
                {
                    CurrentTurnSignal = TurnSignalMode.Off;
                    IsTurnSignalBlinkOn = false;
                    _peakSteerAngleDuringTurnDeg = 0f;
                }
            }
        }

        private void SyncDecoupledWheels()
        {
            WheelCollider[] colliders = _controller.GetWheelColliders();
            for (int i = 0; i < 4; i++)
            {
                if (i >= colliders.Length || colliders[i] == null) continue;
                WheelCollider wc = colliders[i];

                wc.GetWorldPose(out Vector3 worldPos, out Quaternion _);

                // 1. Ngỗng trục lái (WheelKnuckle + Cùm phanh): chỉ nhận vị trí nén giảm xóc + góc đánh lái Yaw
                if (i < wheelKnuckleTransforms.Length && wheelKnuckleTransforms[i] != null)
                {
                    Quaternion knuckleRot = transform.rotation * Quaternion.Euler(0f, wc.steerAngle, 0f);
                    wheelKnuckleTransforms[i].SetPositionAndRotation(worldPos, knuckleRot);
                }

                // 2. Cụm Mâm + Lốp + Đĩa phanh (WheelSpin): quay quanh trục X cục bộ theo RPM thực tế
                _wheelRollAnglesDeg[i] = Mathf.Repeat(_wheelRollAnglesDeg[i] + wc.rpm * 6f * Time.deltaTime, 360f);
                if (i < wheelSpinTransforms.Length && wheelSpinTransforms[i] != null)
                {
                    wheelSpinTransforms[i].localRotation = Quaternion.Euler(_wheelRollAnglesDeg[i], 0f, 0f);
                }
            }
        }

        private void UpdateCockpitControls(float dt)
        {
            if (steeringWheelPivot != null)
            {
                float wheelZ = -_controller.CurrentSteerAngleDeg * steeringWheelRatio;
                steeringWheelPivot.localRotation = Quaternion.Euler(-20f, 0f, wheelZ);
            }

            if (gearShifterPivot != null && _controller.Transmission != null)
            {
                int g = _controller.Transmission.CurrentGear;
                Vector3 targetEuler = g switch
                {
                    -1 => new Vector3(14f, 0f, -12f),
                    1 => new Vector3(-14f, 0f, 12f),
                    2 => new Vector3(14f, 0f, 12f),
                    3 => new Vector3(-14f, 0f, 0f),
                    4 => new Vector3(14f, 0f, 0f),
                    5 => new Vector3(-14f, 0f, -12f),
                    _ => Vector3.zero
                };
                gearShifterPivot.localRotation = Quaternion.Slerp(
                    gearShifterPivot.localRotation,
                    Quaternion.Euler(targetEuler),
                    dt * 12f
                );
            }

            if (handbrakeLeverPivot != null && _controller.InputHandler != null)
            {
                float targetPitch = _controller.InputHandler.HandbrakeActive ? -30f : -3f;
                handbrakeLeverPivot.localRotation = Quaternion.Slerp(
                    handbrakeLeverPivot.localRotation,
                    Quaternion.Euler(targetPitch, 0f, 0f),
                    dt * 12f
                );
            }

            if (_controller.InputHandler != null)
            {
                if (clutchPedalPivot != null)
                    clutchPedalPivot.localRotation = Quaternion.Euler(-_controller.InputHandler.ClutchInput * 24f, 0f, 0f);
                if (brakePedalPivot != null)
                    brakePedalPivot.localRotation = Quaternion.Euler(-_controller.InputHandler.BrakeInput * 22f, 0f, 0f);
                if (throttlePedalPivot != null)
                    throttlePedalPivot.localRotation = Quaternion.Euler(-_controller.InputHandler.ThrottleInput * 24f, 0f, 0f);
            }
        }

        private void ApplyHeadlightMode()
        {
            bool active = CurrentHeadlightMode != HeadlightBeamMode.Off;
            float range = CurrentHeadlightMode == HeadlightBeamMode.HighBeam ? 68f : 38f;
            float intensity = CurrentHeadlightMode == HeadlightBeamMode.HighBeam ? 4.5f : 2.4f;

            if (leftHeadlightSpot != null)
            {
                leftHeadlightSpot.enabled = active;
                leftHeadlightSpot.range = range;
                leftHeadlightSpot.intensity = intensity;
            }
            if (rightHeadlightSpot != null)
            {
                rightHeadlightSpot.enabled = active;
                rightHeadlightSpot.range = range;
                rightHeadlightSpot.intensity = intensity;
            }
        }

        private void UpdateExteriorLights()
        {
            if (_controller.InputHandler == null || _controller.Transmission == null) return;

            bool isBraking = _controller.InputHandler.BrakeInput > 0.06f || _controller.InputHandler.HandbrakeActive;
            bool isReversing = _controller.Transmission.CurrentGear == -1;
            bool leftSignalLit = IsTurnSignalBlinkOn &&
                                 (CurrentTurnSignal == TurnSignalMode.Left || CurrentTurnSignal == TurnSignalMode.Hazard);
            bool rightSignalLit = IsTurnSignalBlinkOn &&
                                  (CurrentTurnSignal == TurnSignalMode.Right || CurrentTurnSignal == TurnSignalMode.Hazard);

            SetEmissionOnRenderers(brakeLightRenderers, isBraking ? new Color(2.8f, 0.15f, 0.15f) : new Color(0.35f, 0.02f, 0.02f));
            SetEmissionOnRenderers(reverseLightRenderers, isReversing ? new Color(2.2f, 2.2f, 2.2f) : Color.black);
            SetEmissionOnRenderers(leftTurnIndicatorRenderers, leftSignalLit ? new Color(2.8f, 1.6f, 0.05f) : Color.black);
            SetEmissionOnRenderers(rightTurnIndicatorRenderers, rightSignalLit ? new Color(2.8f, 1.6f, 0.05f) : Color.black);
        }

        private void SetEmissionOnRenderers(Renderer[] renderers, Color emissionColor)
        {
            if (renderers == null) return;
            foreach (Renderer r in renderers)
            {
                if (r == null) continue;
                r.GetPropertyBlock(_propBlock);
                _propBlock.SetColor(EmissionColorId, emissionColor);
                r.SetPropertyBlock(_propBlock);
            }
        }
    }
}
`,
  },
  {
    id: 'vehicle_camera_controller',
    fileName: 'VehicleCameraController.cs',
    relativePath: 'Assets/Scripts/Camera/VehicleCameraController.cs',
    namespaceName: 'VietnamDrivingSim.CameraSystem',
    summaryVi:
      'Bộ điều khiển 4 góc nhìn Camera mượt mà cho xe tập lái: Camera Thứ 3 theo sau xe (Chase), Camera Buồng Lái nhìn qua vô lăng & gương chiếu hậu (Cockpit), Camera Nắp Ca-pô căn vạch (Hood), và Camera Quan Sát 360° hỗ trợ kéo chuột xoay quanh xe (Orbit Inspect).',
    inspectorRefs: [
      {
        field: 'targetVehicle',
        type: 'VehicleController',
        recommendedValue: 'Vehicle_CategoryB_Sedan',
        descriptionVi: 'Xe mục tiêu để Camera bám theo và lấy góc đánh lái.',
      },
      {
        field: 'cockpitEyeAnchor / hoodAnchor',
        type: 'Transform',
        recommendedValue: 'CockpitDriverEye_Mount, HoodCamera_Mount',
        descriptionVi: 'Vị trí mắt người lái trong cabin (-0.36, 0.67, -0.02) và trên nắp ca-pô (0, 0.56, -1.12).',
      },
    ],
    code: `using UnityEngine;
using VietnamDrivingSim.Vehicle;

namespace VietnamDrivingSim.CameraSystem
{
    public enum DrivingCameraViewMode
    {
        ChaseThirdPerson,
        CockpitDriverEye,
        HoodBonnet,
        OrbitInspect360
    }

    public class VehicleCameraController : MonoBehaviour
    {
        [Header("1. Mục Tiêu & Điểm Neo Góc Nhìn")]
        [SerializeField] private VehicleController targetVehicle;
        [SerializeField] private Transform cockpitEyeAnchor;
        [SerializeField] private Transform hoodAnchor;

        [Header("2. Thông Số Camera Thứ 3 (Chase)")]
        [SerializeField] private float chaseDistance = 6.3f;
        [SerializeField] private float chaseHeight = 2.35f;
        [SerializeField] private float positionSmoothSpeed = 8.0f;
        [SerializeField] private float steerLookAheadOffset = 0.65f;

        [Header("3. Thông Số Camera 360° (Orbit Inspect)")]
        [SerializeField] private float orbitDistance = 5.8f;
        [SerializeField] private float orbitSensitivity = 3.2f;

        public DrivingCameraViewMode CurrentViewMode { get; private set; } = DrivingCameraViewMode.ChaseThirdPerson;

        private float _orbitYawDeg = 35f;
        private float _orbitPitchDeg = 20f;

        public void CycleCameraMode()
        {
            CurrentViewMode = CurrentViewMode switch
            {
                DrivingCameraViewMode.ChaseThirdPerson => DrivingCameraViewMode.CockpitDriverEye,
                DrivingCameraViewMode.CockpitDriverEye => DrivingCameraViewMode.HoodBonnet,
                DrivingCameraViewMode.HoodBonnet => DrivingCameraViewMode.OrbitInspect360,
                _ => DrivingCameraViewMode.ChaseThirdPerson
            };
        }

        private void LateUpdate()
        {
            if (targetVehicle == null) return;
            float dt = Time.deltaTime;
            Transform carTf = targetVehicle.transform;

            switch (CurrentViewMode)
            {
                case DrivingCameraViewMode.CockpitDriverEye:
                    if (cockpitEyeAnchor != null)
                    {
                        transform.position = cockpitEyeAnchor.position;
                        float headTurnYaw = targetVehicle.CurrentSteerAngleDeg * 0.42f;
                        transform.rotation = cockpitEyeAnchor.rotation * Quaternion.Euler(4f, headTurnYaw, 0f);
                    }
                    break;

                case DrivingCameraViewMode.HoodBonnet:
                    if (hoodAnchor != null)
                    {
                        transform.position = hoodAnchor.position;
                        float hoodYaw = targetVehicle.CurrentSteerAngleDeg * 0.30f;
                        transform.rotation = hoodAnchor.rotation * Quaternion.Euler(5f, hoodYaw, 0f);
                    }
                    break;

                case DrivingCameraViewMode.OrbitInspect360:
                    if (Input.GetMouseButton(0))
                    {
                        _orbitYawDeg += Input.GetAxis("Mouse X") * orbitSensitivity;
                        _orbitPitchDeg = Mathf.Clamp(_orbitPitchDeg - Input.GetAxis("Mouse Y") * orbitSensitivity, 6f, 65f);
                    }
                    Quaternion orbitRot = Quaternion.Euler(_orbitPitchDeg, carTf.eulerAngles.y + _orbitYawDeg, 0f);
                    transform.position = carTf.position + Vector3.up * 0.35f + orbitRot * new Vector3(0f, 0f, -orbitDistance);
                    transform.LookAt(carTf.position + Vector3.up * 0.35f);
                    break;

                default: // ChaseThirdPerson
                    Vector3 desiredPos = carTf.position - carTf.forward * chaseDistance + Vector3.up * chaseHeight;
                    transform.position = Vector3.Lerp(transform.position, desiredPos, 1f - Mathf.Exp(-positionSmoothSpeed * dt));

                    float steerLat = Mathf.Sin(targetVehicle.CurrentSteerAngleDeg * Mathf.Deg2Rad) * steerLookAheadOffset;
                    Vector3 lookTarget = carTf.position + carTf.forward * 3.4f + Vector3.up * 0.52f + carTf.right * steerLat;
                    transform.LookAt(lookTarget);
                    break;
            }
        }
    }
}
`,
  },
  {
    id: 'course_debug_gizmo_drawer',
    fileName: 'CourseDebugGizmoDrawer.cs',
    relativePath: 'Assets/Scripts/Course/CourseDebugGizmoDrawer.cs',
    namespaceName: 'VietnamDrivingSim.Course',
    summaryVi:
      'Công cụ vẽ Debug Gizmos trực quan trong Unity Scene View & Runtime: hiển thị khối Trigger của từng Checkpoint, hành lang biên hợp lệ (Allowed Boundary Zones), điểm Xuất Phát/Về Đích, đường nối tuần tự và nhãn phân biệt rõ cấu hình Đã Xác Minh vs. Tạm Tính (Provisional).',
    inspectorRefs: [
      {
        field: 'exerciseManager',
        type: 'ExerciseManager',
        recommendedValue: 'Course_Management_Systems',
        descriptionVi: 'Tham chiếu tới ExerciseManager để lấy bài tập đang kích hoạt và chỉ số Checkpoint hiện tại.',
      },
      {
        field: 'drawBoundaryCorridors / drawCheckpoints',
        type: 'bool',
        recommendedValue: 'true, true',
        descriptionVi: 'Bật/tắt hiển thị khung dây (Wireframe) hành lang biên và bán kính/hộp dừng Checkpoint.',
      },
    ],
    code: `using UnityEngine;

namespace VietnamDrivingSim.Course
{
    [ExecuteAlways]
    public class CourseDebugGizmoDrawer : MonoBehaviour
    {
        [Header("1. Tham Chiếu Quản Lý Bài Tập")]
        [SerializeField] private ExerciseManager exerciseManager;
        [SerializeField] private DrivingExerciseSO previewExerciseInEditor;

        [Header("2. Cấu Hình Hiển Thị Gizmos")]
        [SerializeField] private bool drawBoundaryCorridors = true;
        [SerializeField] private bool drawCheckpointVolumes = true;
        [SerializeField] private bool drawSequentialRouteLine = true;
        [SerializeField] private bool drawStartAndFinishZones = true;

        private void OnDrawGizmos()
        {
            DrivingExerciseSO ex = (Application.isPlaying && exerciseManager != null && exerciseManager.ActiveExercise != null)
                ? exerciseManager.ActiveExercise
                : previewExerciseInEditor;

            if (ex == null) return;

            // 1. Vẽ Vùng Xuất Phát (Start Pose)
            if (drawStartAndFinishZones)
            {
                Gizmos.color = new Color(0.06f, 0.72f, 0.50f, 0.85f);
                Gizmos.DrawWireCube(ex.startPosition + Vector3.up * 0.5f, new Vector3(2.4f, 1.0f, 4.8f));
                Vector3 forwardDir = Quaternion.Euler(0f, ex.startYawDeg, 0f) * Vector3.forward;
                Gizmos.DrawRay(ex.startPosition + Vector3.up * 0.5f, forwardDir * 4.0f);
            }

            // 2. Vẽ Hành Lang Biên Hợp Lệ (Allowed Boundary Corridors)
            if (drawBoundaryCorridors && ex.allowedCorridors != null)
            {
                Gizmos.color = ex.isOfficialLayoutVerified
                    ? new Color(0.06f, 0.72f, 0.50f, 0.45f)
                    : new Color(0.22f, 0.74f, 0.97f, 0.45f);

                foreach (BoundaryCorridor corridor in ex.allowedCorridors)
                {
                    float width = corridor.maxX - corridor.minX;
                    float length = corridor.maxZ - corridor.minZ;
                    Vector3 center = new Vector3(
                        (corridor.minX + corridor.maxX) * 0.5f,
                        0.2f,
                        (corridor.minZ + corridor.maxZ) * 0.5f
                    );
                    Gizmos.DrawWireCube(center, new Vector3(width, 0.4f, length));
                }
            }

            // 3. Vẽ Khối Trigger Checkpoint & Đường Lộ Trình Tuần Tự
            if (ex.checkpoints == null || ex.checkpoints.Length == 0) return;

            Vector3 prevPoint = ex.startPosition + Vector3.up * 0.25f;
            int activeIdx = (Application.isPlaying && exerciseManager != null)
                ? exerciseManager.CurrentCheckpointIndex
                : 0;

            for (int i = 0; i < ex.checkpoints.Length; i++)
            {
                CheckpointSpec cp = ex.checkpoints[i];
                bool isCurrent = (i == activeIdx);

                if (drawCheckpointVolumes)
                {
                    if (isCurrent)
                        Gizmos.color = new Color(0.96f, 0.62f, 0.04f, 0.95f); // Vàng cam: Checkpoint đang kích hoạt
                    else if (i < activeIdx)
                        Gizmos.color = new Color(0.4f, 0.5f, 0.6f, 0.35f);   // Xám: Đã đi qua
                    else
                        Gizmos.color = cp.requiresFullStop
                            ? new Color(0.94f, 0.27f, 0.27f, 0.65f)
                            : new Color(0.06f, 0.72f, 0.50f, 0.65f);

                    Gizmos.DrawWireSphere(cp.worldPosition, cp.triggerRadiusM);
                }

                if (drawSequentialRouteLine)
                {
                    Gizmos.color = new Color(0.98f, 0.80f, 0.08f, 0.85f);
                    Vector3 nextPoint = cp.worldPosition + Vector3.up * 0.25f;
                    Gizmos.DrawLine(prevPoint, nextPoint);
                    prevPoint = nextPoint;
                }
            }
        }
    }
}
`,
  },
];

export const UNITY_INSPECTOR_SETUP_STEPS = [
  {
    stepNumber: 'Bước 01',
    titleVi: 'Khởi Tạo Các ScriptableObject: 6 Hạng Xe QCVN 40, Bộ Quy Tắc TT 108/2026 & 11 Bài Sát Hạch',
    detailsVi: [
      'Tạo 6 hồ sơ phương tiện SO_VehicleProfile_CatB, CatC1, CatC, CatD1, CatD2, CatD theo đúng kích thước tối thiểu của Bảng 1 QCVN 40:2024/BGTVT, cùng SO_ScoringRuleSet_TT108_2026 (Thang 100 điểm, đạt ≥ 80 điểm) thông qua menu Assets → Create → VietnamDrivingSim.',
      'Giữ cờ isOfficialLayoutVerified = false trên các bài tập có tọa độ hình học tạm tính cho đến khi nhập bản vẽ CAD chi tiết của từng Trung tâm sát hạch cụ thể.',
    ],
  },
  {
    stepNumber: 'Bước 02',
    titleVi: 'Nhập Mô Hình Xe 3D (FBX / GLTF) Hợp Lệ & Cấu Trúc Tách Rời Cùm Phanh / Mâm Xe',
    detailsVi: [
      'Khi thay thế bằng file FBX/GLTF xe Sedan thương mại có bản quyền trong Unity 6: đặt Scale Factor = 1.0 (chiều dài ~4.45m, chiều rộng ~1.74m, trục +Z hướng về mũi xe). Đặt toàn bộ Mesh ngoại thất/nội thất làm con của nhánh Visuals_Root (không gắn MeshCollider trực tiếp lên các chi tiết trang trí).',
      'Với mỗi bánh xe, tạo 2 cấp Transform: (1) WheelKnuckle_FL..RR chứa Cùm phanh (Brake Caliper) nhận vị trí + góc lái Yaw từ WheelCollider, và (2) đối tượng con WheelSpin_FL..RR chứa Lốp, Mâm đúc 5 chấu kép và Đĩa phanh chỉ quay quanh trục X cục bộ trong VehicleVisualsController.cs.',
    ],
  },
  {
    stepNumber: 'Bước 03',
    titleVi: 'Thiết Lập Vật Liệu PBR (Sơn Clearcoat, Kính Tinted, Đèn Emissive) & 4 Góc Camera',
    detailsVi: [
      'Tạo 6 vật liệu URP Lit / Standard: CarPaint_Metallic (Metallic = 0.62, Smoothness = 0.80, Clear Coat = 1.0), Glass_Tinted (Surface = Transparent, Alpha = 0.84), Tire_Rubber (Smoothness = 0.16), Alloy_Rim (Metallic = 0.90), và các vật liệu đèn pha/phanh/lùi/xi-nhan bật sẵn cờ Emission.',
      'Gắn VehicleVisualsController.cs lên Vehicle_CategoryB_Sedan và VehicleCameraController.cs lên MainCamera để chuyển đổi mượt mà giữa 4 góc nhìn (Chase, Cockpit, Hood, 360° Orbit) và điều khiển đèn pha (L), xi-nhan trái/phải/khẩn cấp (Z/X/V).',
    ],
  },
  {
    stepNumber: 'Bước 04',
    titleVi: 'Liên Kết CourseManager, ExerciseManager, ViolationDetector, ScoringService & CourseDebugGizmoDrawer',
    detailsVi: [
      'Gắn CourseManager, ExerciseManager, ScoringService và CourseDebugGizmoDrawer vào đối tượng Course_Management_Systems trong Scene.',
      'Trên Vehicle_CategoryB_Sedan, gắn thêm DrivingViolationDetector.cs và kéo ScoringService vào ô tham chiếu. Nhờ cơ chế chốt trạng thái (State Latch) + Cooldown, xe đè vạch, quá vòng tua >4000 RPM hoặc chạm cọc tiêu liên tục chỉ bị trừ điểm 1 lần duy nhất cho mỗi sự cố.',
    ],
  },
];

export interface VerificationTestCase {
  id: string;
  categoryVi: string;
  testCaseVi: string;
  expectedBehaviorVi: string;
  verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE' | 'UNITY_EDITOR_REQUIRED';
  statusBadgeVi: string;
}

export const MILESTONE_1_VERIFICATION_CHECKLIST: VerificationTestCase[] = [
  {
    id: 'test_tt108_2026_and_qcvn40',
    categoryVi: '1. Đối Chiếu Pháp Quy Chính Thức (Thông Tư 108/2026/TT-BCA & QCVN 40:2024/BGTVT)',
    testCaseVi: 'Mở Menu Chọn Bài Tập (Phím B) → Tab "Hồ Sơ Pháp Lý & Kích Thước Tạm Tính" và Tab "6 Hạng Xe QCVN 40". Kiểm tra trình tự 11 bài sát hạch liên hoàn, điểm đạt 80/100, lỗi quá 4000 RPM, lỗi tốc độ 24/20 km/h và lỗi thiếu xi-nhan.',
    expectedBehaviorVi:
      'Hiển thị rõ ràng bảng phân biệt các thông số pháp lý đã xác minh chính thức (Verified Official) với các thông số hình học sân tập tạm tính (Provisional Measurements), kèm đầy đủ 6 hạng xe B, C1, C, D1, D2, D.',
    verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE',
    statusBadgeVi: 'Đã xác minh trực tiếp trên trình mô phỏng 3D & thuật toán C#',
  },
  {
    id: 'test_data_driven_json_and_gizmos',
    categoryVi: '2. Trình Biên Tập Cấu Hình Data-Driven (JSON) & Gizmo 3D Hành Lang/Checkpoint',
    testCaseVi: 'Mở Tab "Cấu Hình Data-Driven (JSON)" trong Menu Bài Tập, sửa tọa độ Checkpoint hoặc thời gian dừng và nhấn "Chạy Thử Cấu Hình Này"; bật nút "Gizmo 3D (Bánh Xe + Hành Lang & Checkpoint)" ở ngăn Telemetry.',
    expectedBehaviorVi:
      'Bài tập nạp ngay tọa độ mới từ JSON mà không cần sửa code điều khiển xe; trên mặt sân 3D hiện rõ khung dây hành lang biên hợp lệ, khối trụ/hộp Trigger Checkpoint và đường lộ trình vàng nối tuần tự.',
    verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE',
    statusBadgeVi: 'Đã xác minh trực tiếp trên trình mô phỏng 3D & thuật toán C#',
  },
  {
    id: 'test_realistic_3d_car_and_cockpit',
    categoryVi: '3. Mô Hình Ngoại Thất & Buồng Lái 3D (Thân Xe Contoured, Cùm Phanh Tách Rời, Đồng Hồ Thực)',
    testCaseVi: 'Chuyển sang Camera 360° (C) hoặc Camera Buồng Lái (C), quan sát hốc bánh xe, cùm phanh đỏ, mâm đúc 5 chấu kép, vô lăng, cần số, phanh tay và bảng đồng hồ kỹ thuật số khi đánh lái/vào số.',
    expectedBehaviorVi:
      'Thân xe có đường gân ca-pô, trụ A/B/C, kính trong suốt nhìn xuyên vào ghế ngồi; cùm phanh đứng yên theo ngỗng trục lái trong khi mâm/lốp/đĩa phanh quay mượt; vô lăng, cần số và 3 bàn đạp chuyển động chính xác theo thao tác.',
    verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE',
    statusBadgeVi: 'Đã xác minh trực tiếp trên trình mô phỏng 3D & thuật toán C#',
  },
  {
    id: 'test_lights_and_turn_signals',
    categoryVi: '4. Hệ Thống Đèn Pha (Cốt/Pha), Đèn Phanh, Đèn Lùi & Xi-Nhan Bắt Buộc Khi Xuất Phát/Về Đích',
    testCaseVi: 'Chạy Bài 1 (Xuất phát): bật xi-nhan trái (Z) trước khi qua Cổng #1 và bật xi-nhan phải (X) khi dừng tại Vạch Kết Thúc #4. Thử không bật xi-nhan để kiểm tra trừ điểm.',
    expectedBehaviorVi:
      'Nếu không bật xi-nhan trái khi qua vạch xuất phát hoặc không bật xi-nhan phải khi qua vạch kết thúc, hệ thống chấm điểm chuẩn TT 108/2026 lập tức trừ 5 điểm và hiển thị hướng dẫn khắc phục bằng Tiếng Việt.',
    verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE',
    statusBadgeVi: 'Đã xác minh trực tiếp trên trình mô phỏng 3D & thuật toán C#',
  },
  {
    id: 'test_debounce_violations',
    categoryVi: '5. Chống Trừ Điểm Lặp Lại Theo Frame (Continuous Violation Debounce)',
    testCaseVi: 'Lái xe đè liên tục lên vạch biên làn đường, đạp ga quá 4000 RPM hoặc tì vào cọc tiêu/rào chắn trong nhiều giây.',
    expectedBehaviorVi:
      'DrivingViolationDetector và ScoringService chỉ trừ 5 điểm đúng 1 lần duy nhất cho sự cố đó kèm thông báo giải thích Tiếng Việt, không trừ điểm liên tiếp mỗi frame.',
    verificationStatus: 'VERIFIED_IN_WEBGL_AND_CODE',
    statusBadgeVi: 'Đã xác minh trực tiếp trên trình mô phỏng 3D & thuật toán C#',
  },
  {
    id: 'test_unity_fbx_import_and_triggers',
    categoryVi: '6. Kiểm Thử Nhập Asset FBX Thương Mại & OnTriggerStay Trong Unity 6 Editor',
    testCaseVi: 'Nhập file FBX/GLTF xe Sedan/Tải/Khách vào Unity 6 Editor, gán các nhánh WheelKnuckle/WheelSpin vào VehicleVisualsController và kiểm tra CourseDebugGizmoDrawer trong Scene View.',
    expectedBehaviorVi:
      'Cần thực hiện trong Unity 6 Editor khi gắn mô hình FBX bên ngoài để xác nhận hướng trục (Pivot) của bánh xe và kích thước BoxCollider thân xe khớp 1:1.',
    verificationStatus: 'UNITY_EDITOR_REQUIRED',
    statusBadgeVi: 'Cần kiểm thử thực tế trong Unity 6 Editor',
  },
];

