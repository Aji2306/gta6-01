// Solana Shores: Vice Syndicate - Main Game Controller & Orchestrator
// Three.js Scene, Render Loop, Controls, Posed Deterministic Scenes, Menus

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';
import { City } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PedestrianManager } from './pedestrians.js';
import { Player } from './player.js';
import { CombatManager } from './combat.js';
import { PoliceManager } from './police.js';
import { MissionManager } from './missions.js';
import { HUD } from './hud.js';
import { SaveSystem } from './save.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.isPaused = false;
    this.isPlaying = false;
    this.clock = new THREE.Clock();

    // Input state
    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      handbrake: false,
      horn: false
    };

    // Touch controls (detected in initTouch; desktop stays untouched)
    this.isTouch = false;

    this.initRenderer();
    this.initScene();
    this.initWorld();
    this.initInput();
    this.initMenus();

    // Check URL parameters for deterministic screenshot posing
    this.checkScreenshotMode();

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x81d4fa); // Sun-drenched coastal sky
    this.scene.fog = new THREE.FogExp2(0x81d4fa, 0.0028);

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.2,
      600
    );

    // Warm Sun-soaked Golden Lighting
    const hemiLight = new THREE.HemisphereLight(0x90caf9, 0xd7ccc8, 0.85);
    hemiLight.position.set(0, 80, 0);
    this.scene.add(hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff3e0, 1.4);
    this.sunLight.position.set(120, 150, 90);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 380;
    this.sunLight.shadow.camera.left = -120;
    this.sunLight.shadow.camera.right = 120;
    this.sunLight.shadow.camera.top = 120;
    this.sunLight.shadow.camera.bottom = -120;
    this.scene.add(this.sunLight);
  }

  initWorld() {
    this.city = new City(this.scene);
    this.vehicleManager = new VehicleManager(this.scene, this.city);
    this.pedManager = new PedestrianManager(this.scene, this.city);

    // Initial player start position: Ocean Boulevard sidewalk
    const startPos = new THREE.Vector3(56, 0, -35);
    this.player = new Player(this.scene, this.camera, this.city, startPos);

    this.combatManager = new CombatManager(
      this.scene,
      this.camera,
      this.player,
      this.pedManager,
      this.vehicleManager
    );

    this.policeManager = new PoliceManager(
      this.scene,
      this.city,
      this.player,
      this.vehicleManager
    );

    this.missionManager = new MissionManager(
      this.scene,
      this.player,
      this.vehicleManager,
      this.policeManager,
      this.pedManager
    );

    this.hud = new HUD(
      this.player,
      this.vehicleManager,
      this.policeManager,
      this.missionManager,
      this.combatManager,
      this.city
    );

    // Wire callbacks
    this.policeManager.onWasted = () => this.handleDeath('WASTED');
    this.policeManager.onBusted = () => this.handleDeath('BUSTED');
  }

  initInput() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = true;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = true;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = true;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = true;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = true;
      if (code === 'Space') {
        this.input.jump = true;
        this.input.handbrake = true;
      }
      if (code === 'KeyH') this.input.horn = true;

      // Enter / Exit Vehicle (E or F)
      if (code === 'KeyE' || code === 'KeyF') {
        this.handleVehicleInteract();
      }

      // Reload
      if (code === 'KeyR') {
        this.combatManager.reload();
      }

      // Weapon Switching
      if (code === 'Digit1') this.combatManager.setWeapon('fists');
      if (code === 'Digit2') this.combatManager.setWeapon('pistol');

      // Pause Menu (Escape or KeyP)
      if (code === 'Escape' || code === 'KeyP') {
        this.togglePause();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      if (code === 'KeyW' || code === 'ArrowUp') this.input.forward = false;
      if (code === 'KeyS' || code === 'ArrowDown') this.input.backward = false;
      if (code === 'KeyA' || code === 'ArrowLeft') this.input.left = false;
      if (code === 'KeyD' || code === 'ArrowRight') this.input.right = false;
      if (code === 'ShiftLeft' || code === 'ShiftRight') this.input.sprint = false;
      if (code === 'Space') {
        this.input.jump = false;
        this.input.handbrake = false;
      }
      if (code === 'KeyH') this.input.horn = false;
    });

    // Pointer Lock & Camera Rotation (desktop mouse only)
    this.canvas.addEventListener('click', () => {
      if (this.isTouch) return;
      if (this.isPlaying && !this.isPaused) {
        this.lockPointer();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas && !this.isPaused) {
        this.player.rotateCamera(e.movementX, e.movementY);
      }
    });

    // Attack / Fire
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.doAttack();
      }
    });

    // Touch controls (virtual joystick, camera drag, action buttons)
    this.initTouch();
  }

  // Request pointer lock on desktop only; no-op on touch (no console errors).
  lockPointer() {
    if (this.isTouch) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (err) { /* pointer lock unavailable */ }
  }

  // Single attack entry point: mouse click and the touch ATTACK button
  // both run exactly this code path.
  doAttack() {
    if (!this.isPlaying || this.isPaused) return;
    audio.ensureContext();
    this.combatManager.attack(
      (crime, stars) => this.policeManager.reportCrime(crime, stars),
      (ped, dropCash) => {
        this.pedManager.spawnCashDrop(ped.position, dropCash, (amt) => {
          this.player.addCash(amt);
          this.hud.showToast(`+$${amt} Cash Collected`, 2500);
        });
        this.missionManager.recordKill();
      }
    );
  }

  initTouch() {
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!this.isTouch) return;
    document.body.classList.add('touch');

    const controls = document.getElementById('touch-controls');
    const joystick = document.getElementById('touch-joystick');
    const stick = document.getElementById('touch-stick');
    const btnEnter = document.getElementById('touch-btn-enter');
    const btnAttack = document.getElementById('touch-btn-attack');
    const btnPause = document.getElementById('touch-btn-pause');
    if (!controls || !joystick || !stick || !btnEnter || !btnAttack || !btnPause) return;

    // Long-press must not open a context menu over the game.
    controls.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // --- Virtual joystick: drives the SAME boolean input as WASD ---
    // Push up = forward (W), down = backward (S), left/right = strafe (A/D).
    // Dead zone 0.28 so a resting thumb never moves the player.
    const JOY_RADIUS = 36; // max knob travel in px
    const DEAD_ZONE = 0.28;
    let joyPointerId = null;

    const setJoystickInput = (nx, ny) => {
      this.input.forward = ny < -DEAD_ZONE;
      this.input.backward = ny > DEAD_ZONE;
      this.input.left = nx < -DEAD_ZONE;
      this.input.right = nx > DEAD_ZONE;
    };

    const moveStick = (e) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > JOY_RADIUS) {
        dx = (dx / len) * JOY_RADIUS;
        dy = (dy / len) * JOY_RADIUS;
      }
      stick.style.transform = `translate(${dx}px, ${dy}px)`;
      setJoystickInput(dx / JOY_RADIUS, dy / JOY_RADIUS);
    };

    const resetJoystick = () => {
      joyPointerId = null;
      stick.style.transform = 'translate(0px, 0px)';
      setJoystickInput(0, 0);
    };

    joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (joyPointerId !== null) return;
      joyPointerId = e.pointerId;
      try { joystick.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      moveStick(e);
    });
    joystick.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyPointerId) return;
      e.preventDefault();
      moveStick(e);
    });
    joystick.addEventListener('pointerup', (e) => {
      if (e.pointerId === joyPointerId) resetJoystick();
    });
    joystick.addEventListener('pointercancel', (e) => {
      if (e.pointerId === joyPointerId) resetJoystick();
    });

    // --- Camera: drag on the right ~55% of the screen ---
    // Same call as pointer-lock mousemove (player.rotateCamera), so the
    // look speed matches the mouse exactly. preventDefault() on pointerdown
    // also suppresses the synthetic mousedown/click (no accidental attack
    // or pointer-lock attempt from a touch drag).
    let camPointerId = null;
    let camLastX = 0;
    let camLastY = 0;

    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      e.preventDefault();
      if (!this.isPlaying || this.isPaused) return;
      if (camPointerId !== null) return;
      if (e.clientX < window.innerWidth * 0.45) return;
      camPointerId = e.pointerId;
      camLastX = e.clientX;
      camLastY = e.clientY;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== camPointerId) return;
      e.preventDefault();
      if (!this.isPlaying || this.isPaused) return;
      this.player.rotateCamera(e.clientX - camLastX, e.clientY - camLastY);
      camLastX = e.clientX;
      camLastY = e.clientY;
    });
    const endCamDrag = (e) => {
      if (e.pointerId === camPointerId) camPointerId = null;
    };
    this.canvas.addEventListener('pointerup', endCamDrag);
    this.canvas.addEventListener('pointercancel', endCamDrag);

    // --- Action buttons: same handlers as the keyboard keys ---
    btnEnter.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.handleVehicleInteract(); // same as F / E
    });
    btnAttack.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.doAttack(); // same as left mouse click
    });
    btnPause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.togglePause(); // same as Esc / P
    });
  }

  handleVehicleInteract() {
    audio.ensureContext();
    if (this.player.inVehicle) {
      this.player.exitVehicle();
      this.hud.showToast('Exited vehicle', 2000);
    } else {
      const nearCar = this.vehicleManager.getNearestVehicle(this.player.position, 4.5);
      if (nearCar) {
        this.player.enterVehicle(nearCar);
        this.hud.showToast(`Commandeered ${nearCar.cfg.name}!`, 2500);
      }
    }
  }

  initMenus() {
    const startScreen = document.getElementById('start-screen');
    const pauseScreen = document.getElementById('pause-screen');
    const btnStart = document.getElementById('btn-start');
    const btnContinue = document.getElementById('btn-continue');
    const btnResume = document.getElementById('btn-resume');
    const btnSave = document.getElementById('btn-save');
    const btnRestart = document.getElementById('btn-restart-mission');
    const btnSound = document.getElementById('btn-sound-toggle');
    const btnRadio = document.getElementById('btn-radio-toggle');

    if (SaveSystem.hasSave() && btnContinue) {
      btnContinue.style.display = 'block';
      btnContinue.addEventListener('click', () => {
        audio.ensureContext();
        SaveSystem.load(this.player, this.missionManager, this.combatManager);
        startScreen.classList.add('hidden');
        this.isPlaying = true;
        this.lockPointer();
        audio.startRadio();
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', () => {
        audio.ensureContext();
        startScreen.classList.add('hidden');
        this.isPlaying = true;
        this.lockPointer();
        audio.startRadio();
      });
    }

    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.togglePause();
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const ok = SaveSystem.save(this.player, this.missionManager, this.combatManager);
        this.hud.showToast(ok ? 'Game Saved Successfully!' : 'Save Failed', 3000);
      });
    }

    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        this.missionManager.restartCurrentMission();
        this.togglePause();
        this.hud.showToast('Mission Restarted', 3000);
      });
    }

    if (btnSound) {
      btnSound.addEventListener('click', () => {
        const on = audio.toggleMute();
        btnSound.textContent = `Audio: ${on ? 'ON' : 'OFF'}`;
      });
    }

    if (btnRadio) {
      btnRadio.addEventListener('click', () => {
        const on = audio.toggleRadio();
        btnRadio.textContent = `Radio Music: ${on ? 'ON' : 'OFF'}`;
      });
    }
  }

  togglePause() {
    if (!this.isPlaying) return;
    this.isPaused = !this.isPaused;
    const pauseScreen = document.getElementById('pause-screen');
    if (this.isPaused) {
      pauseScreen.classList.remove('hidden');
      document.exitPointerLock?.();
    } else {
      pauseScreen.classList.add('hidden');
      this.lockPointer();
    }
  }

  handleDeath(type = 'WASTED') {
    const deathScreen = document.getElementById('death-screen');
    const deathTitle = document.getElementById('death-title');
    const deathSub = document.getElementById('death-sub');

    deathTitle.textContent = type;
    deathTitle.style.color = type === 'BUSTED' ? '#1e88e5' : '#e53935';
    deathSub.textContent = type === 'BUSTED'
      ? 'Bailed out at SSPD Central Precinct (-$500)...'
      : 'Treated at Solana Memorial Clinic (-$500)...';

    deathScreen.classList.remove('hidden');

    setTimeout(() => {
      // Respawn player
      this.player.heal(100, 50);
      this.player.cash = Math.max(0, this.player.cash - 500);
      this.policeManager.setWantedLevel(0);

      // Hospital location near downtown
      this.player.position.set(-40, 0, -80);
      this.player.mesh.position.copy(this.player.position);
      if (this.player.inVehicle) {
        this.player.exitVehicle();
      }

      deathScreen.classList.add('hidden');
    }, 3200);
  }

  // Deterministic screenshot scenes for ?shot=cover, drive, chase, mission
  checkScreenshotMode() {
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (!shot) return;

    // Hide menus immediately
    document.getElementById('start-screen')?.classList.add('hidden');
    document.getElementById('pause-screen')?.classList.add('hidden');
    this.isPlaying = true;

    if (shot === 'cover') {
      // Cover scene: Leo standing beside his crimson sports coupe on sunny Ocean Blvd
      this.player.position.set(58, 0, -36);
      this.player.heading = Math.PI * 0.25;
      this.player.mesh.position.copy(this.player.position);
      this.player.mesh.rotation.y = this.player.heading;
      this.combatManager.setWeapon('pistol');

      // Place hero car prominently
      const heroCar = this.vehicleManager.heroVehicle;
      if (heroCar) {
        heroCar.position.set(61, 0, -35);
        heroCar.heading = Math.PI * 0.95;
        heroCar.mesh.position.copy(heroCar.position);
        heroCar.mesh.rotation.y = heroCar.heading;
      }

      // Camera: Dramatic cinematic low-angle hero framing showing Leo, car, palms, and sunny bay
      this.camera.position.set(55.2, 1.4, -40.5);
      this.camera.lookAt(60.2, 1.6, -35.2);

      this.hud.updateMissionBanner();
    } else if (shot === 'drive') {
      // Driving scene: Leo driving crimson coupe at speed along Ocean Blvd
      const heroCar = this.vehicleManager.heroVehicle;
      if (heroCar) {
        heroCar.position.set(60, 0, 10);
        heroCar.heading = 0;
        heroCar.speed = 38; // ~68 MPH
        this.player.enterVehicle(heroCar);

        this.camera.position.set(60, 2.8, -5);
        this.camera.lookAt(60, 1.4, 25);
      }
    } else if (shot === 'chase') {
      // Police Chase scene: 3-star wanted level, 2 cruisers pursuing player
      this.policeManager.setWantedLevel(3);

      const heroCar = this.vehicleManager.heroVehicle;
      if (heroCar) {
        heroCar.position.set(60, 0, 60);
        heroCar.heading = 0;
        heroCar.speed = 34;
        this.player.enterVehicle(heroCar);

        // Position 2 police cruisers right behind player with flashing lights
        if (this.policeManager.cops.length >= 2) {
          const cop1 = this.policeManager.cops[0];
          cop1.position.set(58, 0, 44);
          cop1.heading = 0.08;
          cop1.speed = 36;
          cop1.sirenActive = true;

          const cop2 = this.policeManager.cops[1];
          cop2.position.set(62.5, 0, 36);
          cop2.heading = -0.06;
          cop2.speed = 37;
          cop2.sirenActive = true;
        }

        // Camera: Dynamic rear-quarter action shot showing pursuit
        this.camera.position.set(64, 3.2, 45);
        this.camera.lookAt(59.5, 1.6, 62);
      }
    } else if (shot === 'mission') {
      // Mission scene: Mission 2 active with yellow beacon in Downtown Plaza
      this.missionManager.currentMissionIndex = 1;
      this.missionManager.currentStepIndex = 0;
      this.missionManager.updateWaypoint();

      this.player.position.set(-36, 0, -28);
      this.player.heading = Math.PI;
      this.player.mesh.position.copy(this.player.position);
      this.combatManager.setWeapon('pistol');

      this.camera.position.set(-36, 2.2, -35);
      this.camera.lookAt(-39, 1.5, -2);
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(0.1, this.clock.getDelta());

    if (this.isPlaying && !this.isPaused) {
      this.city.update(dt);
      this.player.update(dt, this.input);
      this.vehicleManager.update(dt, this.input);
      this.pedManager.update(dt, this.player.position);
      this.combatManager.update(dt);
      this.policeManager.update(dt, (status) => {
        if (status === 'evaded') this.hud.showToast('Police Evaded! Heat Cleared.', 3500);
      });
      this.missionManager.update(dt, (toast, dur) => this.hud.showToast(toast, dur));

      // Proximity prompt for vehicle entry
      if (!this.player.inVehicle) {
        const nearCar = this.vehicleManager.getNearestVehicle(this.player.position, 4.0);
        if (nearCar) {
          this.hud.showInteractPrompt(`[F] Enter ${nearCar.cfg.name}`);
        } else {
          this.hud.showInteractPrompt(null);
        }
      } else {
        this.hud.showInteractPrompt('[F] Exit Vehicle');
      }

      this.hud.update(dt);
    }

    // Touch controls: visible only while actually playing (touch only).
    // The ENTER button label follows the vehicle state (ENTER / EXIT).
    if (this.isTouch) {
      const playing = this.isPlaying && !this.isPaused;
      if (playing !== this._touchPlaying) {
        this._touchPlaying = playing;
        document.body.classList.toggle('playing', playing);
      }
      const inVehicle = !!this.player.inVehicle;
      if (inVehicle !== this._touchInVehicle) {
        this._touchInVehicle = inVehicle;
        const btnEnter = document.getElementById('touch-btn-enter');
        if (btnEnter) btnEnter.textContent = inVehicle ? 'EXIT' : 'ENTER';
      }
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Launch Game on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
