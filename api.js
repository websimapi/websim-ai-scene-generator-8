export async function generateImage(prompt, transparent = false, aspect_ratio = "1:1") {
    console.log(`Generating image with prompt: "${prompt}"`);
    try {
        const result = await websim.imageGen({
            prompt: prompt,
            transparent: transparent,
            aspect_ratio: aspect_ratio
        });
        if (!result || !result.url) {
            throw new Error("Image generation failed, no URL returned.");
        }
        return result;
    } catch (error) {
        console.error("Error in generateImage:", error);
        throw error;
    }
}

