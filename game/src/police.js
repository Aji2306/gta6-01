// Police & Wanted Level System for Solana Shores: Vice Syndicate
// 0-5 stars wanted level, SSPD cruiser AI pursuits, evasion timer, arrest/wasted mechanics

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

export class PoliceManager {
  constructor(scene, city, player, vehicleManager) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.vehicleManager = vehicleManager;

    this.wantedLevel = 0; // 0 to 5 stars
    this.cops = []; // Active police cruisers
    this.evadeTimer = 0;
    this.evadeTimeMax = 15; // 15 seconds to lose heat
    this.bustedTimer = 0;

    this.onBusted = null;
    this.onWasted = null;
  }

  setWantedLevel(level) {
    const prev = this.wantedLevel;
    this.wantedLevel = Math.max(0, Math.min(5, level));

    if (this.wantedLevel > 0 && prev === 0) {
      audio.startSiren();
      this.spawnPursuitCruisers();
    } else if (this.wantedLevel === 0 && prev > 0) {
      audio.stopSiren();
      this.clearAllCops();
    }
  }

  reportCrime(crimeType, severity = 1) {
    if (this.wantedLevel < severity) {
      this.setWantedLevel(severity);
    } else if (Math.random() > 0.6 && this.wantedLevel < 5) {
      this.setWantedLevel(this.wantedLevel + 1);
    }
    this.evadeTimer = this.evadeTimeMax; // Reset evasion timer upon new crime
  }

  spawnPursuitCruisers() {
    const countNeeded = Math.min(4, this.wantedLevel);
    while (this.cops.length < countNeeded) {
      // Spawn ahead or behind player along road
      const offsetDist = 50 + this.cops.length * 15;
      const angle = (this.cops.length % 2 === 0 ? 0 : Math.PI) + (Math.random() - 0.5);
      const spawnX = this.player.position.x + Math.sin(angle) * offsetDist;
      const spawnZ = this.player.position.z + Math.cos(angle) * offsetDist;

      const cruiser = this.vehicleManager.spawnPoliceCruiser(
        new THREE.Vector3(spawnX, 0, spawnZ),
        angle + Math.PI
      );
      this.cops.push(cruiser);
    }
  }

  clearAllCops() {
    for (const cop of this.cops) {
      cop.sirenActive = false;
    }
    this.cops = [];
  }

  update(dt, onStatusChange = null) {
    if (this.wantedLevel === 0) return;

    // Check if player is dead
    if (this.player.health <= 0) {
      if (this.onWasted) this.onWasted();
      return;
    }

    let closestDist = Infinity;
    const playerPos = this.player.position;

    // Update each pursuit cruiser
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (cop.health <= 0) {
        cop.destroy();
        this.cops.splice(i, 1);
        continue;
      }

      const dist = cop.position.distanceTo(playerPos);
      if (dist < closestDist) closestDist = dist;

      // Pursuit AI: turn toward player
      const dx = playerPos.x - cop.position.x;
      const dz = playerPos.z - cop.position.z;
      const targetHeading = Math.atan2(dx, dz);

      // Smooth heading adjustment
      let diff = targetHeading - cop.heading;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      cop.heading += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);

      // Acceleration towards player
      const maxChaseSpeed = 22 + this.wantedLevel * 4;
      if (cop.speed < maxChaseSpeed) {
        cop.speed += 14 * dt;
      }

      // Ramming / PIT maneuver
      if (dist < 4.0) {
        if (this.player.inVehicle && this.player.currentVehicle) {
          this.player.currentVehicle.takeDamage(15);
          cop.speed *= 0.5;
        } else {
          // Busted check if on foot and stopped next to cop
          if (cop.speed < 5 && Math.hypot(this.player.velocity.x, this.player.velocity.z) < 2) {
            this.bustedTimer += dt;
            if (this.bustedTimer > 2.0) {
              if (this.onBusted) this.onBusted();
              return;
            }
          }
        }
      }
    }

    // Spawn more cops if some were destroyed
    const targetCopCount = Math.min(4, Math.max(1, this.wantedLevel));
    if (this.cops.length < targetCopCount) {
      this.spawnPursuitCruisers();
    }

    // Evasion logic: if player has distance from cops
    if (closestDist > 65) {
      this.evadeTimer -= dt;
      if (this.evadeTimer <= 0) {
        // Escaped! Lower heat
        this.setWantedLevel(this.wantedLevel - 1);
        this.evadeTimer = this.evadeTimeMax;
        if (onStatusChange) onStatusChange('evaded');
      }
    } else {
      this.evadeTimer = this.evadeTimeMax;
      this.bustedTimer = 0;
    }
  }
}
