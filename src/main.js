import * as THREE from 'three';
import './style.css';
import { createWorld } from './world.js';
import { Player } from './player.js';

const container = document.getElementById('game');
const loading = document.getElementById('loading');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fc8c4);
scene.fog = new THREE.FogExp2(0x9fc8c4, 0.0032);

const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 650);
camera.position.set(0, 7, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.domElement.className = 'webgl';
renderer.domElement.setAttribute('aria-label', 'PIXEL WORLD 3D game canvas');
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
container.prepend(renderer.domElement);

// Lighting.
const hemi = new THREE.HemisphereLight(0xe3f4ed, 0x62765e, 1.7);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d7, 2.35);
sun.position.set(-55, 90, 35);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -115;
sun.shadow.camera.right = 115;
sun.shadow.camera.top = 115;
sun.shadow.camera.bottom = -115;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 230;
sun.shadow.bias = -0.00015;
scene.add(sun);
sun.target.position.set(0, 0, 0);
scene.add(sun.target);

const world = createWorld(scene);
const player = new Player(scene, world);

// Input state.
const input = { keys: new Set(), jumpPressed: false };
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'KeyH' && !event.repeat) {
    toggleHelp();
    return;
  }
  if (helpPanel.open) return;
  if (movementKeys.has(event.code) && !event.repeat) input.keys.add(event.code);
  if (event.code === 'Space' && !event.target.closest?.('button')) {
    event.preventDefault();
    if (!event.repeat) input.jumpPressed = true;
  }
  if (event.code === 'KeyE' && !event.repeat) interact();
});

window.addEventListener('keyup', (event) => {
  input.keys.delete(event.code);
});
window.addEventListener('blur', resetInput);

let cameraYaw = 0;
let cameraPitch = 0.31;
let cameraDistance = 8.5;
let activePointer = null;
let lastPointerX = 0;
let lastPointerY = 0;

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || activePointer !== null || helpPanel.open) return;
  activePointer = event.pointerId;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (event.pointerId !== activePointer || helpPanel.open) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  cameraYaw -= dx * 0.005;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch + dy * 0.003, 0.08, 0.82);
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  renderer.domElement.addEventListener(eventName, (event) => {
    if (event.pointerId === activePointer) activePointer = null;
  });
}
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
renderer.domElement.addEventListener('wheel', (event) => {
  if (helpPanel.open || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * units * 0.008, 4.5, 15);
}, { passive: false });

// UI elements.
const interactionEl = document.getElementById('interaction');
const interactionText = document.getElementById('interaction-text');
const toastEl = document.getElementById('toast');
const helpPanel = document.getElementById('help-panel');
const minimap = document.getElementById('minimap');
const mapCtx = minimap.getContext('2d');
const questStatus = document.getElementById('quest-status');
const questProgress = document.querySelector('.quest-progress span');
const questDesc = document.querySelector('.quest-desc');
const environmentEl = document.getElementById('environment');
const inventoryEl = document.getElementById('inventory');
const clockEl = document.getElementById('clock');

let toastTimer = 0;
let gameTime = 0;
let mapTimer = 0;
let lastMinute = 8 * 60;
let lastSwimming = false;

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.add('hidden'), 2600);
}

function toggleHelp() {
  if (helpPanel.open) {
    closeHelp();
  } else {
    resetInput();
    helpPanel.showModal();
  }
}
function closeHelp() {
  helpPanel.close();
}
function resetInput() {
  input.keys.clear();
  input.jumpPressed = false;
  const pointer = activePointer;
  activePointer = null;
  if (pointer !== null && renderer.domElement.hasPointerCapture(pointer)) {
    renderer.domElement.releasePointerCapture(pointer);
  }
}
document.getElementById('open-help').addEventListener('click', toggleHelp);
document.getElementById('close-help').addEventListener('click', closeHelp);

function findNearestInteractable() {
  let nearest = null;
  let nearestDistance = 3.8 ** 2;
  const playerPos = player.root.position;
  for (const item of world.interactables) {
    const distance = item.position.distanceToSquared(playerPos);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = item;
    }
  }
  return nearest;
}

function interact() {
  const nearest = findNearestInteractable();
  if (!nearest) {
    showToast('附近没有可以交互的物体。');
    return;
  }
  const wasUsed = nearest.used;
  const message = nearest.action();
  if (nearest.id === 'chest' && !wasUsed && nearest.used) inventoryEl.textContent = '岛屿探索徽章 ×1';
  if (nearest.id === 'beacon' && !wasUsed && nearest.used) {
    questStatus.textContent = '已完成';
    questProgress.style.width = '100%';
    questDesc.textContent = '信标已激活，岛屿探索记录已更新。';
  }
  showToast(message);
}

let lastPrompt;
function updateInteractionPrompt() {
  const nearest = findNearestInteractable();
  const prompt = nearest ? nearest.name + (nearest.used ? ' · 查看' : ' · 交互') : '';
  if (prompt === lastPrompt) return;
  lastPrompt = prompt;
  if (nearest) {
    interactionText.textContent = prompt;
    interactionEl.classList.remove('hidden');
  } else {
    interactionEl.classList.add('hidden');
  }
}

const cameraTarget = player.root.position.clone().add(new THREE.Vector3(0, 1.48, 0));
const cameraOffset = new THREE.Vector3();
let orbitYaw = cameraYaw;
let orbitPitch = cameraPitch;
let orbitDistance = cameraDistance;
let availableOrbit = 1;

function updateCamera(dt) {
  const follow = 1 - Math.exp(-12 * dt);
  const position = player.root.position;
  cameraTarget.x = THREE.MathUtils.lerp(cameraTarget.x, position.x, follow);
  cameraTarget.y = THREE.MathUtils.lerp(cameraTarget.y, position.y + (player.swimming ? 1.05 : 1.48), follow);
  cameraTarget.z = THREE.MathUtils.lerp(cameraTarget.z, position.z, follow);
  cameraTarget.y = Math.max(cameraTarget.y, world.heightAt(cameraTarget.x, cameraTarget.z) + 0.4);
  orbitYaw = THREE.MathUtils.lerp(orbitYaw, cameraYaw, follow);
  orbitPitch = THREE.MathUtils.lerp(orbitPitch, cameraPitch, follow);
  orbitDistance = THREE.MathUtils.lerp(orbitDistance, cameraDistance, follow);
  const horizontal = Math.cos(orbitPitch) * orbitDistance;
  cameraOffset.set(Math.sin(orbitYaw) * horizontal, Math.sin(orbitPitch) * orbitDistance + 1.2, Math.cos(orbitYaw) * horizontal);

  let clearance = 1;
  const steps = Math.ceil(orbitDistance * 3);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ground = world.heightAt(cameraTarget.x + cameraOffset.x * t, cameraTarget.z + cameraOffset.z * t);
    if (cameraTarget.y + cameraOffset.y * t < ground + 0.35) {
      clearance = (i - 1) / steps;
      break;
    }
  }
  availableOrbit = Math.min(clearance, THREE.MathUtils.lerp(availableOrbit, clearance, follow));
  camera.position.copy(cameraTarget).addScaledVector(cameraOffset, Math.max(0.04, availableOrbit));
  camera.position.y = Math.max(camera.position.y, world.waterLevel + 0.35, world.heightAt(camera.position.x, camera.position.z) + 0.35);
  camera.lookAt(cameraTarget);
}

const mapBackground = document.createElement('canvas');
mapBackground.width = minimap.width;
mapBackground.height = minimap.height;
const mapRadius = minimap.width / 2 - 7;
const mapScale = (mapRadius - 8) / world.playRadius;

function buildMinimapBackground() {
  const ctx = mapBackground.getContext('2d');
  const center = minimap.width / 2;
  const pixels = ctx.createImageData(minimap.width, minimap.height);
  for (let y = 0; y < minimap.height; y++) {
    for (let x = 0; x < minimap.width; x++) {
      const dx = x + 0.5 - center;
      const dz = y + 0.5 - center;
      if (Math.hypot(dx, dz) > mapRadius) continue;
      const height = world.heightAt(dx / mapScale, dz / mapScale);
      const i = (y * minimap.width + x) * 4;
      const color = height < world.waterLevel - 0.6 ? [71,127,138]
        : height < world.waterLevel ? [97,151,151]
        : height < world.waterLevel + 0.8 ? [215,197,150]
        : height > 10.5 ? [154,161,151]
        : [100 + Math.round(height * 4), 149 + Math.round(height * 2), 107];
      pixels.data.set(color, i);
      pixels.data[i + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(center, center, mapRadius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawMinimap() {
  const w = minimap.width;
  const h = minimap.height;
  const cx = w / 2, cy = h / 2;
  mapCtx.clearRect(0, 0, w, h);

  mapCtx.drawImage(mapBackground, 0, 0);
  const markerColors = { camp: '#ffad65', beacon: '#b8f3d2', chest: '#e7c27d' };
  for (const item of world.interactables) {
    const px = cx + item.position.x * mapScale;
    const py = cy + item.position.z * mapScale;
    mapCtx.fillStyle = item.used ? '#eaffea' : markerColors[item.id];
    mapCtx.beginPath(); mapCtx.arc(px, py, 3.3, 0, Math.PI*2); mapCtx.fill();
  }

  const px = cx + player.root.position.x * mapScale;
  const py = cy + player.root.position.z * mapScale;
  mapCtx.save();
  mapCtx.translate(px, py);
  mapCtx.rotate(-player.root.rotation.y);
  mapCtx.fillStyle = '#fff8d7';
  mapCtx.strokeStyle = '#31544a';
  mapCtx.lineWidth = 2;
  mapCtx.beginPath();
  mapCtx.moveTo(0, -7);
  mapCtx.lineTo(5, 5);
  mapCtx.lineTo(0, 3);
  mapCtx.lineTo(-5, 5);
  mapCtx.closePath();
  mapCtx.fill();
  mapCtx.stroke();
  mapCtx.restore();
}

function updateClock(dt) {
  gameTime += dt;
  const totalMinutes = 8 * 60 + Math.floor(gameTime * 1.3);
  if (totalMinutes === lastMinute) return;
  lastMinute = totalMinutes;
  const day = String(1 + Math.floor(totalMinutes / 1440)).padStart(2, '0');
  const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  clockEl.textContent = `DAY ${day} · ${hours}:${minutes}`;
}

function updateEnvironment() {
  if (player.swimming === lastSwimming) return;
  lastSwimming = player.swimming;
  environmentEl.firstElementChild.textContent = lastSwimming ? '≈' : '☀';
  environmentEl.lastElementChild.textContent = lastSwimming ? '水中探索 · 注意浮力' : '晴朗 · 微风';
}

// Resize.
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Initial help toast.
showToast('欢迎来到未知岛屿。按 H 查看操作指南，靠近物体按 E 交互。');

buildMinimapBackground();
drawMinimap();
updateCamera(0);
let lastFrame;

function animate(now) {
  const dt = lastFrame === undefined ? 0 : Math.min((now - lastFrame) / 1000, 0.08);
  lastFrame = now;
  if (!helpPanel.open) {
    const steps = Math.ceil(dt / (1 / 60));
    for (let i = 0; i < steps; i++) {
      player.update(dt / steps, input, orbitYaw);
      input.jumpPressed = false;
    }
  }

  world.update(now / 1000);
  updateCamera(dt);
  updateInteractionPrompt();
  updateClock(dt);
  updateEnvironment();

  mapTimer += dt;
  if (mapTimer > 0.12) {
    drawMinimap();
    mapTimer = 0;
  }

  renderer.render(scene, camera);
  if (dt === 0) loading.classList.add('done');

  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
