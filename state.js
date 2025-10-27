export const sceneState = {
    background: null,
    assets: [], // { id, type, prompt, url, x, y, width, height, name }
};

let isDirty = false;

export function markAsDirty() {
    isDirty = true;
}

export function isStateDirty() {
    return isDirty;
}

export function clearDirtyFlag() {
    isDirty = false;
}

export function addAssetToScene(assetData) {
    sceneState.assets.push(assetData);
    markAsDirty();
}

export function getAssetById(id) {
    return sceneState.assets.find(a => a.id === id);
}

export function updateAsset(id, updates) {
    const asset = getAssetById(id);
    if (asset) {
        Object.assign(asset, updates);
        markAsDirty();
    }
}

export function removeAsset(id) {
    const initialLength = sceneState.assets.length;
    sceneState.assets = sceneState.assets.filter(a => a.id !== id);
    if (sceneState.assets.length < initialLength) {
        markAsDirty();
    }
}

