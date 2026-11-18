// Vehicle System for Solana Shores: Vice Syndicate
// Vehicle models, arcade physics, player driving, and ambient traffic AI

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

export const VEHICLE_CONFIGS = {
  coupe: {
    name: 'Veloce GT',
    maxSpeed: 52,
    accel: 24,
    reverseSpeed: 16,
    turnSpeed: 2.6,
    brake: 35,
    health: 300,
    color: 0xd32f2f, // Crimson red
    scale: { w: 2.2, h: 1.2, l: 4.4 }
  },
  sedan: {
    name: 'Palma Cruiser',
    maxSpeed: 42,
    accel: 18,
    reverseSpeed: 14,
    turnSpeed: 2.2,
    brake: 30,
    health: 280,
    color: 0x1976d2, // Blue
    scale: { w: 2.2, h: 1.4, l: 4.5 }
  },
  muscle: {
    name: 'Torque 450',
    maxSpeed: 48,
    accel: 28,
    reverseSpeed: 15,
    turnSpeed: 2.0,
    brake: 28,
    health: 320,
    color: 0xf57c00, // Amber orange
    scale: { w: 2.3, h: 1.3, l: 4.6 }
  },
  suv: {
    name: 'Sierra 4x4',
    maxSpeed: 38,
    accel: 16,
    reverseSpeed: 12,
    turnSpeed: 1.8,
    brake: 32,
    health: 450,
    color: 0x2e7d32, // Emerald
    scale: { w: 2.4, h: 1.7, l: 4.8 }
  },
  police: {
    name: 'SSPD Tactical Interceptor',
    maxSpeed: 54,
    accel: 26,
    reverseSpeed: 18,
    turnSpeed: 2.5,
    brake: 38,
    health: 380,
    color: 0x111111, // Police Black & White
    isPolice: true,
    scale: { w: 2.3, h: 1.45, l: 4.6 }
  }
};

export class Vehicle {
  constructor(scene, city, type = 'coupe', position = new THREE.Vector3(), heading = 0) {
    this.scene = scene;
    this.city = city;
    this.type = type;
    this.cfg = VEHICLE_CONFIGS[type] || VEHICLE_CONFIGS.coupe;

    this.position = position.clone();
    this.heading = heading; // in radians
    this.speed = 0;
    this.health = this.cfg.health;
    this.maxHealth = this.cfg.health;
    this.steerAngle = 0;
    this.isPlayerDriving = false;
    this.isPolice = !!this.cfg.isPolice;
    this.sirenActive = false;

    // Traffic AI properties
    this.isTraffic = false;
    this.targetLane = null;
    this.waypoint = null;

    this.buildMesh();
  }

  buildMesh() {
    this.mesh = new THREE.Group();
    const { w, h, l } = this.cfg.scale;

    // 1. Main Body / Chassis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.cfg.color,
      metalness: 0.6,
      roughness: 0.3
    });

    const bodyGeo = new THREE.BoxGeometry(w, h * 0.5, l);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = h * 0.45;
    body.castShadow = true;
    body.receiveShadow = true;
    this.mesh.add(body);
    this.bodyMesh = body;

    // Police cruiser white doors/roof contrast
    if (this.isPolice) {
      const doorGeo = new THREE.BoxGeometry(w + 0.05, h * 0.48, l * 0.45);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
      const doorMesh = new THREE.Mesh(doorGeo, doorMat);
      doorMesh.position.y = h * 0.45;
      this.mesh.add(doorMesh);
    }

    // 2. Cabin / Windshield
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x101a24,
      roughness: 0.1,
      metalness: 0.9,
      transparent: true,
      opacity: 0.8
    });
    const cabinGeo = new THREE.BoxGeometry(w * 0.82, h * 0.45, l * 0.5);
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, h * 0.85, -l * 0.05);
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // 3. Headlights & Taillights
    const headMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1744 });

    const headGeo = new THREE.BoxGeometry(0.35, 0.18, 0.1);
    const hlLeft = new THREE.Mesh(headGeo, headMat);
    hlLeft.position.set(-w * 0.35, h * 0.45, l * 0.5 + 0.01);
    const hlRight = hlLeft.clone();
    hlRight.position.x = w * 0.35;
    this.mesh.add(hlLeft);
    this.mesh.add(hlRight);

    const tailGeo = new THREE.BoxGeometry(0.4, 0.18, 0.1);
    const tlLeft = new THREE.Mesh(tailGeo, tailMat);
    tlLeft.position.set(-w * 0.35, h * 0.45, -l * 0.5 - 0.01);
    const tlRight = tlLeft.clone();
    tlRight.position.x = w * 0.35;
    this.mesh.add(tlLeft);
    this.mesh.add(tlRight);

    // 4. Police Lightbar
    if (this.isPolice) {
      const barGroup = new THREE.Group();
      const mountGeo = new THREE.BoxGeometry(w * 0.6, 0.1, 0.25);
      const mount = new THREE.Mesh(mountGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
      barGroup.add(mount);

      this.redLightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      this.blueLightMat = new THREE.MeshBasicMaterial({ color: 0x0044ff });

      const bulbGeo = new THREE.BoxGeometry(w * 0.25, 0.18, 0.22);
      this.redLight = new THREE.Mesh(bulbGeo, this.redLightMat);
      this.redLight.position.x = -w * 0.15;
      this.blueLight = new THREE.Mesh(bulbGeo, this.blueLightMat);
      this.blueLight.position.x = w * 0.15;

      barGroup.add(this.redLight);
      barGroup.add(this.blueLight);
      barGroup.position.set(0, h * 1.15, -l * 0.05);
      this.mesh.add(barGroup);
    }

    // 5. Wheels (4 rubber cylinders)
    this.wheels = [];
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.32, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const wheelOffsets = [
      { x: -w * 0.5, y: 0.38, z: l * 0.3, front: true },
      { x: w * 0.5, y: 0.38, z: l * 0.3, front: true },
      { x: -w * 0.5, y: 0.38, z: -l * 0.3, front: false },
      { x: w * 0.5, y: 0.38, z: -l * 0.3, front: false },
    ];

    for (const offset of wheelOffsets) {
      const wheelHolder = new THREE.Group();
      wheelHolder.position.set(offset.x, offset.y, offset.z);

      const wheelMesh = new THREE.Mesh(wheelGeo, wheelMat);
      wheelMesh.castShadow = true;
      wheelHolder.add(wheelMesh);

      this.mesh.add(wheelHolder);
      this.wheels.push({ holder: wheelHolder, mesh: wheelMesh, isFront: offset.front });
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.scene.add(this.mesh);
  }

  update(dt, input = null) {
    if (this.isPlayerDriving && input) {
      this.handlePlayerInput(dt, input);
    } else if (this.isTraffic) {
      this.handleTrafficAI(dt);
    } else {
      // Natural rolling friction when unoccupied
      this.speed *= Math.max(0, 1 - 2.5 * dt);
    }

    // Move forward based on heading and speed
    const moveDist = this.speed * dt;
    const nextX = this.position.x + Math.sin(this.heading) * moveDist;
    const nextZ = this.position.z + Math.cos(this.heading) * moveDist;

    // Collision with city buildings
    const col = this.city.checkCollision(nextX, nextZ, 1.4);
    if (col) {
      this.speed = -this.speed * 0.35; // bounce back
      audio.playPunch();
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    // Keep on ground
    this.position.y = 0;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;

    // Visual Wheel rotation and steering
    for (const w of this.wheels) {
      w.mesh.rotation.x += this.speed * dt * 2.2;
      if (w.isFront) {
        w.holder.rotation.y = this.steerAngle;
      }
    }

    // Visual body roll when turning
    if (this.bodyMesh) {
      const roll = (this.speed / this.cfg.maxSpeed) * this.steerAngle * 0.15;
      this.bodyMesh.rotation.z = -roll;
    }

    // Police flashing lights
    if (this.isPolice && this.sirenActive) {
      const flash = (Date.now() % 400 < 200);
      this.redLightMat.color.setHex(flash ? 0xff0033 : 0x330000);
      this.blueLightMat.color.setHex(!flash ? 0x0088ff : 0x000033);
    }

    // Sound updates for player driving
    if (this.isPlayerDriving) {
      const speedRatio = Math.abs(this.speed) / this.cfg.maxSpeed;
      audio.updateEngine(speedRatio);
    }
  }

  handlePlayerInput(dt, input) {
    const { accel, brake, maxSpeed, reverseSpeed, turnSpeed } = this.cfg;

    // Throttle & Reverse
    if (input.forward) {
      if (this.speed < 0) {
        this.speed += brake * dt;
      } else {
        this.speed = Math.min(maxSpeed, this.speed + accel * dt);
      }
    } else if (input.backward) {
      if (this.speed > 0) {
        this.speed -= brake * dt;
      } else {
        this.speed = Math.max(-reverseSpeed, this.speed - accel * 0.6 * dt);
      }
    } else {
      // Coasting friction
      this.speed *= Math.max(0, 1 - 0.8 * dt);
      if (Math.abs(this.speed) < 0.2) this.speed = 0;
    }

    // Steering
    let targetSteer = 0;
    if (input.left) targetSteer += 0.55;
    if (input.right) targetSteer -= 0.55;

    this.steerAngle += (targetSteer - this.steerAngle) * 8 * dt;

    // Turn vehicle if moving
    if (Math.abs(this.speed) > 0.4) {
      const dir = this.speed >= 0 ? 1 : -1;
      this.heading += this.steerAngle * turnSpeed * dt * dir;
    }

    // Handbrake drift
    if (input.handbrake) {
      this.speed *= Math.max(0, 1 - 2.8 * dt);
      if (Math.abs(this.speed) > 10) {
        audio.playScreech();
      }
    }

    // Horn
    if (input.horn) {
      audio.playHorn();
    }
  }

  handleTrafficAI(dt) {
    // Cruising speed along current lane
    const cruisingSpeed = 16;
    if (this.speed < cruisingSpeed) {
      this.speed = Math.min(cruisingSpeed, this.speed + 8 * dt);
    }

    // Check bounds to recycle vehicle
    if (this.position.z > 240) {
      this.position.z = -230;
    } else if (this.position.z < -240) {
      this.position.z = 230;
    }
    if (this.position.x > 80) {
      this.position.x = -150;
    } else if (this.position.x < -160) {
      this.position.x = 70;
    }
  }

  takeDamage(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      // Disabled smoke / engine stall
      this.speed = 0;
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

export class VehicleManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.vehicles = [];
    this.heroVehicle = null;

    this.spawnHeroCar();
    this.spawnAmbientTraffic();
  }

  spawnHeroCar() {
    // Crimson Veloce GT parked near starting point on Ocean Boulevard
    const startPos = new THREE.Vector3(60, 0, -40);
    this.heroVehicle = new Vehicle(this.scene, this.city, 'coupe', startPos, Math.PI);
    this.vehicles.push(this.heroVehicle);
  }

  spawnAmbientTraffic() {
    // Spawn civilian cars along roads
    const roadX = this.city.roadXCoords || [60, 10, -40, -90, -140];
    const types = ['sedan', 'muscle', 'suv', 'coupe'];

    for (let i = 0; i < 14; i++) {
      const rx = roadX[i % roadX.length];
      const rz = -200 + (i * 32) + (Math.random() * 10 - 5);
      const isReverse = i % 2 === 0;
      const laneOffset = isReverse ? -3.5 : 3.5;
      const type = types[i % types.length];

      const v = new Vehicle(
        this.scene,
        this.city,
        type,
        new THREE.Vector3(rx + laneOffset, 0, rz),
        isReverse ? Math.PI : 0
      );
      v.isTraffic = true;
      v.speed = 14 + Math.random() * 6;
      this.vehicles.push(v);
    }
  }

  update(dt, input) {
    for (const v of this.vehicles) {
      v.update(dt, v.isPlayerDriving ? input : null);
    }
  }

  getNearestVehicle(playerPos, maxDist = 4.0) {
    let nearest = null;
    let minDist = maxDist;
    for (const v of this.vehicles) {
      if (v.isPlayerDriving) continue;
      const d = v.position.distanceTo(playerPos);
      if (d < minDist) {
        minDist = d;
        nearest = v;
      }
    }
    return nearest;
  }

  spawnPoliceCruiser(pos, heading = 0) {
    const cop = new Vehicle(this.scene, this.city, 'police', pos, heading);
    cop.sirenActive = true;
    this.vehicles.push(cop);
    return cop;
  }
}
