import * as THREE from 'three';

function standard(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

export class Player {
  constructor(scene, world, startX = -8, startZ = 26) {
    this.world = world;
    this.root = new THREE.Group();
    this.root.position.set(startX, world.heightAt(startX, startZ), startZ);
    scene.add(this.root);

    this.model = new THREE.Group();
    this.root.add(this.model);

    const skin = standard(0xd9ad83);
    const jacket = standard(0x4e786a);
    const jacketLight = standard(0x6d9880);
    const pants = standard(0x344c4b);
    const boots = standard(0x493e32);
    const hair = standard(0x4a3d32);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.68, 4, 8), jacket);
    torso.position.y = 1.27;
    torso.castShadow = true;
    this.model.add(torso);

    const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.35, 0.08), jacketLight);
    chestPanel.position.set(0, 1.42, -0.34);
    this.model.add(chestPanel);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.31, 10, 8), skin);
    head.position.y = 2.02;
    head.castShadow = true;
    this.model.add(head);

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.315, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    hairCap.position.set(0, 2.1, 0.015);
    this.model.add(hairCap);

    // Small eyes face the character's forward direction (-Z).
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x26352f });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.027, 6, 5), eyeMat);
      eye.position.set(side * 0.105, 2.035, -0.285);
      this.model.add(eye);
    }

    this.leftArm = this.makeLimb(-0.48, 1.58, 0.16, 0.68, jacketLight);
    this.rightArm = this.makeLimb(0.48, 1.58, 0.16, 0.68, jacketLight);
    this.leftLeg = this.makeLimb(-0.22, 0.78, 0.19, 0.76, pants);
    this.rightLeg = this.makeLimb(0.22, 0.78, 0.19, 0.76, pants);

    for (const leg of [this.leftLeg, this.rightLeg]) {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.38), boots);
      boot.position.set(0, -0.72, -0.07);
      leg.add(boot);
    }

    // Small backpack.
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.25), standard(0x8b7250));
    pack.position.set(0, 1.35, 0.37);
    pack.castShadow = true;
    this.model.add(pack);

    this.velocityY = 0;
    this.grounded = true;
    this.swimming = false;
    this.elapsed = 0;
    this.swimBoost = 0;
    this.walkPhase = 0;
    this.move = new THREE.Vector3();
  }

  makeLimb(x, y, radius, length, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius, length, 7), material);
    limb.position.y = -length * 0.48;
    limb.castShadow = true;
    pivot.add(limb);
    this.model.add(pivot);
    return pivot;
  }

  update(dt, input, cameraYaw) {
    this.elapsed += dt;
    const forwardInput = (input.keys.has('KeyW') ? 1 : 0) - (input.keys.has('KeyS') ? 1 : 0);
    const sideInput = (input.keys.has('KeyD') ? 1 : 0) - (input.keys.has('KeyA') ? 1 : 0);

    const sin = Math.sin(cameraYaw);
    const cos = Math.cos(cameraYaw);
    const move = this.move.set(sideInput * cos - forwardInput * sin, 0, -forwardInput * cos - sideInput * sin);

    if (move.lengthSq() > 1) move.normalize();

    const position = this.root.position;
    if (dt <= 0) return;
    const running = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    const walkSpeed = this.swimming ? 2.7 : (running ? 9.0 : 5.4);
    position.x += move.x * walkSpeed * dt;
    position.z += move.z * walkSpeed * dt;

    const radial = Math.hypot(this.root.position.x, this.root.position.z);
    if (radial > this.world.playRadius) {
      const scale = this.world.playRadius / radial;
      this.root.position.x *= scale;
      this.root.position.z *= scale;
    }

    if (move.lengthSq() > 0.001) {
      const heading = Math.atan2(-move.x, -move.z);
      const difference = heading - this.root.rotation.y;
      this.root.rotation.y += Math.atan2(Math.sin(difference), Math.cos(difference)) * (1 - Math.exp(-20 * dt));
    }

    const groundY = this.world.heightAt(position.x, position.z);
    const water = this.world.waterLevel;
    const wasSwimming = this.swimming;
    if (wasSwimming) {
      if (groundY >= water - 0.08) {
        this.swimming = false;
        this.swimBoost = 0;
      }
    } else if (groundY < water - 0.3 && position.y <= water + 0.08) {
      this.swimming = true;
    }

    if (this.swimming) {
      this.grounded = false;
      this.velocityY = 0;
      if (input.jumpPressed) this.swimBoost = 0.45;
      const targetY = water - 0.82 + Math.sin(this.elapsed * 2.5) * 0.045 + this.swimBoost;
      position.y = Math.max(groundY, THREE.MathUtils.lerp(position.y, targetY, 1 - Math.exp(-7 * dt)));
      this.swimBoost = Math.max(0, this.swimBoost - dt);
      this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, -0.9, dt * 5);
    } else {
      this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, 0, dt * 5);
      if (input.jumpPressed && (this.grounded || wasSwimming)) {
        position.y = Math.max(position.y, groundY);
        this.velocityY = 7.2;
        this.grounded = false;
      }
      if (this.grounded && groundY >= water - 0.15) {
        position.y = groundY;
      } else {
        this.velocityY -= 19 * dt;
        position.y += this.velocityY * dt;
      }
      if (position.y <= groundY) {
        position.y = groundY;
        this.velocityY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
    }

    const moving = move.lengthSq() > 0.001;
    if (moving && !this.swimming) this.walkPhase += dt * (running ? 12.5 : 8.5);
    const swing = moving ? Math.sin(this.walkPhase) * 0.62 : 0;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -swing * 0.72;
    this.rightArm.rotation.x = swing * 0.72;

    if (this.swimming) {
      this.leftArm.rotation.x = Math.sin(this.elapsed * 5) * 0.45 - 0.3;
      this.rightArm.rotation.x = -Math.sin(this.elapsed * 5) * 0.45 - 0.3;
      this.leftLeg.rotation.x = Math.sin(this.elapsed * 5 + 1) * 0.35;
      this.rightLeg.rotation.x = -Math.sin(this.elapsed * 5 + 1) * 0.35;
    }
  }
}
