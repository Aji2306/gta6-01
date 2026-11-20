// Player Character (Leo Cruz) & Camera Controller for Solana Shores
// Third-person movement, pointer lock camera, vehicle entry/exit

import * as THREE from '../vendor/three.module.min.js';
import { audio } from './audio.js';

export class Player {
  constructor(scene, camera, city, position = new THREE.Vector3(60, 0, -35)) {
    this.scene = scene;
    this.camera = camera;
    this.city = city;

    this.position = position.clone();
    this.velocity = new THREE.Vector3();
    this.heading = 0; // facing direction on foot

    // Camera angles
    this.camYaw = 0;
    this.camPitch = 0.2; // slight downward pitch
    this.camDist = 4.0;

    // Movement speeds
    this.walkSpeed = 4.5;
    this.runSpeed = 8.5;
    this.jumpSpeed = 7.5;
    this.gravity = 20.0;
    this.isGrounded = true;

    // Stats
    this.health = 100;
    this.maxHealth = 100;
    this.armor = 100;
    this.maxArmor = 100;
    this.cash = 2500;

    // State
    this.inVehicle = false;
    this.currentVehicle = null;
    this.animCycle = 0;
    this.stepTimer = 0;

    this.buildMesh();
  }

  buildMesh() {
    this.mesh = new THREE.Group();

    // Stylized protagonist Leo Cruz
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc89d7c });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x880e4f }); // Maroon button-up
    const undershirtMat = new THREE.MeshLambertMaterial({ color: 0x212121 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x1565c0 }); // Denim blue
    const shoeMat = new THREE.MeshLambertMaterial({ color: 0xeeeeee });

    // Head
    const headGeo = new THREE.BoxGeometry(0.38, 0.42, 0.38);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.62;
    head.castShadow = true;
    this.mesh.add(head);

    // Hair
    const hairGeo = new THREE.BoxGeometry(0.4, 0.16, 0.4);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 1.82, -0.02);
    this.mesh.add(hair);

    // Sunglasses
    const glassesGeo = new THREE.BoxGeometry(0.38, 0.1, 0.08);
    const glassesMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const glasses = new THREE.Mesh(glassesGeo, glassesMat);
    glasses.position.set(0, 1.65, 0.18);
    this.mesh.add(glasses);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(0.58, 0.68, 0.32);
    const torso = new THREE.Mesh(torsoGeo, shirtMat);
    torso.position.y = 1.1;
    torso.castShadow = true;
    this.mesh.add(torso);

    // Chest undershirt cutout
    const chestGeo = new THREE.BoxGeometry(0.24, 0.3, 0.02);
    const chest = new THREE.Mesh(chestGeo, undershirtMat);
    chest.position.set(0, 1.25, 0.16);
    this.mesh.add(chest);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);
    this.armL = new THREE.Mesh(armGeo, skinMat);
    this.armL.position.set(-0.38, 1.1, 0);
    this.armR = new THREE.Mesh(armGeo, skinMat);
    this.armR.position.set(0.38, 1.1, 0);
    this.armL.castShadow = true;
    this.armR.castShadow = true;
    this.mesh.add(this.armL);
    this.mesh.add(this.armR);

    // 9mm Handgun attached to right hand
    this.gunMesh = new THREE.Group();
    const barrelGeo = new THREE.BoxGeometry(0.08, 0.08, 0.28);
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x212121, metalness: 0.8, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, gunMat);
    barrel.position.set(0, 0, 0.1);
    const gripGeo = new THREE.BoxGeometry(0.07, 0.15, 0.08);
    const grip = new THREE.Mesh(gripGeo, gunMat);
    grip.position.set(0, -0.08, 0);
    this.gunMesh.add(barrel);
    this.gunMesh.add(grip);
    this.gunMesh.position.set(0, -0.28, 0.12);
    this.armR.add(this.gunMesh);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.22, 0.72, 0.22);
    this.legL = new THREE.Mesh(legGeo, pantsMat);
    this.legL.position.set(-0.16, 0.45, 0);
    this.legR = new THREE.Mesh(legGeo, pantsMat);
    this.legR.position.set(0.16, 0.45, 0);
    this.mesh.add(this.legL);
    this.mesh.add(this.legR);

    this.mesh.position.copy(this.position);
    this.scene.add(this.mesh);
  }

  update(dt, input) {
    if (this.inVehicle && this.currentVehicle) {
      this.updateInVehicle(dt);
    } else {
      this.updateOnFoot(dt, input);
    }

    this.updateCamera(dt);
  }

  updateOnFoot(dt, input) {
    let axisX = 0;
    let axisZ = 0;

    if (input.forward) axisZ -= 1;
    if (input.backward) axisZ += 1;
    if (input.left) axisX -= 1;
    if (input.right) axisX += 1;

    const moving = axisX !== 0 || axisZ !== 0;

    if (moving) {
      const mag = Math.hypot(axisX, axisZ);
      axisX /= mag;
      axisZ /= mag;

      // Transform local movement vector into world space relative to camera yaw angle.
      // Ensuring pushing forward (up) moves the character away from the camera.
      const cy = Math.cos(this.camYaw);
      const sy = Math.sin(this.camYaw);
      const worldX = -axisX * cy - axisZ * sy;
      const worldZ = axisX * sy - axisZ * cy;

      const spd = input.sprint ? this.runSpeed : this.walkSpeed;
      this.velocity.x = worldX * spd;
      this.velocity.z = worldZ * spd;

      this.heading = Math.atan2(worldX, worldZ);
      this.mesh.rotation.y = this.heading;

      this.animCycle += dt * (input.sprint ? 14 : 9);
      const swing = Math.sin(this.animCycle) * (input.sprint ? 0.7 : 0.45);
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing;
      this.armR.rotation.x = swing * 0.4;

      this.stepTimer -= dt;
      if (this.stepTimer <= 0 && this.isGrounded) {
        audio.playFootstep();
        this.stepTimer = input.sprint ? 0.28 : 0.42;
      }
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
      // Reset limbs to resting position
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x *= 0.8;
    }

    // Jump & Gravity
    if (input.jump && this.isGrounded) {
      this.velocity.y = this.jumpSpeed;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocity.y -= this.gravity * dt;
    }

    // Apply movement
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;
    const nextY = this.position.y + this.velocity.y * dt;

    // Check building collisions
    const col = this.city.checkCollision(nextX, nextZ, 0.4);
    if (!col) {
      this.position.x = nextX;
      this.position.z = nextZ;
    }

    if (nextY <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.position.y = nextY;
    }

    this.mesh.position.copy(this.position);
  }

  updateInVehicle(dt) {
    // Match position and heading of vehicle
    this.position.copy(this.currentVehicle.position);
    this.heading = this.currentVehicle.heading;
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.heading;
  }

  updateCamera(dt) {
    if (this.inVehicle && this.currentVehicle) {
      // Vehicle chase camera: smooth follow behind vehicle heading
      const v = this.currentVehicle;
      const dist = 7.0;
      const height = 2.6;

      const targetCamX = v.position.x - Math.sin(v.heading) * dist;
      const targetCamZ = v.position.z - Math.cos(v.heading) * dist;
      const targetCamY = v.position.y + height;

      this.camera.position.x += (targetCamX - this.camera.position.x) * 6 * dt;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 6 * dt;
      this.camera.position.z += (targetCamZ - this.camera.position.z) * 6 * dt;

      // Look slightly ahead of the vehicle
      const lookTarget = new THREE.Vector3(
        v.position.x + Math.sin(v.heading) * 4,
        v.position.y + 1.2,
        v.position.z + Math.cos(v.heading) * 4
      );
      this.camera.lookAt(lookTarget);
    } else {
      // On-foot third person camera
      const targetY = this.position.y + 1.6;
      const camY = targetY + Math.sin(this.camPitch) * this.camDist;
      const horizDist = Math.cos(this.camPitch) * this.camDist;

      const camX = this.position.x - Math.sin(this.camYaw) * horizDist;
      const camZ = this.position.z - Math.cos(this.camYaw) * horizDist;

      this.camera.position.set(camX, camY, camZ);
      this.camera.lookAt(this.position.x, targetY + 0.2, this.position.z);
    }
  }

  rotateCamera(deltaYaw, deltaPitch) {
    this.camYaw -= deltaYaw * 0.0025;
    this.camPitch = Math.max(-0.4, Math.min(1.1, this.camPitch - deltaPitch * 0.0025));
  }

  enterVehicle(vehicle) {
    this.inVehicle = true;
    this.currentVehicle = vehicle;
    vehicle.isPlayerDriving = true;
    vehicle.isTraffic = false;
    this.mesh.visible = false; // Hide on-foot model while inside
    audio.startEngine();
  }

  exitVehicle() {
    if (!this.inVehicle || !this.currentVehicle) return;
    const v = this.currentVehicle;
    v.isPlayerDriving = false;
    v.speed = 0;

    // Place player beside the driver side door
    this.position.set(
      v.position.x - Math.cos(v.heading) * 2.2,
      0,
      v.position.z + Math.sin(v.heading) * 2.2
    );
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;

    this.inVehicle = false;
    this.currentVehicle = null;
    audio.stopEngine();
  }

  takeDamage(amount) {
    if (this.armor > 0) {
      const armorDmg = Math.min(this.armor, amount);
      this.armor -= armorDmg;
      amount -= armorDmg;
    }
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(healthAmt = 50, armorAmt = 50) {
    this.health = Math.min(this.maxHealth, this.health + healthAmt);
    this.armor = Math.min(this.maxArmor, this.armor + armorAmt);
  }

  addCash(amount) {
    this.cash += amount;
  }
}
