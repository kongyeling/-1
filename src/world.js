import * as THREE from 'three';

const WATER_LEVEL = 0.35;
const TERRAIN_HALF_SIZE = 110;
const TERRAIN_SEGMENTS = 180;
const PLAY_RADIUS = 106;

function terrainHeight(x, z) {
  const r2 = x * x + z * z;
  const centralHill = 12.0 * Math.exp(-r2 / 3600);
  const highPeak = 9.0 * Math.exp(-((x - 27) ** 2 + (z + 22) ** 2) / 360);
  const westHill = 5.0 * Math.exp(-((x + 34) ** 2 + (z - 13) ** 2) / 520);
  const eastHill = 3.2 * Math.exp(-((x - 43) ** 2 + (z - 31) ** 2) / 400);
  const rolling = 0.55 * Math.sin(x * 0.105) * Math.cos(z * 0.083)
    + 0.28 * Math.sin((x + z) * 0.19);
  return -2.35 + centralHill + highPeak + westHill + eastHill + rolling;
}

function seededRandom(seed = 1337) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeMaterial(color, roughness = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function createTree(variant) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.24, 1.8, 6),
    makeMaterial(variant === 2 ? 0x786044 : 0x79573b)
  );
  trunk.position.y = 0.85;
  trunk.castShadow = true;
  group.add(trunk);

  if (variant === 1) {
    const colors = [0x477b58, 0x588d61, 0x3e704f];
    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(1.05 - i * 0.16, 0),
        makeMaterial(colors[(i + 1) % colors.length])
      );
      crown.position.set((i - 1) * 0.12, 1.65 + i * 0.63, 0);
      crown.scale.set(1.0 - i * 0.1, 0.92, 1.0 - i * 0.1);
      crown.castShadow = true;
      group.add(crown);
    }
  } else {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.2, 2.7, 7),
      makeMaterial(variant === 2 ? 0x527e62 : 0x3f7955)
    );
    crown.position.y = 2.35;
    crown.castShadow = true;
    group.add(crown);
    const crown2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.88, 2.1, 7),
      makeMaterial(0x568a5e)
    );
    crown2.position.y = 3.1;
    crown2.castShadow = true;
    group.add(crown2);
  }
  return group;
}

function addForest(parent, placements) {
  const transform = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  placements.forEach((trees, variant) => {
    if (trees.length === 0) return;
    for (const part of createTree(variant).children) {
      part.updateMatrix();
      const batch = new THREE.InstancedMesh(part.geometry, part.material, trees.length);
      batch.castShadow = true;
      trees.forEach(({ x, y, z, scale }, i) => {
        transform.position.set(x, y, z);
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        batch.setMatrixAt(i, matrix.multiplyMatrices(transform.matrix, part.matrix));
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      parent.add(batch);
    }
  });
}

function addRock(parent, x, z, scale = 1, color = 0x87918a) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(1, 0),
    makeMaterial(color)
  );
  rock.position.set(x, terrainHeight(x, z) + 0.45 * scale, z);
  rock.scale.set(1.2 * scale, 0.75 * scale, 0.95 * scale);
  rock.rotation.set(0.2, x * 0.13, 0.1);
  rock.castShadow = true;
  rock.receiveShadow = true;
  parent.add(rock);
}

function addCabin(parent, x, z) {
  const y = terrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const wood = makeMaterial(0x9b7652);
  const darkWood = makeMaterial(0x5b4938);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.0, 4.4), makeMaterial(0xc6ad83));
  wall.position.y = 1.55;
  wall.castShadow = true;
  wall.receiveShadow = true;
  group.add(wall);

  const roofMat = makeMaterial(0x5a6251);
  const roofA = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.35, 4.9), roofMat);
  roofA.position.set(-1.0, 3.35, 0);
  roofA.rotation.z = -0.55;
  roofA.castShadow = true;
  group.add(roofA);
  const roofB = new THREE.Mesh(new THREE.BoxGeometry(3.25, 0.35, 4.9), roofMat);
  roofB.position.set(1.0, 3.35, 0);
  roofB.rotation.z = 0.55;
  roofB.castShadow = true;
  group.add(roofB);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.05, 0.12), darkWood);
  door.position.set(0, 1.05, -2.25);
  group.add(door);
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xb5d9d0, emissive: 0x253f3c, roughness: 0.3 });
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.8, 0.08), windowMat);
    window.position.set(side * 1.65, 1.9, -2.24);
    group.add(window);
  }
  const porch = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.25, 1.5), wood);
  porch.position.set(0, 0.35, -2.75);
  porch.receiveShadow = true;
  group.add(porch);

  parent.add(group);
  return group;
}

function addBeacon(parent, x, z) {
  const y = terrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);

  const stone = makeMaterial(0x78877b);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.7, 7), stone);
  base.position.y = 0.35;
  base.castShadow = true;
  group.add(base);

  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.48, 3.4, 7), makeMaterial(0x9cae9a));
  column.position.y = 2.2;
  column.castShadow = true;
  group.add(column);

  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xb9f4db, emissive: 0x4acb9c, emissiveIntensity: 1.8,
    roughness: 0.2, metalness: 0.1
  });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), crystalMat);
  crystal.position.y = 4.35;
  crystal.rotation.y = Math.PI / 4;
  group.add(crystal);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.0, 0.045, 6, 28),
    new THREE.MeshBasicMaterial({ color: 0x9af0c9 })
  );
  ring.position.y = 4.35;
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  parent.add(group);
  return { group, crystal, ring };
}

function addChest(parent, x, z) {
  const group = new THREE.Group();
  group.position.set(x, terrainHeight(x, z), z);

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.85, 0.9), makeMaterial(0x805632));
  body.position.y = 0.48;
  body.castShadow = true;
  group.add(body);

  const bandMat = makeMaterial(0xd6b66f);
  const band1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.9, 0.94), bandMat);
  band1.position.set(-0.36, 0.48, 0);
  group.add(band1);
  const band2 = band1.clone();
  band2.position.x = 0.36;
  group.add(band2);

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 0.88, 0.42);
  group.add(lidPivot);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.38, 0.92), makeMaterial(0x9a6a3e));
  lid.position.set(0, 0.05, -0.42);
  lid.rotation.x = -0.12;
  lid.castShadow = true;
  lidPivot.add(lid);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.08), bandMat);
  lock.position.set(0, 0.53, -0.49);
  group.add(lock);

  parent.add(group);
  return { group, lidPivot, opened: false };
}

function addArch(parent, x, z) {
  const y = terrainHeight(x, z);
  const group = new THREE.Group();
  group.position.set(x, y, z);
  const stone = makeMaterial(0x8c9a8a);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.9, 4.2, 0.9), stone);
  left.position.set(-1.6, 2.1, 0);
  const right = left.clone();
  right.position.x = 1.6;
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.1, 0.85, 1.0), stone);
  top.position.y = 4.1;
  for (const m of [left, right, top]) { m.castShadow = true; m.receiveShadow = true; group.add(m); }
  parent.add(group);
}

function addCloud(parent, x, y, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.82, flatShading: true });
  const parts = [[0,0,0,1.8],[1.3,0.1,0.1,1.25],[-1.2,-0.1,0.1,1.15],[0.3,0.55,0,1.2]];
  for (const [px,py,pz,s] of parts) {
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), mat);
    puff.position.set(px, py, pz);
    group.add(puff);
  }
  parent.add(group);
  return group;
}

export function createWorld(scene) {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const size = TERRAIN_HALF_SIZE * 2;
  const terrainGeometry = new THREE.PlaneGeometry(size, size, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  terrainGeometry.rotateX(-Math.PI / 2);
  const positions = terrainGeometry.attributes.position;
  const colors = [];
  const sand = new THREE.Color(0xd5c49a);
  const grass = new THREE.Color(0x739b68);
  const darkGrass = new THREE.Color(0x4f805a);
  const rock = new THREE.Color(0x858c82);
  const highRock = new THREE.Color(0xadb0a5);

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = terrainHeight(x, z);
    positions.setY(i, y);

    let color;
    if (y < WATER_LEVEL + 0.85) color = sand.clone();
    else if (y > 10.5) color = highRock.clone().lerp(rock, Math.min(1, (y - 10.5) / 5));
    else {
      const variation = 0.5 + 0.5 * Math.sin(x * 0.07 + z * 0.11);
      color = grass.clone().lerp(darkGrass, variation * 0.45);
    }
    const slopeTint = 0.94 + 0.06 * Math.sin(x * 0.18) * Math.cos(z * 0.14);
    color.multiplyScalar(slopeTint);
    colors.push(color.r, color.g, color.b);
  }
  terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  function heightAt(x, z) {
    if (Math.abs(x) > TERRAIN_HALF_SIZE || Math.abs(z) > TERRAIN_HALF_SIZE) return terrainHeight(x, z);
    const gridX = (x + TERRAIN_HALF_SIZE) * TERRAIN_SEGMENTS / size;
    const gridZ = (z + TERRAIN_HALF_SIZE) * TERRAIN_SEGMENTS / size;
    const col = Math.min(Math.floor(gridX), TERRAIN_SEGMENTS - 1);
    const row = Math.min(Math.floor(gridZ), TERRAIN_SEGMENTS - 1);
    const u = gridX - col;
    const v = gridZ - row;
    const stride = TERRAIN_SEGMENTS + 1;
    const i = row * stride + col;
    const b = positions.getY(i + stride);
    const d = positions.getY(i + 1);
    // Match the diagonal used by PlaneGeometry's two triangles.
    return u + v <= 1
      ? positions.getY(i) * (1 - u - v) + d * u + b * v
      : positions.getY(i + stride + 1) * (u + v - 1) + d * (1 - v) + b * (1 - u);
  }

  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true })
  );
  terrain.receiveShadow = true;
  terrain.castShadow = false;
  worldGroup.add(terrain);

  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600, 1, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x4a9fa5, roughness: 0.24, metalness: 0.05,
      transparent: true, opacity: 0.87, clearcoat: 0.8, clearcoatRoughness: 0.25
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  worldGroup.add(water);

  // Subtle shallow-water ring around the island.
  const shoreline = new THREE.Mesh(
    new THREE.RingGeometry(75, 91, 100),
    new THREE.MeshBasicMaterial({ color: 0x9bcfc1, transparent: true, opacity: 0.13, side: THREE.DoubleSide })
  );
  shoreline.rotation.x = -Math.PI / 2;
  shoreline.position.y = WATER_LEVEL + 0.025;
  worldGroup.add(shoreline);

  const forest = new THREE.Group();
  worldGroup.add(forest);
  const random = seededRandom(2026);
  const trees = [[], [], []];
  let placed = 0;
  let attempts = 0;
  while (placed < 112 && attempts < 900) {
    attempts++;
    const x = (random() * 2 - 1) * 78;
    const z = (random() * 2 - 1) * 78;
    const r = Math.hypot(x, z);
    const y = terrainHeight(x, z);
    if (r > 75 || y < WATER_LEVEL + 1.5) continue;
    if (Math.hypot(x + 8, z - 26) < 10) continue;
    if (Math.hypot(x + 22, z - 15) < 9) continue;
    if (Math.hypot(x - 27, z + 22) < 9) continue;
    const scale = 0.75 + random() * 0.65;
    trees[Math.floor(random() * 3)].push({ x, y: heightAt(x, z), z, scale });
    placed++;
  }
  addForest(forest, trees);

  const rocks = new THREE.Group();
  worldGroup.add(rocks);
  for (let i = 0; i < 44; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 42 + random() * 42;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (terrainHeight(x, z) > WATER_LEVEL + 0.7) {
      addRock(rocks, x, z, 0.45 + random() * 1.05, random() > 0.5 ? 0x87918a : 0x9c9a86);
    }
  }

  // Landmarks and simple interaction points.
  addCabin(worldGroup, -22, 15);
  const beacon = addBeacon(worldGroup, 27, -22);
  addArch(worldGroup, 5, 34);

  // A small campfire near the starting area.
  const camp = new THREE.Group();
  const campX = -1, campZ = 24, campY = terrainHeight(campX, campZ);
  camp.position.set(campX, campY, campZ);
  const stones = makeMaterial(0x777b70);
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), stones);
    s.position.set(Math.cos(a) * 0.75, 0.18, Math.sin(a) * 0.75);
    s.scale.set(1, 0.7, 1);
    camp.add(s);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.0, 6),
    new THREE.MeshBasicMaterial({ color: 0xffa64c })
  );
  flame.position.y = 0.65;
  camp.add(flame);
  const fireLight = new THREE.PointLight(0xffa45c, 2.0, 10);
  fireLight.position.y = 1.2;
  camp.add(fireLight);
  worldGroup.add(camp);

  const chest = addChest(worldGroup, 8, 18);

  // A few floating crystal collectibles / visual landmarks.
  const crystals = [];
  for (const [x, z] of [[-38, -22], [43, 8], [12, 55]]) {
    const group = new THREE.Group();
    group.position.set(x, terrainHeight(x, z) + 1.0, z);
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.65, 0),
      new THREE.MeshStandardMaterial({ color: 0x91e5d0, emissive: 0x2d8d7b, emissiveIntensity: 0.8, roughness: 0.2 })
    );
    gem.castShadow = true;
    group.add(gem);
    const glow = new THREE.PointLight(0x76d9c1, 0.7, 5);
    glow.position.y = 0.4;
    group.add(glow);
    worldGroup.add(group);
    crystals.push({ group, gem, collected: false, name: '岛屿晶石' });
  }

  const clouds = [
    addCloud(worldGroup, -55, 27, -35, 1.5),
    addCloud(worldGroup, 15, 31, 50, 1.2),
    addCloud(worldGroup, 62, 25, -5, 1.35),
    addCloud(worldGroup, -12, 34, -70, 1.1)
  ];
  const cloudOrigins = clouds.map(cloud => cloud.position.x);

  const interactables = [
    {
      id: 'chest',
      name: '古老宝箱',
      position: new THREE.Vector3(8, terrainHeight(8, 18) + 0.5, 18),
      action: () => {
        if (chest.opened) return '宝箱已经打开过了，里面空空如也。';
        chest.opened = true;
        chest.lidPivot.rotation.x = -1.05;
        return '获得：岛屿探索徽章 ×1！宝箱已开启。';
      },
      get used() { return chest.opened; }
    },
    {
      id: 'camp',
      name: '营地篝火',
      position: new THREE.Vector3(campX, campY + 0.3, campZ),
      action: () => '篝火温暖地燃烧着。这里可以作为你的临时营地。',
      get used() { return false; }
    },
    {
      id: 'beacon',
      name: '古代信标',
      position: new THREE.Vector3(27, terrainHeight(27, -22) + 1.0, -22),
      action: () => {
        if (beacon.crystal.material.emissiveIntensity > 2.5) return '古代信标已处于激活状态。';
        beacon.crystal.material.emissiveIntensity = 3.2;
        beacon.crystal.material.color.set(0xd3ffe8);
        return '信标已激活！未知岛屿的探索记录已更新。';
      },
      get used() { return beacon.crystal.material.emissiveIntensity > 2.5; }
    }
  ];

  return {
    group: worldGroup,
    heightAt,
    playRadius: PLAY_RADIUS,
    waterLevel: WATER_LEVEL,
    interactables,
    crystals,
    clouds,
    beacon,
    camp,
    update(time) {
      beacon.crystal.rotation.y = time * 0.55;
      beacon.ring.rotation.z = time * 0.35;
      for (let i = 0; i < crystals.length; i++) {
        const item = crystals[i];
        if (!item.collected) {
          item.gem.rotation.y = time * 0.8 + i;
          item.gem.position.y = Math.sin(time * 1.8 + i) * 0.16;
        }
      }
      flame.scale.y = 0.9 + Math.sin(time * 8) * 0.12;
      fireLight.intensity = 1.7 + Math.sin(time * 9) * 0.35;
      clouds.forEach((cloud, i) => {
        cloud.position.x = cloudOrigins[i] + Math.sin(time * 0.025 + i) * 4;
      });
    }
  };
}
