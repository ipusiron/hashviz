// ------------------------------
// 3D Visualization Functions
// ------------------------------

// Initialize 3D scene
function init3D(containerId) {
  console.log('Initializing 3D scene for:', containerId);
  const container = $(containerId);
  console.log('Container element found:', !!container);
  if (!container) {
    console.error('3D container not found:', containerId);
    return null;
  }
  
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);
  
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
  camera.position.set(10, 10, 10);
  camera.lookAt(0, 0, 0);
  
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(400, 400);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  console.log('WebGL renderer created:', !!renderer);
  
  container.appendChild(renderer.domElement);
  console.log('Renderer DOM element appended to container');
  
  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(20, 20, 20);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
  
  // Simple rotation animation
  function animate() {
    requestAnimationFrame(animate);
    
    // Add simple rotation
    const hashGroup = scene.getObjectByName('hashGroup');
    if (hashGroup) {
      hashGroup.rotation.y += 0.005;
      hashGroup.rotation.x += 0.002;
    }
    
    renderer.render(scene, camera);
  }
  console.log('Starting animation loop');
  animate();
  
  return { scene, renderer, camera };
}

// ハッシュ値から3Dオブジェクト生成
function create3DFromBits(bits, scene, canvasId = '') {
  console.log('Creating 3D from bits:', bits.length, 'for canvas:', canvasId);
  
  // 既存のハッシュオブジェクトを削除
  const existingGroup = scene.getObjectByName('hashGroup');
  if (existingGroup) {
    scene.remove(existingGroup);
  }

  const group = new THREE.Group();
  group.name = 'hashGroup';

  // ビット数に応じたグリッドサイズを決定
  let cols, rows, layers;
  if (bits.length === 128) { // MD5
    cols = 8; rows = 4; layers = 4;
  } else if (bits.length === 160) { // SHA-1
    cols = 8; rows = 5; layers = 4;
  } else if (bits.length === 256) { // SHA-256
    cols = 8; rows = 8; layers = 4;
  } else if (bits.length === 512) { // SHA-512
    cols = 8; rows = 8; layers = 8;
  } else if (bits.length === 16) { // ToyHash16
    cols = 4; rows = 2; layers = 2;
  } else {
    // デフォルト: できるだけ立方体に近い形
    const total = bits.length;
    layers = Math.ceil(Math.pow(total, 1/3));
    rows = Math.ceil(Math.sqrt(total / layers));
    cols = Math.ceil(total / (layers * rows));
  }

  // マテリアル定義
  const onMaterial = new THREE.MeshLambertMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.9 
  });
  const offMaterial = new THREE.MeshLambertMaterial({ 
    color: 0x333333, 
    transparent: true, 
    opacity: 0.7 
  });
  
  // 選択されたビット用のハイライトマテリアル
  const onSelectedMaterial = new THREE.MeshLambertMaterial({ 
    color: 0xff4444, 
    transparent: true, 
    opacity: 1.0 
  });
  const offSelectedMaterial = new THREE.MeshLambertMaterial({ 
    color: 0xaa2222, 
    transparent: true, 
    opacity: 1.0 
  });

  // キューブジオメトリ
  const geometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);

  // ビットごとにキューブを配置
  for (let i = 0; i < bits.length; i++) {
    const bit = bits[i];
    const canvasSelectedBits = selectedBits[canvasId] || new Set();
    const isSelected = canvasSelectedBits.has(i);
    
    // 2D左上→3D手前頂点（右上奥）を維持、2Dの右方向→3Dの上方向
    const zLayer = Math.floor(i / (cols * rows));
    const yRow = Math.floor((i % (cols * rows)) / cols);
    const xCol = i % cols;
    
    // 2D左上→3D手前頂点（右上奥）を維持、2Dの右方向→3Dの上方向
    const x = (rows - 1) - yRow;     // 2Dの行→3Dのx座標（逆転）
    const y = (cols - 1) - xCol;     // 2Dの列→3Dのy座標（逆転、右→上）
    const z = (layers - 1) - zLayer; // z座標を逆転（2D左上→3D手前）

    // 選択状態に応じてマテリアルを選択
    let material;
    if (isSelected) {
      material = bit === 1 ? onSelectedMaterial : offSelectedMaterial;
    } else {
      material = bit === 1 ? onMaterial : offMaterial;
    }

    const cube = new THREE.Mesh(geometry, material);
    
    // 中央寄せのため、オフセット計算（x軸とy軸を入れ替えたため調整）
    const spacing = 1.2;  // キューブ間の間隔
    const offsetX = (rows - 1) * spacing * 0.5;   // xはrowsに対応
    const offsetY = (cols - 1) * spacing * 0.5;   // yはcolsに対応
    const offsetZ = (layers - 1) * spacing * 0.5;
    
    cube.position.set(
      (x - offsetX / spacing) * spacing, 
      (y - offsetY / spacing) * spacing, 
      (z - offsetZ / spacing) * spacing
    );
    cube.castShadow = true;
    cube.receiveShadow = true;
    
    group.add(cube);
  }

  scene.add(group);
  console.log('Created 3D group with', group.children.length, 'children');
  return group;
}

// プレースホルダー3D表示
function createPlaceholder3D(scene, bitCount) {
  console.log('Creating placeholder 3D for bit count:', bitCount);
  
  const existingGroup = scene.getObjectByName('hashGroup');
  if (existingGroup) {
    scene.remove(existingGroup);
  }

  const group = new THREE.Group();
  group.name = 'hashGroup';

  // ビット数に応じたグリッドサイズを決定
  let cols, rows, layers;
  if (bitCount === 128) { // MD5
    cols = 8; rows = 4; layers = 4;
  } else if (bitCount === 160) { // SHA-1
    cols = 8; rows = 5; layers = 4;
  } else if (bitCount === 256) { // SHA-256
    cols = 8; rows = 8; layers = 4;
  } else if (bitCount === 512) { // SHA-512
    cols = 8; rows = 8; layers = 8;
  } else if (bitCount === 16) { // ToyHash16
    cols = 4; rows = 2; layers = 2;
  } else {
    // デフォルト: できるだけ立方体に近い形
    layers = Math.ceil(Math.pow(bitCount, 1/3));
    rows = Math.ceil(Math.sqrt(bitCount / layers));
    cols = Math.ceil(bitCount / (layers * rows));
  }

  // ワイヤーフレームでボックスの形状を示す
  const wireframeMaterial = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.5 });
  
  // 各位置にワイヤーフレームキューブを配置
  for (let zLayer = 0; zLayer < layers; zLayer++) {
    for (let yRow = 0; yRow < rows; yRow++) {
      for (let xCol = 0; xCol < cols; xCol++) {
        const index = zLayer * (cols * rows) + yRow * cols + xCol;
        if (index >= bitCount) break;

        // ワイヤーフレームキューブ
        const wireframeGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.0, 1.0, 1.0));
        const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
        
        // 2D左上→3D手前頂点（右上奥）を維持、2Dの右方向→3Dの上方向
        const x = (rows - 1) - yRow;     // 2Dの行→3Dのx座標（逆転）
        const y = (cols - 1) - xCol;     // 2Dの列→3Dのy座標（逆転、右→上）
        const z = (layers - 1) - zLayer; // z座標を逆転（2D左上→3D手前）
        
        // 中央寄せのため、オフセット計算（x軸とy軸を入れ替えたため調整）
        const spacing = 1.2;  // キューブ間の間隔
        const offsetX = (rows - 1) * spacing * 0.5;   // xはrowsに対応
        const offsetY = (cols - 1) * spacing * 0.5;   // yはcolsに対応
        const offsetZ = (layers - 1) * spacing * 0.5;
        
        wireframe.position.set(
          (x - offsetX / spacing) * spacing, 
          (y - offsetY / spacing) * spacing, 
          (z - offsetZ / spacing) * spacing
        );
        group.add(wireframe);
      }
    }
  }

  // 中央にテキスト表示
  const textGeometry = new THREE.PlaneGeometry(6, 1.5);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = '#666666';
  context.font = '28px Arial';
  context.textAlign = 'center';
  context.fillText('ハッシュ値を計算してください', 256, 70);
  
  const texture = new THREE.CanvasTexture(canvas);
  const textMaterial = new THREE.MeshBasicMaterial({ 
    map: texture, 
    transparent: true,
    side: THREE.DoubleSide
  });
  const textMesh = new THREE.Mesh(textGeometry, textMaterial);
  textMesh.position.set(0, 0, 0);
  group.add(textMesh);

  scene.add(group);
  return group;
}

// 3Dモードの場合に3D表示を更新
function update3DIfNeeded(canvas, bits) {
  const canvasId = canvas.id;
  let sceneKey = null;
  
  // キャンバスIDから対応する3Dシーンを特定
  if (canvasId === 'ava-canvas-a' && is3DMode.avalanche) {
    sceneKey = 'ava-a';
  } else if (canvasId === 'ava-canvas-b' && is3DMode.avalanche) {
    sceneKey = 'ava-b';
  } else if (canvasId === 'viz-canvas' && is3DMode.viz) {
    sceneKey = 'viz';
  } else if (canvasId === 'col-canvas-a' && is3DMode.collision) {
    sceneKey = 'col-a';
  } else if (canvasId === 'col-canvas-b' && is3DMode.collision) {
    sceneKey = 'col-b';
  }
  
  if (sceneKey && scenes[sceneKey] && renderers[sceneKey] && cameras[sceneKey]) {
    create3DFromBits(bits, scenes[sceneKey], canvasId);
    renderers[sceneKey].render(scenes[sceneKey], cameras[sceneKey]);
  }
}

// Update 3D selections for a specific canvas
function update3DSelectionsForCanvas(canvasId) {
  const bits = canvasBitData.get(canvasId);
  if (!bits) return;
  
  let sceneKey = null;
  
  // Map canvas ID to 3D scene key
  if (canvasId === 'ava-canvas-a' && is3DMode.avalanche) {
    sceneKey = 'ava-a';
  } else if (canvasId === 'ava-canvas-b' && is3DMode.avalanche) {
    sceneKey = 'ava-b';
  } else if (canvasId === 'viz-canvas' && is3DMode.viz) {
    sceneKey = 'viz';
  } else if (canvasId === 'col-canvas-a' && is3DMode.collision) {
    sceneKey = 'col-a';
  } else if (canvasId === 'col-canvas-b' && is3DMode.collision) {
    sceneKey = 'col-b';
  }
  
  // Update 3D scene if it exists and is active
  if (sceneKey && scenes[sceneKey] && renderers[sceneKey] && cameras[sceneKey]) {
    create3DFromBits(bits, scenes[sceneKey], canvasId);
    renderers[sceneKey].render(scenes[sceneKey], cameras[sceneKey]);
  }
}