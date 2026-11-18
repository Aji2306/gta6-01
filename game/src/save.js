// LocalStorage Save & Load System for Solana Shores: Vice Syndicate

const SAVE_KEY = 'solana_shores_save';

export class SaveSystem {
  static save(player, missionManager, combatManager) {
    try {
      const data = {
        timestamp: Date.now(),
        player: {
          x: player.position.x,
          y: player.position.y,
          z: player.position.z,
          health: player.health,
          armor: player.armor,
          cash: player.cash
        },
        mission: {
          missionIndex: missionManager.currentMissionIndex,
          stepIndex: missionManager.currentStepIndex
        },
        combat: {
          weapon: combatManager.currentWeapon,
          clip: combatManager.clipAmmo,
          reserve: combatManager.reserveAmmo
        }
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('Failed to save game state to localStorage', e);
      return false;
    }
  }

  static load(player, missionManager, combatManager) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);

      if (data.player) {
        player.position.set(data.player.x, data.player.y, data.player.z);
        player.mesh.position.copy(player.position);
        player.health = data.player.health ?? 100;
        player.armor = data.player.armor ?? 100;
        player.cash = data.player.cash ?? 2500;
      }

      if (data.mission) {
        missionManager.currentMissionIndex = data.mission.missionIndex ?? 0;
        missionManager.currentStepIndex = data.mission.stepIndex ?? 0;
        missionManager.updateWaypoint();
      }

      if (data.combat) {
        combatManager.setWeapon(data.combat.weapon ?? 'pistol');
        combatManager.clipAmmo = data.combat.clip ?? 15;
        combatManager.reserveAmmo = data.combat.reserve ?? 60;
      }

      return true;
    } catch (e) {
      console.warn('Failed to load game state from localStorage', e);
      return false;
    }
  }

  static hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  static clear() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {}
  }
}
