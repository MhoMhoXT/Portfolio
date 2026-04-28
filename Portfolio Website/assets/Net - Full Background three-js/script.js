// --- Basic Three.js Setup ---
let scene, camera, renderer;
let particles, lineMesh;
let contentGroup; // To hold all visual elements

// --- Animation Parameters ---
const PARTICLE_COUNT = 700; // Increased particle count for a fuller look
const MAX_CONNECTION_DISTANCE = 0.4; // Adjusted for a larger space
const PARTICLE_SPEED = 0.001;

// --- Viewport Data ---
let viewWidth, viewHeight;
let particleData = [];

// --- Initialization ---
init();
animate();

/**
 * Initializes the entire Three.js scene, camera, and renderer.
 */
function init() {
  // Scene: The container for all 3D objects
  scene = new THREE.Scene();

  // Group to hold particles and lines
  contentGroup = new THREE.Group();
  scene.add(contentGroup);

  // Camera: Defines the perspective from which we view the scene
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  // Move camera back to see the full scene width/height we will calculate
  camera.position.z = 3;

  // Renderer: Renders the scene using WebGL
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Add an event listener to handle window resizing
  window.addEventListener("resize", onWindowResize, false);

  // Perform an initial resize to set up viewport dimensions
  onWindowResize();

  // Create the particles and lines
  createParticles();
  createLines();
}

/**
 * Creates the particle system, spreading particles across the viewport.
 */
function createParticles() {
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * 3);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const sceneX = (Math.random() - 0.5) * viewWidth;
    const sceneY = (Math.random() - 0.5) * viewHeight;
    const sceneZ = (Math.random() - 0.5) * 2;

    positions[i * 3] = sceneX;
    positions[i * 3 + 1] = sceneY;
    positions[i * 3 + 2] = sceneZ;

    // Store particle data (position and velocity) for the animation loop
    particleData.push({
      position: new THREE.Vector3(sceneX, sceneY, sceneZ),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * PARTICLE_SPEED,
        (Math.random() - 0.5) * PARTICLE_SPEED,
        (Math.random() - 0.5) * PARTICLE_SPEED
      ),
    });
  }

  // Set the positions for the particle geometry
  particleGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const textureLoader = new THREE.TextureLoader();
  const circleTexture = textureLoader.load("circle.png");
  // Define the material for the particles
  const particleMaterial = new THREE.PointsMaterial({
    size: 0.03,
    map: circleTexture,
    blending: THREE.AdditiveBlending, // Creates a nice glow effect where particles overlap
    transparent: true,
    alphaTest: 0.5,
    sizeAttenuation: true, // Particles get smaller as they are further away
  });

  particles = new THREE.Points(particleGeometry, particleMaterial);
  contentGroup.add(particles);
}

/**
 * Creates the line geometry and material for connecting particles.
 */
function createLines() {
  const lineGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PARTICLE_COUNT * PARTICLE_COUNT * 3);
  lineGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3)
  );

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    linewidth: 1,
    transparent: true,
    opacity: 0.08, // Slightly more transparent lines
  });

  lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
  contentGroup.add(lineMesh);
}

/**
 * Updates particle positions and handles screen wrapping.
 */
function updateParticles() {
  if (!particleData.length || !viewWidth) return;

  const positions = particles.geometry.attributes.position.array;
  const halfWidth = viewWidth / 2;
  const halfHeight = viewHeight / 2;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = particleData[i];
    p.position.add(p.velocity);

    // Screen wrap logic
    if (p.position.x > halfWidth) p.position.x = -halfWidth;
    if (p.position.x < -halfWidth) p.position.x = halfWidth;
    if (p.position.y > halfHeight) p.position.y = -halfHeight;
    if (p.position.y < -halfHeight) p.position.y = halfHeight;
    if (p.position.z > 1) p.position.z = -1;
    if (p.position.z < -1) p.position.z = 1;

    // Update the master position buffer for the particles
    positions[i * 3] = p.position.x;
    positions[i * 3 + 1] = p.position.y;
    positions[i * 3 + 2] = p.position.z;
  }

  particles.geometry.attributes.position.needsUpdate = true;
}

/**
 * Checks distances between particles and updates the line geometry to draw connections.
 */
function updateLines() {
  if (!particleData.length) return;

  const linePositions = lineMesh.geometry.attributes.position.array;
  let lineIndex = 0;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    for (let j = i + 1; j < PARTICLE_COUNT; j++) {
      const p1 = particleData[i].position;
      const p2 = particleData[j].position;
      const dist = p1.distanceTo(p2);

      if (dist < MAX_CONNECTION_DISTANCE) {
        linePositions[lineIndex++] = p1.x;
        linePositions[lineIndex++] = p1.y;
        linePositions[lineIndex++] = p1.z;
        linePositions[lineIndex++] = p2.x;
        linePositions[lineIndex++] = p2.y;
        linePositions[lineIndex++] = p2.z;
      }
    }
  }

  lineMesh.geometry.setDrawRange(0, lineIndex / 3);
  lineMesh.geometry.attributes.position.needsUpdate = true;
}

/**
 * Handles window resize events to keep the scene proportional.
 */
function onWindowResize() {
  // Update camera and renderer for the new window size
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Calculate the visible plane size at the camera's z-position
  const vFOV = THREE.MathUtils.degToRad(camera.fov); // Vertical FOV in radians
  viewHeight = 2 * Math.tan(vFOV / 2) * camera.position.z;
  viewWidth = viewHeight * camera.aspect;
}

/**
 * The main animation loop, called on every frame.
 */
function animate() {
  requestAnimationFrame(animate);

  updateParticles();
  updateLines();

  // Rotate the group for a dynamic effect
  if (contentGroup) {
    contentGroup.rotation.y += 0.0001;
    contentGroup.rotation.x += 0.0001;
  }

  renderer.render(scene, camera);
}
