import {
  getPassResultClipUrl,
  sanitizeDigitsToWordsVi,
} from '../course/InstructorVoice2026';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  public isMuted = false;
  private initialized = false;
  public lastSpokenTextVi = '';

  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private speechTimerId: number | null = null;
  private chainedScoreAudioEl: HTMLAudioElement | null = null;

  public init(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
        if (!window.speechSynthesis.onvoiceschanged) {
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.getVoices();
          };
        }
      } catch {}
    }
    if (this.initialized) return;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
    } catch {
      // Web Audio blocked or unavailable
    }
  }

  public updateEngineSound(
    _rpm: number,
    _throttle: number,
    _isRunning: boolean,
    _peakSlip: number
  ): void {
    // Continuous synth oscillator drone and tire squeal whine ("tiếng hu hu") disabled per user preference
  }

  public playShiftClick(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.045);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } catch {}
  }

  public playEngineIgnition(starting: boolean): void {
    this.init();
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      if (starting) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(60, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.18);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.23);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.14);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.17);
      }
    } catch {}
  }

  public playStallShudder(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(52, now);
      osc.frequency.linearRampToValueAtTime(22, now + 0.18);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch {}
  }

  public playCollisionImpact(severity: number): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
      const vol = Math.min(0.14, 0.04 + severity * 0.02);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {}
  }

  public playBlinkerTick(isHighTick: boolean): void {
    if (this.isMuted || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(isHighTick ? 920 : 640, now);
      osc.frequency.exponentialRampToValueAtTime(
        isHighTick ? 420 : 310,
        now + 0.018
      );
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.025);
    } catch {}
  }

  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  public isHornPlaying = false;

  public startCarHorn(): void {
    this.init();
    if (this.isMuted || !this.ctx || this.isHornPlaying) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;

      // Dual-tone automotive horn (F4 ~349Hz / A4 ~440Hz + harmonic overtone filter)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'sawtooth';
      osc1.frequency.setValueAtTime(410, now);
      osc2.frequency.setValueAtTime(512, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1350, now);
      filter.Q.setValueAtTime(2.2, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.095, now + 0.025);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);

      this.hornOsc1 = osc1;
      this.hornOsc2 = osc2;
      this.hornGain = gain;
      this.isHornPlaying = true;
    } catch {}
  }

  public stopCarHorn(): void {
    if (!this.isHornPlaying) return;
    this.isHornPlaying = false;
    try {
      if (this.ctx && this.hornGain && this.hornOsc1 && this.hornOsc2) {
        const now = this.ctx.currentTime;
        this.hornGain.gain.cancelScheduledValues(now);
        this.hornGain.gain.setValueAtTime(
          Math.max(0.001, this.hornGain.gain.value),
          now
        );
        this.hornGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.045);
        const o1 = this.hornOsc1;
        const o2 = this.hornOsc2;
        setTimeout(() => {
          try {
            o1.stop();
            o2.stop();
            o1.disconnect();
            o2.disconnect();
          } catch {}
        }, 60);
      }
    } catch {}
    this.hornOsc1 = null;
    this.hornOsc2 = null;
    this.hornGain = null;
  }

  public playCarHorn(durationMs = 280): void {
    this.startCarHorn();
    window.setTimeout(() => {
      this.stopCarHorn();
    }, durationMs);
  }

  public updateEmergencySiren(_active: boolean): void {
    // Continuous wailing siren ("tiếng hú") disabled per user preference
  }

  private activeAudioEl: HTMLAudioElement | null = null;
  private activeSfxEl: HTMLAudioElement | null = null;

  /**
   * Plays the crisp single high electronic "Tuýt!" ("Tus!") beep of Vietnamese driving exam cars
   * when a stop line or parking bay sensor recognizes and accepts the maneuver ("Đã nhận bài").
   */
  public playSensorRecognitionBeep(): void {
    this.init();
    if (this.isMuted) return;
    if (typeof Audio !== 'undefined') {
      try {
        const sfx = new Audio('/audio/voice/tuyt.wav');
        sfx.volume = 1.0;
        this.activeSfxEl = sfx;
        sfx.play().catch(() => {
          this.playWebAudioTuytFallback();
        });
        return;
      } catch {}
    }
    this.playWebAudioTuytFallback();
  }

  private playWebAudioTuytFallback(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(2080, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.01);
      gain.gain.setValueAtTime(0.45, now + 0.32);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.39);
    } catch {}
  }

  /**
   * Plays the iconic 2-tone electronic "Bính-Boong" chime of Vietnamese automated driving exam cars.
   */
  public playExamChime(): void {
    this.init();
    if (this.isMuted) return;
    if (typeof Audio !== 'undefined') {
      try {
        const sfx = new Audio('/audio/voice/binh_boong.wav');
        sfx.volume = 1.0;
        this.activeSfxEl = sfx;
        sfx.play().catch(() => {
          this.playWebAudioChimeFallback();
        });
        return;
      } catch {}
    }
    this.playWebAudioChimeFallback();
  }

  private playWebAudioChimeFallback(): void {
    if (this.isMuted || !this.ctx) return;
    try {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      const now = this.ctx.currentTime;

      // Tone 1: High bell (B5 = 987.77Hz)
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.45, now + 0.012);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.38);

      // Tone 2: Warm lower bell (G5 = 783.99Hz)
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, now + 0.24);
      gain2.gain.setValueAtTime(0.001, now + 0.24);
      gain2.gain.linearRampToValueAtTime(0.45, now + 0.26);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.78);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now + 0.24);
      osc2.stop(now + 0.80);
    } catch {}
  }

  /**
   * Plays the urgent electronic alarm burst ("Tút - Tút - Tút!") for the Emergency Hazard Station.
   */
  public playEmergencyHazardAlarm(): void {
    this.init();
    if (this.isMuted) return;
    if (typeof Audio !== 'undefined') {
      try {
        const sfx = new Audio('/audio/voice/coi_hu_khan_cap.wav');
        sfx.volume = 1.0;
        this.activeSfxEl = sfx;
        sfx.play().catch(() => {
          this.playSensorRecognitionBeep();
        });
        return;
      } catch {}
    }
    this.playSensorRecognitionBeep();
  }

  private resolvePreRecordedVoiceClipUrl(
    textVi: string,
    passScoreForResult?: number
  ): string | null {
    const t = textVi.toLowerCase();

    // 1. QUY TẮC VÀ HIỆU LỆNH XUẤT PHÁT
    if (
      t.includes('mời học viên chuẩn bị và thắt dây an toàn') ||
      t.includes('vào số một, bật xi nhan trái, chờ lệnh xuất phát')
    ) {
      return '/audio/voice/raw_start_prepare.mp3';
    }
    if (
      t === 'xuất phát.' ||
      t === 'xuất phát' ||
      t.includes('bíp. xuất phát')
    ) {
      return '/audio/voice/raw_start_bip.mp3';
    }

    // 2. THÔNG BÁO CHUYỂN BÀI THI (CHỈ ĐỌC TÊN BÀI CHUẨN XE CHIP SÂN THI)
    if (t.includes('nhường đường cho người đi bộ') || t.includes('người đi bộ')) {
      return '/audio/voice/bai_tiep_theo_nguoi_di_bo.mp3';
    }
    if (
      t.includes('khởi hành xe ngang dốc') ||
      t.includes('khởi hành ngang dốc') ||
      t.includes('dừng xe và khởi hành xe ngang dốc') ||
      t.includes('ngang dốc') ||
      t.includes('dốc cầu')
    ) {
      return '/audio/voice/bai_tiep_theo_ngang_doc.mp3';
    }
    if (
      t.includes('qua vệt bánh xe và đường hẹp vuông góc') ||
      t.includes('vệt bánh xe') ||
      t.includes('hàng đinh')
    ) {
      return '/audio/voice/bai_tiep_theo_vet_banh_xe.mp3';
    }
    if (
      t.includes('qua ngã tư có tín hiệu') ||
      t.includes('qua ngã tư có đèn tín hiệu') ||
      t.includes('ngã tư')
    ) {
      return '/audio/voice/bai_tiep_theo_nga_tu.mp3';
    }
    if (t.includes('đường vòng quanh co') || t.includes('chữ s')) {
      return '/audio/voice/bai_tiep_theo_duong_vong_quanh_co.mp3';
    }
    if (t.includes('ghép xe dọc vào nơi đỗ') || t.includes('ghép xe dọc')) {
      return '/audio/voice/bai_tiep_theo_ghep_xe_doc.mp3';
    }
    if (
      t.includes('tạm dừng ở nơi có đường sắt chạy qua') ||
      t.includes('đường sắt chạy qua') ||
      t.includes('đường sắt')
    ) {
      return '/audio/voice/bai_tiep_theo_duong_sat.mp3';
    }
    if (
      t.includes('thay đổi số trên đường thẳng') ||
      t.includes('thay đổi số') ||
      t.includes('tăng tốc')
    ) {
      return '/audio/voice/bai_tiep_theo_thay_doi_so.mp3';
    }
    if (t.includes('ghép xe ngang vào nơi đỗ') || t.includes('ghép xe ngang')) {
      return '/audio/voice/bai_tiep_theo_ghep_xe_ngang.mp3';
    }
    if (
      t.includes('bài thi cuối cùng: kết thúc') ||
      t.includes('bài thi kết thúc') ||
      t.includes('kết thúc')
    ) {
      return '/audio/voice/bai_tiep_theo_ket_thuc.mp3';
    }

    // 3. BÀI THI TÌNH HUỐNG NGUY HIỂM KHẨN CẤP
    if (t.includes('hú hú hú') || t.includes('dừng nguy hiểm')) {
      return '/audio/voice/tinh_huong_khan_cap.mp3';
    }
    if (t.includes('không phanh dừng xe hoặc không bấm nút ưu tiên')) {
      return '/audio/voice/loi_khan_cap_khong_dung.mp3';
    }
    if (t.includes('tắt nút ưu tiên trước khi có tiếng bíp')) {
      return '/audio/voice/loi_khan_cap_tat_som.mp3';
    }

    // 4. THÔNG BÁO LỖI VÀ ĐIỂM SỐ CHUNG
    if (t.includes('không thắt dây an toàn')) {
      return '/audio/voice/loi_khong_that_day_an_toan.mp3';
    }
    if (t.includes('không bật xi nhan trái khi xuất phát')) {
      return '/audio/voice/loi_khong_xi_nhan_trai_xuat_phat.mp3';
    }
    if (t.includes('không tắt xi nhan trái sau khi qua vạch')) {
      return '/audio/voice/loi_khong_tat_xi_nhan_trai.mp3';
    }
    if (t.includes('dừng xe chưa đến vạch quy định')) {
      return '/audio/voice/loi_dung_chua_den_vach.mp3';
    }
    if (t.includes('dừng xe quá vạch trên dốc')) {
      return '/audio/voice/truot_dung_qua_vach_tren_doc.mp3';
    }
    if (t.includes('dừng xe quá vạch quy định')) {
      return '/audio/voice/loi_dung_qua_vach.mp3';
    }
    if (t.includes('không dừng xe ở vạch dừng quy định')) {
      return '/audio/voice/loi_khong_dung_vach.mp3';
    }
    if (t.includes('bánh xe đè vạch')) {
      return '/audio/voice/loi_banh_xe_de_vach.mp3';
    }
    if (t.includes('không bật xi nhan tại ngã tư')) {
      return '/audio/voice/loi_khong_xi_nhan_nga_tu.mp3';
    }
    if (t.includes('vi phạm tín hiệu đèn đỏ')) {
      return '/audio/voice/loi_vi_pham_den_do.mp3';
    }
    if (t.includes('xe không nhận bài ghép xe')) {
      return '/audio/voice/loi_khong_nhan_bai_ghep_xe.mp3';
    }
    if (t.includes('không bật xi nhan phải khi kết thúc')) {
      return '/audio/voice/loi_khong_xi_nhan_phai_ket_thuc.mp3';
    }
    if (t.includes('xe chết máy')) {
      return '/audio/voice/loi_xe_chet_may.mp3';
    }
    if (t.includes('tốc độ động cơ quá bốn nghìn vòng')) {
      return '/audio/voice/loi_toc_do_dong_co_4000.mp3';
    }

    // 5. CÁC LỖI QUÁ THỜI GIAN
    if (t.includes('quá hai mươi giây không xuất phát')) {
      return '/audio/voice/loi_qua_20s_xuat_phat.mp3';
    }
    if (t.includes('dừng quá ba mươi giây khi đèn xanh đã bật')) {
      return '/audio/voice/loi_qua_30s_den_xanh.mp3';
    }
    if (t.includes('quá thời gian hai phút một bài thi')) {
      return '/audio/voice/loi_qua_2_phut_mot_bai.mp3';
    }
    if (t.includes('quá tổng thời gian mười tám phút quy định')) {
      return '/audio/voice/loi_qua_18_phut_toan_bai.mp3';
    }

    // 6. THÔNG BÁO TRƯỢT TRỰC TIẾP (TƯỚC QUYỀN SÁT HẠCH)
    if (t.includes('quá ba mươi giây không xuất phát')) {
      return '/audio/voice/truot_qua_30s_xuat_phat.mp3';
    }
    if (t.includes('quá ba mươi giây không qua dốc')) {
      return '/audio/voice/truot_qua_30s_khong_qua_doc.mp3';
    }
    if (t.includes('xe bị tụt dốc quá năm mươi centimet')) {
      return '/audio/voice/truot_tut_doc_50cm.mp3';
    }
    if (t.includes('bánh xe đi ra ngoài hàng đinh')) {
      return '/audio/voice/truot_ra_ngoai_hang_dinh.mp3';
    }
    if (t.includes('lái xe lên vỉa hè hoặc gây tai nạn')) {
      return '/audio/voice/truot_len_via_he_tai_nan.mp3';
    }

    // 7. KẾT QUẢ CHUNG CUỘC
    if (t.includes('chúc mừng bạn đã thi đạt')) {
      return getPassResultClipUrl(passScoreForResult ?? 100);
    }
    if (
      t.includes('bạn đã thi trượt') ||
      t.includes('dưới tám mươi điểm')
    ) {
      return '/audio/voice/ket_qua_truot_duoi_80.mp3';
    }

    if (t.includes('không thay đổi số') || t.includes('thay đổi số trên đường thẳng')) {
      return '/audio/voice/loi_b9_thay_doi_so.mp3';
    }
    if (t.includes('quá tốc độ')) {
      return '/audio/voice/loi_qua_toc_do.mp3';
    }
    if (t.includes('phanh tay')) {
      return '/audio/voice/loi_phanh_tay.mp3';
    }

    return null;
  }

  private voiceQueue: string[] = [];
  private isVoicePlaying = false;
  private currentVoiceEl: HTMLAudioElement | null = null;

  public clearVoiceQueue(): void {
    this.voiceQueue = [];
    if (this.currentVoiceEl) {
      try {
        this.currentVoiceEl.pause();
        this.currentVoiceEl.currentTime = 0;
      } catch {}
      this.currentVoiceEl = null;
    }
    this.isVoicePlaying = false;
  }

  private playNextInVoiceQueue(): void {
    if (this.isMuted || this.voiceQueue.length === 0) {
      this.isVoicePlaying = false;
      this.currentVoiceEl = null;
      return;
    }

    this.isVoicePlaying = true;
    const nextUrl = this.voiceQueue.shift()!;
    try {
      const audio = new Audio(nextUrl);
      this.currentVoiceEl = audio;
      audio.volume = 1.0;
      audio.onended = () => {
        this.currentVoiceEl = null;
        this.playNextInVoiceQueue();
      };
      audio.onerror = () => {
        this.currentVoiceEl = null;
        this.playNextInVoiceQueue();
      };
      audio.play().catch(() => {
        this.currentVoiceEl = null;
        this.playNextInVoiceQueue();
      });
    } catch {
      this.isVoicePlaying = false;
      this.currentVoiceEl = null;
    }
  }

  public enqueueVoiceClips(urls: string[], interrupt = false): void {
    if (this.isMuted) return;
    if (interrupt) {
      this.clearVoiceQueue();
    }
    const valid = urls.filter((u) => Boolean(u));
    if (valid.length === 0) return;
    this.voiceQueue.push(...valid);
    if (!this.isVoicePlaying) {
      this.playNextInVoiceQueue();
    }
  }

  /**
   * Announces the current driving test exercise or violation out loud in authentic Vietnamese
   * using pre-recorded 2026 Raw Chip Speaker MP3 audio clips with sequential Audio Queue chaining.
   */
  public announceExerciseVoiceVi(
    textVi: string,
    withChime:
      | boolean
      | 'CHIME'
      | 'TUYT'
      | 'TUYT_AND_CHIME'
      | 'ALARM_AND_VOICE' = true,
    remainingScoreForVoice?: number,
    directClipUrl?: string
  ): void {
    this.init();
    if (textVi) {
      this.lastSpokenTextVi = sanitizeDigitsToWordsVi(textVi);
    }
    if (this.isMuted) return;

    // Handle sensor sound effect alone
    if (!textVi && !directClipUrl) {
      if (withChime === 'TUYT') {
        this.playSensorRecognitionBeep();
      } else if (withChime === 'TUYT_AND_CHIME') {
        this.playSensorRecognitionBeep();
        window.setTimeout(() => {
          if (!this.isMuted) this.playExamChime();
        }, 320);
      } else if (withChime === true || withChime === 'CHIME') {
        this.playExamChime();
      } else if (withChime === 'ALARM_AND_VOICE') {
        this.playEmergencyHazardAlarm();
      }
      return;
    }

    const clipsToPlay: string[] = [];

    // 1. Chime / Sfx prefix
    if (withChime === 'ALARM_AND_VOICE') {
      clipsToPlay.push('/audio/voice/coi_hu_khan_cap.wav');
    } else if (withChime === 'TUYT_AND_CHIME') {
      clipsToPlay.push('/audio/voice/tuyt.wav');
      clipsToPlay.push('/audio/voice/binh_boong.wav');
    } else if (withChime === 'TUYT') {
      clipsToPlay.push('/audio/voice/tuyt.wav');
    } else if (withChime === true || withChime === 'CHIME') {
      clipsToPlay.push('/audio/voice/binh_boong.wav');
    }

    // 2. Main Voice Clip
    const resolvedClip =
      directClipUrl ||
      this.resolvePreRecordedVoiceClipUrl(textVi, remainingScoreForVoice);
    if (resolvedClip) {
      clipsToPlay.push(resolvedClip);
    }

    // 3. Remaining Score Clip (if provided and valid)
    if (
      remainingScoreForVoice !== undefined &&
      remainingScoreForVoice !== null &&
      !resolvedClip?.includes('ket_qua_dat_') &&
      !resolvedClip?.includes('ket_qua_truot_') &&
      !resolvedClip?.includes('truot_')
    ) {
      const s = Math.max(0, Math.min(100, Math.round(remainingScoreForVoice)));
      if (s >= 65 && s <= 100) {
        clipsToPlay.push(`/audio/voice/diem_con_${s}.mp3`);
      } else if (s === 0) {
        clipsToPlay.push('/audio/voice/diem_con_0.mp3');
      }

      // If score is under 80, also chain the fail message
      if (s < 80) {
        clipsToPlay.push('/audio/voice/ket_qua_truot_duoi_80.mp3');
      }
    }

    if (clipsToPlay.length > 0) {
      const isUrgent =
        withChime === 'ALARM_AND_VOICE' ||
        (remainingScoreForVoice !== undefined && remainingScoreForVoice < 80) ||
        textVi.includes('truột') ||
        textVi.includes('trượt');
      this.enqueueVoiceClips(clipsToPlay, isUrgent);
      if (!resolvedClip && textVi) {
        this.speakFallbackWebSpeech(sanitizeDigitsToWordsVi(textVi));
      }
    } else if (textVi) {
      this.speakFallbackWebSpeech(sanitizeDigitsToWordsVi(textVi));
    }
  }

  private speakFallbackWebSpeech(textVi: string): void {
    const cleanText = sanitizeDigitsToWordsVi(textVi);
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      const synth = window.speechSynthesis;
      if (synth.paused) {
        synth.resume();
      }
      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = 'vi-VN';
      utter.rate = 1.02;
      utter.pitch = 1.0;
      utter.volume = 1.0;

      const voices = synth.getVoices();
      const viVoice =
        voices.find(
          (v) =>
            v.lang.toLowerCase().startsWith('vi') ||
            v.name.toLowerCase().includes('viet') ||
            v.name.toLowerCase().includes('hoaimy') ||
            v.name.toLowerCase().includes('namminh') ||
            v.name.toLowerCase().includes('linh') ||
            v.name.toLowerCase().includes('an')
        ) ?? null;

      // TUYỆT ĐỐI CẤM PHÁT TIẾNG ANH: Nếu máy/trình duyệt không có giọng tiếng Việt,
      // KHÔNG BAO GIỜ được dùng giọng tiếng Anh (như Samantha/Alex) để đọc tiếng Việt!
      if (!viVoice) {
        return;
      }
      utter.voice = viVoice;

      this.activeUtterance = utter;
      utter.onend = () => {
        if (this.activeUtterance === utter) {
          this.activeUtterance = null;
        }
      };
      synth.speak(utter);
    } catch {}
  }

  public dispose(): void {
    this.stopCarHorn();
    this.clearVoiceQueue();
    if (this.activeAudioEl) {
      try {
        this.activeAudioEl.pause();
      } catch {}
      this.activeAudioEl = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
