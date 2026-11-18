// Story Missions & Narrative Arc for Solana Shores: Vice Syndicate
// 3 Complete Missions: Neon Arrival, Syndicate Shakedown, Coastal Heat

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

export const MISSIONS_DATA = [
  {
    id: 1,
    title: 'Mission 1: Neon Arrival',
    brief: 'Meet fixer Maya Torres at the Marina docks to secure your wheels.',
    reward: 1500,
    steps: [
      {
        text: 'Meet fixer Maya Torres at Marina Pier [Yellow Marker]',
        target: new THREE.Vector3(50, 0, 165),
        radius: 6,
        type: 'reach'
      },
      {
        text: 'Steal the parked red Veloce GT sports coupe [Press F]',
        type: 'enter_car'
      },
      {
        text: 'Deliver the vehicle to the Marina Safehouse Garage',
        target: new THREE.Vector3(35, 0, 170),
        radius: 8,
        type: 'deliver_car'
      }
    ]
  },
  {
    id: 2,
    title: 'Mission 2: Syndicate Shakedown',
    brief: 'A rival cartel courier is making a payoff in Downtown Plaza. Intercept them.',
    reward: 3500,
    steps: [
      {
        text: 'Travel to Downtown Plaza [Yellow Marker]',
        target: new THREE.Vector3(-40, 0, 0),
        radius: 8,
        type: 'reach'
      },
      {
        text: 'Neutralize the cartel courier & bodyguards [Melee / Gun]',
        type: 'combat_target',
        targetCount: 3
      },
      {
        text: 'Collect the recovered Syndicate Payoff Case',
        target: new THREE.Vector3(-40, 0, 2),
        radius: 4,
        type: 'collect'
      }
    ]
  },
  {
    id: 3,
    title: 'Mission 3: Coastal Heat',
    brief: 'Steal the cartel kingpin’s supercar on Ocean Blvd and evade the 3-star SSPD ambush!',
    reward: 10000,
    steps: [
      {
        text: 'Infiltrate the Waterfront Villa at Ocean Boulevard',
        target: new THREE.Vector3(60, 0, -150),
        radius: 8,
        type: 'reach'
      },
      {
        text: 'Commandeer the Kingpin’s Supercar [Police Ambush!]',
        type: 'enter_car_ambush'
      },
      {
        text: 'Evade the 3-Star SSPD Pursuit & Lose the Heat!',
        type: 'lose_wanted'
      },
      {
        text: 'Deliver the supercar to the Marina Hideout Garage',
        target: new THREE.Vector3(35, 0, 170),
        radius: 8,
        type: 'deliver_car'
      }
    ]
  }
];

export class MissionManager {
  constructor(scene, player, vehicles, police, peds) {
    this.scene = scene;
    this.player = player;
    this.vehicles = vehicles;
    this.police = police;
    this.peds = peds;

    this.currentMissionIndex = 0;
    this.currentStepIndex = 0;
    this.isMissionActive = true;
    this.combatKills = 0;

    this.createWaypointMarker();
    this.updateWaypoint();
  }

  createWaypointMarker() {
    // Glowing pulsing vertical beacon cylinder
    const geo = new THREE.CylinderGeometry(1.2, 1.2, 14, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd54f,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.y = 7;

    // Ground ring
    const ringGeo = new THREE.RingGeometry(1.5, 2.2, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffea00,
      side: THREE.DoubleSide
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.15;

    this.markerGroup = new THREE.Group();
    this.markerGroup.add(this.beacon);
    this.markerGroup.add(this.ring);
    this.scene.add(this.markerGroup);
  }

  getCurrentMission() {
    return MISSIONS_DATA[this.currentMissionIndex] || null;
  }

  getCurrentStep() {
    const m = this.getCurrentMission();
    if (!m) return null;
    return m.steps[this.currentStepIndex] || null;
  }

  update(dt, onToast = null) {
    // Pulse and rotate beacon
    if (this.markerGroup.visible) {
      this.ring.rotation.z += dt * 2;
      this.beacon.material.opacity = 0.4 + Math.sin(Date.now() * 0.006) * 0.2;
    }

    const step = this.getCurrentStep();
    if (!step) return;

    const playerPos = this.player.position;

    // Check step completion conditions
    if (step.type === 'reach') {
      if (playerPos.distanceTo(step.target) < step.radius) {
        this.advanceStep(onToast);
      }
    } else if (step.type === 'enter_car') {
      if (this.player.inVehicle) {
        this.advanceStep(onToast);
      }
    } else if (step.type === 'deliver_car') {
      if (this.player.inVehicle && playerPos.distanceTo(step.target) < step.radius) {
        this.advanceStep(onToast);
      }
    } else if (step.type === 'enter_car_ambush') {
      if (this.player.inVehicle) {
        // Trigger 3-star ambush!
        this.police.setWantedLevel(3);
        if (onToast) onToast('POLICE AMBUSH! 3-Star Wanted Level!', 4000);
        this.advanceStep(onToast);
      }
    } else if (step.type === 'lose_wanted') {
      if (this.police.wantedLevel === 0) {
        this.advanceStep(onToast);
      }
    } else if (step.type === 'combat_target') {
      if (this.combatKills >= (step.targetCount || 2)) {
        this.advanceStep(onToast);
      }
    } else if (step.type === 'collect') {
      if (playerPos.distanceTo(step.target) < step.radius) {
        this.advanceStep(onToast);
      }
    }
  }

  advanceStep(onToast) {
    const m = this.getCurrentMission();
    this.currentStepIndex++;

    if (this.currentStepIndex >= m.steps.length) {
      // Mission Passed!
      audio.playMissionPass();
      this.player.addCash(m.reward);
      if (onToast) {
        onToast(`MISSION PASSED: ${m.title}! +$${m.reward.toLocaleString()}`, 5000);
      }

      this.currentMissionIndex++;
      this.currentStepIndex = 0;
      this.combatKills = 0;

      if (this.currentMissionIndex >= MISSIONS_DATA.length) {
        // Finished all story missions!
        if (onToast) {
          onToast('ALL STORY MISSIONS COMPLETE! Solana Shores is YOURS!', 6000);
        }
        this.markerGroup.visible = false;
        return;
      }
    } else {
      if (onToast) {
        const nextStep = this.getCurrentStep();
        if (nextStep) onToast(nextStep.text, 3500);
      }
    }

    this.updateWaypoint();
  }

  updateWaypoint() {
    const step = this.getCurrentStep();
    if (step && step.target) {
      this.markerGroup.visible = true;
      this.markerGroup.position.set(step.target.x, 0, step.target.z);
    } else {
      this.markerGroup.visible = false;
    }
  }

  getWaypointPosition() {
    const step = this.getCurrentStep();
    return (step && step.target) ? step.target : null;
  }

  recordKill() {
    this.combatKills++;
  }

  restartCurrentMission() {
    this.currentStepIndex = 0;
    this.combatKills = 0;
    this.police.setWantedLevel(0);
    this.updateWaypoint();
  }
}
