// Combat System for Solana Shores: Vice Syndicate
// Melee punching, 9mm firearm shooting, muzzle flash, raycast hits, ammo management

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

export class CombatManager {
  constructor(scene, camera, player, pedestrianManager, vehicleManager) {
    this.scene = scene;
    this.camera = camera;
    this.player = player;
    this.peds = pedestrianManager;
    this.vehicles = vehicleManager;

    this.currentWeapon = 'pistol'; // 'fists' or 'pistol'
    this.clipAmmo = 15;
    this.maxClip = 15;
    this.reserveAmmo = 60;
    this.isReloading = false;
    this.fireCooldown = 0;

    // Visual effects (muzzle flash and bullet tracers)
    this.createMuzzleFlash();
    this.tracers = [];
  }

  createMuzzleFlash() {
    // Muzzle flash point light & small glowing star
    this.flashLight = new THREE.PointLight(0xffa726, 0, 8);
    this.scene.add(this.flashLight);

    const flashGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
    this.flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.flashMesh.visible = false;
    this.scene.add(this.flashMesh);
  }

  setWeapon(type) {
    if (type !== 'fists' && type !== 'pistol') return;
    this.currentWeapon = type;
    if (this.player.gunMesh) {
      this.player.gunMesh.visible = (type === 'pistol');
    }
  }

  update(dt) {
    if (this.fireCooldown > 0) {
      this.fireCooldown -= dt;
    }

    // Fade muzzle flash
    if (this.flashLight.intensity > 0) {
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 25);
      if (this.flashLight.intensity === 0) {
        this.flashMesh.visible = false;
      }
    }

    // Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        this.tracers.splice(i, 1);
      }
    }
  }

  attack(onCrime = null, onPedKill = null) {
    if (this.player.inVehicle) return; // Can't punch/shoot while driving

    if (this.currentWeapon === 'fists') {
      this.punch(onCrime, onPedKill);
    } else if (this.currentWeapon === 'pistol') {
      this.firePistol(onCrime, onPedKill);
    }
  }

  punch(onCrime, onPedKill) {
    if (this.fireCooldown > 0) return;
    this.fireCooldown = 0.35;

    audio.playPunch();

    // Check hit in front of player
    const punchRange = 2.2;
    const forward = new THREE.Vector3(
      Math.sin(this.player.heading),
      0,
      Math.cos(this.player.heading)
    );

    const targetPed = this.peds.getNearestPedestrian(this.player.position, punchRange);
    if (targetPed) {
      targetPed.takeDamage(35, this.player.position, onPedKill);
      if (onCrime) onCrime('assault', 1);
    }
  }

  firePistol(onCrime, onPedKill) {
    if (this.fireCooldown > 0 || this.isReloading) return;
    if (this.clipAmmo <= 0) {
      this.reload();
      return;
    }

    this.fireCooldown = 0.22;
    this.clipAmmo--;

    audio.playGunshot();

    // Flash effect
    const origin = this.player.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const forward = new THREE.Vector3(
      Math.sin(this.player.heading),
      0,
      Math.cos(this.player.heading)
    );
    const muzzlePos = origin.clone().add(forward.clone().multiplyScalar(0.7));

    this.flashLight.position.copy(muzzlePos);
    this.flashLight.intensity = 4.0;
    this.flashMesh.position.copy(muzzlePos);
    this.flashMesh.visible = true;

    // Raycast hit detection in camera forward direction
    const rayDir = new THREE.Vector3();
    this.camera.getWorldDirection(rayDir);

    const raycaster = new THREE.Raycaster(origin, rayDir, 0.5, 75);

    // Alert nearby pedestrians and police
    this.peds.alertGunshot(this.player.position, 40);
    if (onCrime) onCrime('gunfire', 1);

    // Hit test against pedestrians
    let hitSomething = false;
    for (const ped of this.peds.pedestrians) {
      if (ped.state === 'dead') continue;
      const d = ped.position.distanceTo(origin);
      if (d < 60) {
        // Simple cylinder / sphere hit calculation
        const toPed = ped.position.clone().add(new THREE.Vector3(0, 1.0, 0)).sub(origin);
        const projection = toPed.dot(rayDir);
        if (projection > 0) {
          const closestPoint = origin.clone().add(rayDir.clone().multiplyScalar(projection));
          if (closestPoint.distanceTo(ped.position.clone().add(new THREE.Vector3(0, 1.0, 0))) < 0.8) {
            ped.takeDamage(60, this.player.position, onPedKill);
            hitSomething = true;
            this.spawnTracer(muzzlePos, ped.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
            if (onCrime) onCrime('murder', 2);
            break;
          }
        }
      }
    }

    // Hit test against vehicles
    if (!hitSomething) {
      for (const v of this.vehicles.vehicles) {
        if (v.isPlayerDriving) continue;
        const dist = v.position.distanceTo(origin);
        if (dist < 60) {
          const toV = v.position.clone().add(new THREE.Vector3(0, 0.7, 0)).sub(origin);
          const proj = toV.dot(rayDir);
          if (proj > 0) {
            const closest = origin.clone().add(rayDir.clone().multiplyScalar(proj));
            if (closest.distanceTo(v.position.clone().add(new THREE.Vector3(0, 0.7, 0))) < 1.8) {
              v.takeDamage(40);
              hitSomething = true;
              this.spawnTracer(muzzlePos, v.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
              if (v.isPolice && onCrime) onCrime('cop_attack', 3);
              break;
            }
          }
        }
      }
    }

    if (!hitSomething) {
      // Free tracer line into distance
      const endPos = origin.clone().add(rayDir.multiplyScalar(50));
      this.spawnTracer(muzzlePos, endPos);
    }
  }

  spawnTracer(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  reload() {
    if (this.isReloading || this.clipAmmo === this.maxClip || this.reserveAmmo <= 0) return;
    this.isReloading = true;
    setTimeout(() => {
      const needed = this.maxClip - this.clipAmmo;
      const transfer = Math.min(needed, this.reserveAmmo);
      this.clipAmmo += transfer;
      this.reserveAmmo -= transfer;
      this.isReloading = false;
    }, 1200);
  }
}
