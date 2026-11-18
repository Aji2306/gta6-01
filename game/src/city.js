// Procedural 3D City Generator for Solana Shores
// Coastal metropolis with beachfront, ocean boulevard, downtown high-rises, marina, and palm trees

import * as THREE from '../vendor/three.module.min.js';

export class City {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // Bounding boxes for vehicle/pedestrian collisions
    this.roads = [];     // Road network segments for traffic navigation
    this.spawnPoints = []; // Parked car and mission spawn locations

    this.roadWidth = 14;
    this.blockSize = 60;
    this.gridCols = 5; // East-West blocks
    this.gridRows = 7; // North-South blocks

    this.createMaterials();
    this.buildTerrain();
    this.buildRoadNetwork();
    this.buildCityBlocks();
    this.buildBeachAndOcean();
    this.buildMarina();
    this.buildVegetationAndProps();
  }

  createMaterials() {
    // 1. Procedural Road Texture (Asphalt with yellow divider and white curbs)
    const roadCanvas = document.createElement('canvas');
    roadCanvas.width = 512;
    roadCanvas.height = 512;
    const rCtx = roadCanvas.getContext('2d');
    rCtx.fillStyle = '#22252a';
    rCtx.fillRect(0, 0, 512, 512);

    // Subtle asphalt noise
    for (let i = 0; i < 4000; i++) {
      rCtx.fillStyle = Math.random() > 0.5 ? '#2b2f36' : '#1c1e22';
      rCtx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }

    // Yellow center dash line
    rCtx.fillStyle = '#ffd54f';
    for (let y = 0; y < 512; y += 64) {
      rCtx.fillRect(252, y + 12, 8, 40);
    }

    // White outer shoulder lines
    rCtx.fillStyle = '#f0f4f8';
    rCtx.fillRect(24, 0, 6, 512);
    rCtx.fillRect(482, 0, 6, 512);

    const roadTexture = new THREE.CanvasTexture(roadCanvas);
    roadTexture.wrapS = THREE.RepeatWrapping;
    roadTexture.wrapT = THREE.RepeatWrapping;

    this.matRoad = new THREE.MeshLambertMaterial({
      map: roadTexture,
      roughness: 0.8
    });

    // 2. Procedural Sidewalk / Pavement Texture
    const swCanvas = document.createElement('canvas');
    swCanvas.width = 256;
    swCanvas.height = 256;
    const sCtx = swCanvas.getContext('2d');
    sCtx.fillStyle = '#9e9e9e';
    sCtx.fillRect(0, 0, 256, 256);
    sCtx.strokeStyle = '#757575';
    sCtx.lineWidth = 4;
    for (let i = 0; i <= 256; i += 64) {
      sCtx.beginPath();
      sCtx.moveTo(i, 0); sCtx.lineTo(i, 256);
      sCtx.moveTo(0, i); sCtx.lineTo(256, i);
      sCtx.stroke();
    }
    const swTexture = new THREE.CanvasTexture(swCanvas);
    swTexture.wrapS = THREE.RepeatWrapping;
    swTexture.wrapT = THREE.RepeatWrapping;
    this.matSidewalk = new THREE.MeshLambertMaterial({ map: swTexture });

    // 3. Procedural Building Window Facade Texture
    const bCanvas = document.createElement('canvas');
    bCanvas.width = 256;
    bCanvas.height = 256;
    const bCtx = bCanvas.getContext('2d');
    bCtx.fillStyle = '#2c3e50';
    bCtx.fillRect(0, 0, 256, 256);

    for (let y = 16; y < 256; y += 32) {
      for (let x = 16; x < 256; x += 32) {
        // Sun-soaked cyan/golden reflective windows
        const rand = Math.random();
        if (rand > 0.6) {
          bCtx.fillStyle = '#81d4fa'; // Day sky reflection
        } else if (rand > 0.3) {
          bCtx.fillStyle = '#ffe082'; // Interior warm light
        } else {
          bCtx.fillStyle = '#1a252f'; // Dark window
        }
        bCtx.fillRect(x, y, 20, 20);
      }
    }
    const bTexture = new THREE.CanvasTexture(bCanvas);
    bTexture.wrapS = THREE.RepeatWrapping;
    bTexture.wrapT = THREE.RepeatWrapping;
    this.matBuilding = new THREE.MeshStandardMaterial({
      map: bTexture,
      roughness: 0.3,
      metalness: 0.4
    });

    // 4. Other Materials
    this.matSand = new THREE.MeshLambertMaterial({ color: 0xe0c088 });
    this.matWater = new THREE.MeshStandardMaterial({
      color: 0x0088cc,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.85
    });
    this.matGrass = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
    this.matTrunk = new THREE.MeshLambertMaterial({ color: 0x5d4037 });
    this.matPalmLeaves = new THREE.MeshLambertMaterial({ color: 0x2e7d32 });
    this.matRoof = new THREE.MeshLambertMaterial({ color: 0x37474f });
  }

  buildTerrain() {
    // Base city terrain ground plane
    const groundGeo = new THREE.PlaneGeometry(800, 800);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x263238 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  buildRoadNetwork() {
    // Generate grid roads and keep track of nodes and lanes
    const minX = -140;
    const maxX = 60;
    const minZ = -210;
    const maxZ = 210;

    const xSpacing = (maxX - minX) / (this.gridCols - 1);
    const zSpacing = (maxZ - minZ) / (this.gridRows - 1);

    this.roadXCoords = [];
    for (let c = 0; c < this.gridCols; c++) {
      this.roadXCoords.push(minX + c * xSpacing);
    }

    this.roadZCoords = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.roadZCoords.push(minZ + r * zSpacing);
    }

    // North-South Avenues (along Z)
    for (const x of this.roadXCoords) {
      const isOceanBlvd = Math.abs(x - maxX) < 1;
      const width = isOceanBlvd ? 18 : this.roadWidth;
      const length = maxZ - minZ + 40;

      const roadGeo = new THREE.PlaneGeometry(width, length);
      const road = new THREE.Mesh(roadGeo, this.matRoad);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.05, (minZ + maxZ) / 2);
      this.scene.add(road);

      // Register road segment for traffic
      this.roads.push({
        axis: 'Z',
        coord: x,
        start: minZ - 20,
        end: maxZ + 20,
        width: width,
        isOceanBlvd: isOceanBlvd
      });
    }

    // East-West Streets (along X)
    for (const z of this.roadZCoords) {
      const length = maxX - minX + 20;
      const roadGeo = new THREE.PlaneGeometry(length, this.roadWidth);
      const road = new THREE.Mesh(roadGeo, this.matRoad);
      road.rotation.x = -Math.PI / 2;
      road.rotation.z = Math.PI / 2;
      road.position.set((minX + maxX) / 2, 0.06, z);
      this.scene.add(road);

      this.roads.push({
        axis: 'X',
        coord: z,
        start: minX - 10,
        end: maxX + 10,
        width: this.roadWidth,
        isOceanBlvd: false
      });
    }
  }

  buildCityBlocks() {
    // Generate city blocks between the roads
    for (let c = 0; c < this.roadXCoords.length - 1; c++) {
      const x1 = this.roadXCoords[c] + this.roadWidth / 2 + 1;
      const x2 = this.roadXCoords[c + 1] - this.roadWidth / 2 - 1;
      const blockW = x2 - x1;
      const centerX = (x1 + x2) / 2;

      for (let r = 0; r < this.roadZCoords.length - 1; r++) {
        const z1 = this.roadZCoords[r] + this.roadWidth / 2 + 1;
        const z2 = this.roadZCoords[r + 1] - this.roadWidth / 2 - 1;
        const blockD = z2 - z1;
        const centerZ = (z1 + z2) / 2;

        // Sidewalk base for this block
        const swGeo = new THREE.BoxGeometry(blockW, 0.3, blockD);
        const swMesh = new THREE.Mesh(swGeo, this.matSidewalk);
        swMesh.position.set(centerX, 0.15, centerZ);
        this.scene.add(swMesh);

        // Populate block with buildings
        this.populateBlock(centerX, centerZ, blockW, blockD, c, r);
      }
    }
  }

  populateBlock(centerX, centerZ, blockW, blockD, colIdx, rowIdx) {
    const isDowntown = colIdx <= 2 && rowIdx >= 2 && rowIdx <= 4;
    const isWaterfront = colIdx === this.roadXCoords.length - 2;

    // Distribute 1 to 4 buildings in this block
    const subCols = blockW > 35 ? 2 : 1;
    const subRows = blockD > 35 ? 2 : 1;

    const subW = (blockW - 4) / subCols;
    const subD = (blockD - 4) / subRows;

    for (let sc = 0; sc < subCols; sc++) {
      for (let sr = 0; sr < subRows; sr++) {
        const bx = (centerX - blockW / 2 + 2) + sc * subW + subW / 2;
        const bz = (centerZ - blockD / 2 + 2) + sr * subD + subD / 2;

        let height = 15 + Math.random() * 25;
        if (isDowntown) {
          height = 40 + Math.random() * 55; // Downtown high-rises
        } else if (isWaterfront) {
          height = 20 + Math.random() * 30; // Coastal hotels and luxury condos
        }

        const bGeo = new THREE.BoxGeometry(subW - 2, height, subD - 2);
        const bMesh = new THREE.Mesh(bGeo, this.matBuilding);
        bMesh.position.set(bx, height / 2 + 0.3, bz);
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        this.scene.add(bMesh);

        // Roof structure (AC units or penthouse)
        const roofGeo = new THREE.BoxGeometry((subW - 2) * 0.5, 3, (subD - 2) * 0.5);
        const roofMesh = new THREE.Mesh(roofGeo, this.matRoof);
        roofMesh.position.set(bx, height + 1.8, bz);
        this.scene.add(roofMesh);

        // Add to collision objects
        this.colliders.push({
          x: bx,
          z: bz,
          halfW: (subW - 2) / 2 + 0.5,
          halfD: (subD - 2) / 2 + 0.5
        });

        // Add vibrant neon signs for landmark buildings
        if (isWaterfront && Math.random() > 0.4) {
          this.createNeonSign(bx, height - 3, bz + (subD - 2) / 2 + 0.2, 'HOTEL SOLANA', 0xff007f);
        } else if (isDowntown && Math.random() > 0.6) {
          this.createNeonSign(bx, height - 4, bz + (subD - 2) / 2 + 0.2, 'VICE SYNDICATE', 0x00e5ff);
        }
      }
    }
  }

  createNeonSign(x, y, z, text, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, 248, 56);
    ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0');
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: texture });
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), signMat);
    signMesh.position.set(x, y, z);
    this.scene.add(signMesh);
  }

  buildBeachAndOcean() {
    // Golden Beach strip along East (X: 70 to 120)
    const beachGeo = new THREE.PlaneGeometry(50, 600);
    const beachMesh = new THREE.Mesh(beachGeo, this.matSand);
    beachMesh.rotation.x = -Math.PI / 2;
    beachMesh.position.set(95, 0.1, 0);
    this.scene.add(beachMesh);

    // Beach Umbrellas & Sunbeds along the shoreline
    for (let z = -200; z <= 200; z += 35) {
      this.createBeachUmbrella(82, 0.15, z);
      this.createBeachUmbrella(90, 0.15, z + 12);
    }

    // Sparkling Blue Ocean (X: 120 to 450)
    const oceanGeo = new THREE.PlaneGeometry(350, 600, 32, 32);
    this.oceanMesh = new THREE.Mesh(oceanGeo, this.matWater);
    this.oceanMesh.rotation.x = -Math.PI / 2;
    this.oceanMesh.position.set(295, 0.02, 0);
    this.scene.add(this.oceanMesh);
  }

  createBeachUmbrella(x, y, z) {
    const group = new THREE.Group();
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0xd7ccc8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.2;
    group.add(pole);

    // Striped Canopy
    const canopyGeo = new THREE.ConeGeometry(1.6, 0.8, 8);
    const canopyMat = new THREE.MeshLambertMaterial({
      color: Math.random() > 0.5 ? 0xff4081 : 0x00e5ff
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 2.2;
    group.add(canopy);

    // Sunbed Lounger
    const bedGeo = new THREE.BoxGeometry(0.8, 0.2, 1.8);
    const bedMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.set(0.8, 0.1, 0);
    group.add(bed);

    group.position.set(x, y, z);
    this.scene.add(group);
  }

  buildMarina() {
    // Marina pier extending into the bay at Z = 140 to 200, X = 70 to 140
    const pierGeo = new THREE.BoxGeometry(70, 1.2, 18);
    const pierMat = new THREE.MeshLambertMaterial({ color: 0x4e342e });
    const pier = new THREE.Mesh(pierGeo, pierMat);
    pier.position.set(105, 0.6, 170);
    this.scene.add(pier);

    this.colliders.push({
      x: 105,
      z: 170,
      halfW: 35,
      halfD: 9
    });

    // Luxury Yachts moored at the pier
    this.createYacht(115, 1.2, 190, 0);
    this.createYacht(130, 1.2, 150, Math.PI / 2);

    // Marina warehouse / safehouse garage
    const whGeo = new THREE.BoxGeometry(25, 8, 20);
    const whMat = new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6 });
    const wh = new THREE.Mesh(whGeo, whMat);
    wh.position.set(50, 4.3, 170);
    this.scene.add(wh);

    this.colliders.push({
      x: 50,
      z: 170,
      halfW: 13,
      halfD: 10.5
    });

    // Safehouse marker spawn
    this.spawnPoints.push({
      type: 'safehouse',
      x: 35,
      z: 170,
      name: 'Marina Safehouse Garage'
    });
  }

  createYacht(x, y, z, rotY) {
    const yachtGroup = new THREE.Group();
    // Hull
    const hullGeo = new THREE.BoxGeometry(20, 2.5, 6);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.y = 1;
    yachtGroup.add(hull);

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(10, 2.2, 4.5);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.3 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(-2, 3.2, 0);
    yachtGroup.add(cabin);

    yachtGroup.position.set(x, y, z);
    yachtGroup.rotation.y = rotY;
    this.scene.add(yachtGroup);
  }

  buildVegetationAndProps() {
    // Coastal Palm Trees along both sides of Ocean Boulevard
    for (let z = -220; z <= 220; z += 18) {
      this.createPalmTree(67, 0, z);
      this.createPalmTree(53, 0, z + 9);
    }

    // Street Lamps and Traffic Lights along intersections
    for (const z of this.roadZCoords) {
      this.createStreetLight(67, 0, z + 7);
      this.createStreetLight(67, 0, z - 7);
      this.createStreetLight(-40, 0, z + 7);
      this.createTrafficLight(53, 0, z + 7);
    }
  }

  createTrafficLight(x, y, z) {
    const post = new THREE.Group();
    // Metal Pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 5.5, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.8 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 2.75;
    post.add(pole);

    // Signal Box
    const boxGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x212121 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.set(0, 4.8, 0);
    post.add(box);

    // Glowing Bulbs (Red, Yellow, Green)
    const redGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const redLight = new THREE.Mesh(redGeo, new THREE.MeshBasicMaterial({ color: 0xff1744 }));
    redLight.position.set(0, 5.15, 0.21);
    post.add(redLight);

    const greenGeo = new THREE.SphereGeometry(0.1, 6, 6);
    const greenLight = new THREE.Mesh(greenGeo, new THREE.MeshBasicMaterial({ color: 0x00e676 }));
    greenLight.position.set(0, 4.45, 0.21);
    post.add(greenLight);

    post.position.set(x, y, z);
    this.scene.add(post);
  }

  update(dt) {
    // Gentle ocean wave undulation
    if (this.oceanMesh) {
      this.oceanMesh.position.y = 0.02 + Math.sin(Date.now() * 0.002) * 0.08;
    }
  }

  createPalmTree(x, y, z) {
    const palm = new THREE.Group();

    // Curved Trunk (3 segments)
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 7, 6);
    const trunk = new THREE.Mesh(trunkGeo, this.matTrunk);
    trunk.position.y = 3.5;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    palm.add(trunk);

    // Lush Palm Fronds radiating outwards
    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i / frondCount) * Math.PI * 2;
      const frondGeo = new THREE.ConeGeometry(1.2, 5, 4);
      const frond = new THREE.Mesh(frondGeo, this.matPalmLeaves);
      frond.position.set(0, 7, 0);
      frond.rotation.z = Math.PI / 3;
      frond.rotation.y = angle;
      palm.add(frond);
    }

    palm.position.set(x, y, z);
    this.scene.add(palm);
  }

  createStreetLight(x, y, z) {
    const lamp = new THREE.Group();
    // Pole
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 6, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.5 });
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 3;
    lamp.add(pole);

    // Arm
    const armGeo = new THREE.BoxGeometry(1.5, 0.15, 0.15);
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(-0.6, 6, 0);
    lamp.add(arm);

    // Light fixture
    const bulbGeo = new THREE.SphereGeometry(0.25, 6, 6);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff9c4 });
    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(-1.2, 5.8, 0);
    lamp.add(bulb);

    lamp.position.set(x, y, z);
    this.scene.add(lamp);
  }

  // Check collision of an entity bounding sphere/box with city buildings
  checkCollision(x, z, radius = 1.0) {
    for (const b of this.colliders) {
      if (
        x + radius > b.x - b.halfW &&
        x - radius < b.x + b.halfW &&
        z + radius > b.z - b.halfD &&
        z - radius < b.z + b.halfD
      ) {
        return b;
      }
    }
    return null;
  }
}
