// Heads-Up Display (HUD) & Minimap System for Solana Shores: Vice Syndicate
// Live circular radar, health/armor gauges, wanted stars, speedometer, objective banner

export class HUD {
  constructor(player, vehicleManager, policeManager, missionManager, combatManager, city) {
    this.player = player;
    this.vehicles = vehicleManager;
    this.police = policeManager;
    this.missions = missionManager;
    this.combat = combatManager;
    this.city = city;

    // DOM Elements
    this.healthBar = document.getElementById('health-bar');
    this.armorBar = document.getElementById('armor-bar');
    this.cashVal = document.getElementById('cash-val');
    this.weaponName = document.getElementById('weapon-name');
    this.ammoVal = document.getElementById('ammo-val');
    this.missionTitle = document.getElementById('mission-title');
    this.missionDesc = document.getElementById('mission-desc');
    this.speedoCard = document.getElementById('speedo-card');
    this.speedVal = document.getElementById('speed-val');
    this.gearVal = document.getElementById('gear-val');
    this.interactPrompt = document.getElementById('interact-prompt');
    this.toastContainer = document.getElementById('toast-container');

    // Minimap Canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.mCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Star elements
    this.stars = [
      document.getElementById('star-1'),
      document.getElementById('star-2'),
      document.getElementById('star-3'),
      document.getElementById('star-4'),
      document.getElementById('star-5')
    ];
  }

  update(dt) {
    this.updateVitals();
    this.updateWantedStars();
    this.updateWeaponAndCash();
    this.updateSpeedometer();
    this.updateMissionBanner();
    this.renderMinimap();
  }

  updateVitals() {
    if (this.healthBar) {
      const hpPercent = Math.max(0, Math.min(100, (this.player.health / this.player.maxHealth) * 100));
      this.healthBar.style.width = `${hpPercent}%`;
    }
    if (this.armorBar) {
      const armPercent = Math.max(0, Math.min(100, (this.player.armor / this.player.maxArmor) * 100));
      this.armorBar.style.width = `${armPercent}%`;
    }
  }

  updateWantedStars() {
    const level = this.police.wantedLevel;
    for (let i = 0; i < 5; i++) {
      if (this.stars[i]) {
        if (i < level) {
          this.stars[i].classList.add('active');
        } else {
          this.stars[i].classList.remove('active');
        }
      }
    }
  }

  updateWeaponAndCash() {
    if (this.cashVal) {
      this.cashVal.textContent = `$${this.player.cash.toLocaleString()}`;
    }
    if (this.weaponName) {
      this.weaponName.textContent = this.combat.currentWeapon === 'pistol' ? '9mm Pistol' : 'Fists';
    }
    if (this.ammoVal) {
      if (this.combat.currentWeapon === 'pistol') {
        this.ammoVal.textContent = `${this.combat.clipAmmo} / ${this.combat.reserveAmmo}`;
      } else {
        this.ammoVal.textContent = '∞';
      }
    }
  }

  updateSpeedometer() {
    if (!this.speedoCard) return;

    if (this.player.inVehicle && this.player.currentVehicle) {
      this.speedoCard.style.display = 'flex';
      const mph = Math.round(Math.abs(this.player.currentVehicle.speed) * 1.8);
      this.speedVal.textContent = mph;

      // Calculate pseudo gear
      let gear = '1';
      if (this.player.currentVehicle.speed < -0.5) gear = 'R';
      else if (mph > 65) gear = '5';
      else if (mph > 45) gear = '4';
      else if (mph > 30) gear = '3';
      else if (mph > 15) gear = '2';

      this.gearVal.textContent = `GEAR ${gear}`;
    } else {
      this.speedoCard.style.display = 'none';
    }
  }

  updateMissionBanner() {
    const mission = this.missions.getCurrentMission();
    const step = this.missions.getCurrentStep();

    if (!mission || !step) {
      if (this.missionTitle) this.missionTitle.textContent = 'Free Roam';
      if (this.missionDesc) this.missionDesc.textContent = 'Explore Solana Shores / Evade SSPD';
      return;
    }

    if (this.missionTitle) {
      this.missionTitle.textContent = mission.title;
    }

    if (this.missionDesc) {
      let descText = step.text;
      if (step.target) {
        const dist = Math.round(this.player.position.distanceTo(step.target));
        descText += ` [${dist}m]`;
      }
      this.missionDesc.textContent = descText;
    }
  }

  renderMinimap() {
    if (!this.mCtx) return;
    const ctx = this.mCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const scale = 0.55; // meter to pixel scale

    ctx.clearRect(0, 0, w, h);

    // Save and rotate map relative to player facing/camera
    ctx.save();
    ctx.translate(cx, cy);

    const angle = this.player.inVehicle && this.player.currentVehicle
      ? this.player.currentVehicle.heading
      : this.player.heading;

    ctx.rotate(angle);

    const px = this.player.position.x;
    const pz = this.player.position.z;

    // 1. Draw Ocean Background
    ctx.fillStyle = '#0077be';
    ctx.fillRect(
      (120 - px) * scale,
      (-300 - pz) * scale,
      400 * scale,
      600 * scale
    );

    // 2. Draw Beach
    ctx.fillStyle = '#d8b375';
    ctx.fillRect(
      (70 - px) * scale,
      (-300 - pz) * scale,
      50 * scale,
      600 * scale
    );

    // 3. Draw Roads
    ctx.fillStyle = '#37474f';
    if (this.city.roadXCoords) {
      for (const rx of this.city.roadXCoords) {
        ctx.fillRect(
          (rx - 7 - px) * scale,
          (-300 - pz) * scale,
          14 * scale,
          600 * scale
        );
      }
    }
    if (this.city.roadZCoords) {
      for (const rz of this.city.roadZCoords) {
        ctx.fillRect(
          (-200 - px) * scale,
          (rz - 7 - pz) * scale,
          300 * scale,
          14 * scale
        );
      }
    }

    // 4. Draw Ambient Vehicles (grey/blue dots)
    ctx.fillStyle = '#90caf9';
    for (const v of this.vehicles.vehicles) {
      if (v.isPlayerDriving) continue;
      const vx = (v.position.x - px) * scale;
      const vz = (v.position.z - pz) * scale;
      if (Math.hypot(vx, vz) < 70) {
        ctx.fillRect(vx - 2, vz - 3, 4, 6);
      }
    }

    // 5. Draw Police Cruisers (flashing red and blue blips)
    for (const cop of this.police.cops) {
      const cxPos = (cop.position.x - px) * scale;
      const czPos = (cop.position.z - pz) * scale;
      if (Math.hypot(cxPos, czPos) < 70) {
        const flash = (Date.now() % 300 < 150);
        ctx.fillStyle = flash ? '#ff1744' : '#2979ff';
        ctx.beginPath();
        ctx.arc(cxPos, czPos, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Draw Mission Waypoint Target
    const wp = this.missions.getWaypointPosition();
    if (wp) {
      const wx = (wp.x - px) * scale;
      const wz = (wp.z - pz) * scale;
      // Clamp to radar radius if out of view
      const dist = Math.hypot(wx, wz);
      let drawX = wx;
      let drawZ = wz;
      if (dist > 62) {
        drawX = (wx / dist) * 62;
        drawZ = (wz / dist) * 62;
      }

      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      // Draw diamond
      ctx.moveTo(drawX, drawZ - 5);
      ctx.lineTo(drawX + 5, drawZ);
      ctx.lineTo(drawX, drawZ + 5);
      ctx.lineTo(drawX - 5, drawZ);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();

    // 7. Draw Player Marker (Centered white arrow)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 8. Radar Compass Cardinals (N, S, E, W)
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff1744'; // Red North
    ctx.fillText('N', cx + Math.sin(angle) * 72, cy - Math.cos(angle) * 72);
    ctx.fillStyle = '#b0bec5';
    ctx.fillText('S', cx - Math.sin(angle) * 72, cy + Math.cos(angle) * 72);
    ctx.fillText('E', cx + Math.cos(angle) * 72, cy + Math.sin(angle) * 72);
    ctx.fillText('W', cx - Math.cos(angle) * 72, cy - Math.sin(angle) * 72);
  }

  showInteractPrompt(text) {
    if (!this.interactPrompt) return;
    if (text) {
      this.interactPrompt.textContent = text;
      this.interactPrompt.style.display = 'block';
    } else {
      this.interactPrompt.style.display = 'none';
    }
  }

  showToast(message, duration = 3000) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, duration);
  }
}
