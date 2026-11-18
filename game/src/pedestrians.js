// Pedestrian System for Solana Shores: Vice Syndicate
// Civilian NPCs walking on sidewalks, reacting to gunfire/vehicles, dropping cash

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

const OUTFIT_COLORS = [
  { shirt: 0x00bcd4, pants: 0x37474f }, // Cyan shirt
  { shirt: 0xff4081, pants: 0xefebe9 }, // Neon pink
  { shirt: 0xffea00, pants: 0x263238 }, // Yellow polo
  { shirt: 0x76ff03, pants: 0x455a64 }, // Lime green
  { shirt: 0xffffff, pants: 0x1565c0 }, // White shirt / blue jeans
  { shirt: 0xab47bc, pants: 0x212121 }, // Purple
];

export class Pedestrian {
  constructor(scene, city, position = new THREE.Vector3(), heading = 0) {
    this.scene = scene;
    this.city = city;
    this.position = position.clone();
    this.heading = heading;
    this.walkSpeed = 2.2;
    this.fleeSpeed = 6.0;
    this.speed = this.walkSpeed;
    this.health = 100;
    this.state = 'walk'; // 'walk', 'flee', 'dead'
    this.fleeTimer = 0;
    this.walkCycle = Math.random() * Math.PI * 2;
    this.outfit = OUTFIT_COLORS[Math.floor(Math.random() * OUTFIT_COLORS.length)];

    this.buildMesh();
  }

  buildMesh() {
    this.mesh = new THREE.Group();

    // Materials
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd7ccc8 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
    const shirtMat = new THREE.MeshLambertMaterial({ color: this.outfit.shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: this.outfit.pants });

    // Head
    const headGeo = new THREE.BoxGeometry(0.35, 0.4, 0.35);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.6;
    head.castShadow = true;
    this.mesh.add(head);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.38, 0.16, 0.38);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 1.8, -0.02);
    this.mesh.add(hair);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.3);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.16);
    this.armL = new THREE.Mesh(armGeo, skinMat);
    this.armL.position.set(-0.35, 1.1, 0);
    this.armR = new THREE.Mesh(armGeo, skinMat);
    this.armR.position.set(0.35, 1.1, 0);
    this.mesh.add(this.armL);
    this.mesh.add(this.armR);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    this.legL = new THREE.Mesh(legGeo, pantsMat);
    this.legL.position.set(-0.16, 0.45, 0);
    this.legR = new THREE.Mesh(legGeo, pantsMat);
    this.legR.position.set(0.16, 0.45, 0);
    this.mesh.add(this.legL);
    this.mesh.add(this.legR);

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
    this.scene.add(this.mesh);
  }

  update(dt, playerPos = null) {
    if (this.state === 'dead') return;

    this.walkCycle += dt * (this.state === 'flee' ? 12 : 5);

    // Swing arms and legs
    const swing = Math.sin(this.walkCycle) * (this.state === 'flee' ? 0.6 : 0.4);
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing;
    this.armR.rotation.x = swing;

    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      if (this.fleeTimer <= 0) {
        this.state = 'walk';
        this.speed = this.walkSpeed;
      }
    }

    // Step forward
    const moveDist = this.speed * dt;
    const nextX = this.position.x + Math.sin(this.heading) * moveDist;
    const nextZ = this.position.z + Math.cos(this.heading) * moveDist;

    // Boundary bounce
    if (this.city.checkCollision(nextX, nextZ, 0.4)) {
      this.heading += Math.PI * 0.7 + (Math.random() - 0.5);
    } else {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
  }

  scare(threatPos) {
    if (this.state === 'dead') return;
    this.state = 'flee';
    this.speed = this.fleeSpeed;
    this.fleeTimer = 6.0;

    // Run away from threat
    const dx = this.position.x - threatPos.x;
    const dz = this.position.z - threatPos.z;
    this.heading = Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.4;
  }

  takeDamage(amount, sourcePos = null, onKill = null) {
    if (this.state === 'dead') return;
    this.health -= amount;

    if (sourcePos) {
      this.scare(sourcePos);
    }

    if (this.health <= 0) {
      this.die(onKill);
    }
  }

  die(onKill = null) {
    this.state = 'dead';
    this.health = 0;

    // Ragdoll / fall over
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.position.y = 0.2;

    if (onKill) {
      const dropCash = 40 + Math.floor(Math.random() * 80);
      onKill(this, dropCash);
    }
  }

  destroy() {
    this.scene.remove(this.mesh);
  }
}

export class PedestrianManager {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.pedestrians = [];
    this.cashPickups = [];

    this.spawnPedestrians();
  }

  spawnPedestrians() {
    // Spawn around sidewalk coordinates
    const roadX = this.city.roadXCoords || [60, 10, -40, -90];
    for (let i = 0; i < 20; i++) {
      const rx = roadX[i % roadX.length];
      const sidewalkOffset = (i % 2 === 0 ? 1 : -1) * 8.5;
      const rz = -180 + i * 18 + (Math.random() * 6 - 3);

      const ped = new Pedestrian(
        this.scene,
        this.city,
        new THREE.Vector3(rx + sidewalkOffset, 0, rz),
        Math.random() > 0.5 ? 0 : Math.PI
      );
      this.pedestrians.push(ped);
    }
  }

  update(dt, playerPos, onPedKill = null) {
    for (const ped of this.pedestrians) {
      ped.update(dt, playerPos);
    }

    // Update floating cash pickups
    for (let i = this.cashPickups.length - 1; i >= 0; i--) {
      const p = this.cashPickups[i];
      p.mesh.rotation.y += dt * 3;
      p.mesh.position.y = 0.5 + Math.sin(Date.now() * 0.005) * 0.15;

      // Check player collection
      if (playerPos && playerPos.distanceTo(p.mesh.position) < 2.0) {
        audio.playCash();
        if (p.onCollect) p.onCollect(p.amount);
        this.scene.remove(p.mesh);
        this.cashPickups.splice(i, 1);
      }
    }
  }

  alertGunshot(gunshotPos, radius = 35) {
    for (const ped of this.pedestrians) {
      if (ped.position.distanceTo(gunshotPos) < radius) {
        ped.scare(gunshotPos);
      }
    }
  }

  spawnCashDrop(pos, amount, onCollect) {
    // 3D spinning green dollar bill / stack
    const geo = new THREE.BoxGeometry(0.6, 0.1, 0.35);
    const mat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.5, pos.z);
    this.scene.add(mesh);

    this.cashPickups.push({ mesh, amount, onCollect });
  }

  getNearestPedestrian(pos, maxDist = 3.0) {
    let nearest = null;
    let minDist = maxDist;
    for (const p of this.pedestrians) {
      if (p.state === 'dead') continue;
      const d = p.position.distanceTo(pos);
      if (d < minDist) {
        minDist = d;
        nearest = p;
      }
    }
    return nearest;
  }
}
