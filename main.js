import { sceneState, addAssetToScene, getAssetById, updateAsset, removeAsset, markAsDirty, isStateDirty, clearDirtyFlag } from './state.js';
import { initializeCanvas, redrawCanvas, getAssetAtPos, getSelectedAsset, clearAssetImages, setTool } from './editor.js';
import { generateImage } from './api.js';

const loadingOverlay = document.getElementById('loading-overlay');
const generateSceneBtn = document.getElementById('generate-scene-btn');
const generateAssetBtn = document.getElementById('generate-asset-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const saveBtn = document.getElementById('save-btn');
const assetLibrary = document.getElementById('asset-library');
const propertiesPanel = document.getElementById('properties-panel-content');

let lastGeneratedAsset = null;
let touchDragGhost = null;

function showLoader() {
    loadingOverlay.style.display = 'flex';
}

function hideLoader() {
    loadingOverlay.style.display = 'none';
}

async function handleGenerateScene() {
    showLoader();
    const prompt = document.getElementById('scene-prompt').value;
    try {
        const result = await generateImage(prompt, false, "16:9");
        sceneState.background = result.url;
        markAsDirty();
        redrawCanvas();
    } catch (error) {
        console.error('Failed to generate scene:', error);
        alert('Could not generate scene background.');
    } finally {
        hideLoader();
    }
}

async function handleGenerateAsset() {
    showLoader();
    const prompt = document.getElementById('asset-prompt').value;
    if (!prompt) {
        alert('Please enter a prompt for the asset.');
        hideLoader();
        return;
    }
    try {
        const isTransparent = document.getElementById('asset-transparent').checked;
        const result = await generateImage(prompt, isTransparent, "1:1");
        const assetType = document.getElementById('asset-type').value;
        
        const asset = {
            id: `asset_${Date.now()}`,
            type: assetType,
            prompt: prompt,
            url: result.url,
            name: `${assetType} - ${prompt.substring(0, 15)}...`
        };
        
        lastGeneratedAsset = asset;
        
        const img = document.createElement('img');
        img.src = asset.url;
        img.title = asset.prompt;
        img.classList.add('library-asset');
        img.draggable = true; // Make library assets draggable
        img.dataset.assetId = asset.id;
        img.dataset.assetUrl = asset.url;
        img.dataset.assetType = asset.type;
        img.dataset.assetPrompt = asset.prompt;
        
        // Add to library
        assetLibrary.appendChild(img);
        
        // Select it
        selectLibraryAsset(img);

        markAsDirty(); // A new asset in library is a change
    } catch (error) {
        console.error('Failed to generate asset:', error);
        alert('Could not generate asset.');
    } finally {
        hideLoader();
    }
}

function selectLibraryAsset(element) {
    document.querySelectorAll('.library-asset').forEach(el => el.classList.remove('selected'));
    if(element) {
        element.classList.add('selected');
        lastGeneratedAsset = {
            id: `asset_${Date.now()}`,
            url: element.dataset.assetUrl,
            type: element.dataset.assetType,
            prompt: element.dataset.assetPrompt
        };
        setTool('add'); // Automatically switch to add tool on mobile for tap-to-place
    } else {
        lastGeneratedAsset = null;
    }
}

function handleImportJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = readerEvent => {
            try {
                const importedData = JSON.parse(readerEvent.target.result);
                
                // Basic validation
                if (importedData && Array.isArray(importedData.assets)) {
                    // Reset current scene state before loading new one
                    sceneState.background = importedData.background || null;
                    sceneState.assets = importedData.assets || [];
                    
                    clearAssetImages(); // Clear cached images of old assets
                    markAsDirty();
                    redrawCanvas();
                    updatePropertiesPanel(null); // Clear properties panel
                    console.log("Scene imported successfully.");
                } else {
                    alert('Invalid or corrupted scene file.');
                }
            } catch (error) {
                console.error("Failed to parse JSON file:", error);
                alert('Failed to read or parse the scene file. Please ensure it is a valid JSON.');
            }
        };
        reader.onerror = error => {
            console.error("File reading error:", error);
            alert("Error reading file.");
        };
        reader.readAsText(file);
    };
    input.click();
}

function handleExportJson() {
    const dataStr = JSON.stringify(sceneState, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'scene.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

export function updatePropertiesPanel(assetId) {
    if (!assetId) {
        propertiesPanel.innerHTML = '<p>Select an asset to see its properties.</p>';
        return;
    }

    const asset = getAssetById(assetId);
    if (!asset) {
        propertiesPanel.innerHTML = '<p>Asset not found.</p>';
        return;
    }

    propertiesPanel.innerHTML = `
        <div class="control-group">
            <label>Name</label>
            <input type="text" id="prop-name" value="${asset.name}">
            <label>Type</label>
            <input type="text" id="prop-type" value="${asset.type}" disabled>
            <label>Prompt</label>
            <textarea id="prop-prompt" rows="3" disabled>${asset.prompt}</textarea>
            <label>X</label>
            <input type="number" id="prop-x" value="${Math.round(asset.x)}">
            <label>Y</label>
            <input type="number" id="prop-y" value="${Math.round(asset.y)}">
            <label>Width</label>
            <input type="number" id="prop-width" value="${Math.round(asset.width)}">
            <label>Height</label>
            <input type="number" id="prop-height" value="${Math.round(asset.height)}">
        </div>
    `;

    document.getElementById('prop-name').addEventListener('change', (e) => updateAsset(assetId, { name: e.target.value }));
    document.getElementById('prop-x').addEventListener('change', (e) => {
        updateAsset(assetId, { x: parseInt(e.target.value) });
        redrawCanvas();
    });
     document.getElementById('prop-y').addEventListener('change', (e) => {
        updateAsset(assetId, { y: parseInt(e.target.value) });
        redrawCanvas();
    });
     document.getElementById('prop-width').addEventListener('change', (e) => {
        updateAsset(assetId, { width: parseInt(e.target.value) });
        redrawCanvas();
    });
     document.getElementById('prop-height').addEventListener('change', (e) => {
        updateAsset(assetId, { height: parseInt(e.target.value) });
        redrawCanvas();
    });
}

function saveStateToLocalStorage() {
    try {
        console.log("Saving state to localStorage...");
        localStorage.setItem('sceneState', JSON.stringify(sceneState));
        
        const libraryAssets = [];
        document.querySelectorAll('.library-asset').forEach(img => {
            libraryAssets.push({
                url: img.dataset.assetUrl,
                type: img.dataset.assetType,
                prompt: img.dataset.assetPrompt,
            });
        });
        localStorage.setItem('assetLibrary', JSON.stringify(libraryAssets));
        
        clearDirtyFlag();
        saveBtn.classList.remove('dirty');
        console.log("State saved.");
    } catch (e) {
        console.error("Failed to save state to localStorage", e);
    }
}

function loadStateFromLocalStorage() {
    try {
        const savedState = localStorage.getItem('sceneState');
        if (savedState) {
            console.log("Loading scene state from localStorage...");
            const parsedState = JSON.parse(savedState);
            // Quick check to avoid loading invalid data
            if (parsedState && typeof parsedState === 'object') {
                Object.assign(sceneState, parsedState);
            }
        }

        const savedLibrary = localStorage.getItem('assetLibrary');
        if (savedLibrary) {
            console.log("Loading asset library from localStorage...");
            const parsedLibrary = JSON.parse(savedLibrary);
            if(Array.isArray(parsedLibrary)) {
                assetLibrary.innerHTML = ''; // Clear existing
                parsedLibrary.forEach(assetData => {
                    const img = document.createElement('img');
                    img.src = assetData.url;
                    img.title = assetData.prompt;
                    img.classList.add('library-asset');
                    img.draggable = true;
                    img.dataset.assetUrl = assetData.url;
                    img.dataset.assetType = assetData.type;
                    img.dataset.assetPrompt = assetData.prompt;
                    assetLibrary.appendChild(img);
                });
            }
        }
    } catch (e) {
        console.error("Failed to load state from localStorage", e);
    }
}


document.addEventListener('DOMContentLoaded', () => {
    loadStateFromLocalStorage();
    initializeCanvas(document.getElementById('editor-canvas'));
    redrawCanvas(); // Draw loaded state

    generateSceneBtn.addEventListener('click', handleGenerateScene);
    generateAssetBtn.addEventListener('click', handleGenerateAsset);
    importJsonBtn.addEventListener('click', handleImportJson);
    exportJsonBtn.addEventListener('click', handleExportJson);
    saveBtn.addEventListener('click', () => {
        saveStateToLocalStorage();
        // Maybe add a more subtle notification in the future
        alert('Scene Saved!');
    });

    assetLibrary.addEventListener('click', (e) => {
        if (e.target.classList.contains('library-asset')) {
            selectLibraryAsset(e.target);
        }
    });

    assetLibrary.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('library-asset')) {
            const assetData = {
                url: e.target.dataset.assetUrl,
                type: e.target.dataset.assetType,
                prompt: e.target.dataset.assetPrompt
            };
            e.dataTransfer.setData('application/json', JSON.stringify(assetData));
            selectLibraryAsset(e.target); // Also select it visually
        }
    });

    // --- Mobile Tap-and-Drag from Library ---
    let isDraggingFromLibrary = false;
    let dragData = null;

    assetLibrary.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('library-asset')) {
            e.preventDefault();
            isDraggingFromLibrary = true;
            
            const targetImg = e.target;
            dragData = {
                url: targetImg.dataset.assetUrl,
                type: targetImg.dataset.assetType,
                prompt: targetImg.dataset.assetPrompt,
            };
            
            // Create ghost element
            touchDragGhost = document.createElement('img');
            touchDragGhost.src = targetImg.src;
            touchDragGhost.style.position = 'fixed';
            touchDragGhost.style.width = '60px';
            touchDragGhost.style.height = '60px';
            touchDragGhost.style.pointerEvents = 'none';
            touchDragGhost.style.opacity = '0.7';
            touchDragGhost.style.zIndex = '2000';
            
            const touch = e.touches[0];
            touchDragGhost.style.left = `${touch.clientX - 30}px`;
            touchDragGhost.style.top = `${touch.clientY - 30}px`;
            
            document.body.appendChild(touchDragGhost);
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (isDraggingFromLibrary && touchDragGhost) {
            const touch = e.touches[0];
            touchDragGhost.style.left = `${touch.clientX - 30}px`;
            touchDragGhost.style.top = `${touch.clientY - 30}px`;
        }
    });
    
    window.addEventListener('touchend', (e) => {
        if (isDraggingFromLibrary && touchDragGhost) {
            isDraggingFromLibrary = false;

            const touch = e.changedTouches[0];
            const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (dropTarget && dropTarget.id === 'editor-canvas') {
                const rect = dropTarget.getBoundingClientRect();
                const pos = {
                    x: touch.clientX - rect.left,
                    y: touch.clientY - rect.top,
                };
                
                 const newAsset = {
                    ...dragData,
                    id: `asset_${Date.now()}`,
                    x: pos.x - 50, // center on cursor
                    y: pos.y - 50,
                    width: 100,
                    height: 100,
                    name: `${dragData.type} - ${dragData.prompt.substring(0, 15)}...`
                };
                addAssetToScene(newAsset);
                redrawCanvas();
            }

            document.body.removeChild(touchDragGhost);
            touchDragGhost = null;
            dragData = null;
        }
    });

    // Autosave interval
    setInterval(() => {
        if (isStateDirty()) {
            saveStateToLocalStorage();
        }
    }, 5000); // Autosave every 5 seconds

    // Unsaved changes check
    setInterval(() => {
        if(isStateDirty()) {
            saveBtn.classList.add('dirty');
        } else {
            saveBtn.classList.remove('dirty');
        }
    }, 1000);

    window.addEventListener('beforeunload', (e) => {
        if (isStateDirty()) {
            e.preventDefault();
            e.returnValue = ''; // For Chrome
            return 'You have unsaved changes. Are you sure you want to leave?'; // For older browsers
        }
    });

    // Mobile Panel Toggles
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const mobileToggleLeft = document.getElementById('mobile-toggle-left');
    const mobileToggleRight = document.getElementById('mobile-toggle-right');
    const toggleLeftPanelBtn = document.getElementById('toggle-left-panel');
    const toggleRightPanelBtn = document.getElementById('toggle-right-panel');

    const togglePanel = (panel) => {
        const isVisible = panel.classList.contains('visible');
        document.querySelectorAll('#left-panel, #right-panel').forEach(p => p.classList.remove('visible'));
        if (!isVisible) {
            panel.classList.add('visible');
        }
    };
    
    mobileToggleLeft.addEventListener('click', () => togglePanel(leftPanel));
    mobileToggleRight.addEventListener('click', () => togglePanel(rightPanel));
    toggleLeftPanelBtn.addEventListener('click', () => leftPanel.classList.remove('visible'));
    toggleRightPanelBtn.addEventListener('click', () => rightPanel.classList.remove('visible'));
});

export { lastGeneratedAsset };