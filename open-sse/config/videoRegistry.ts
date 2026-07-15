/**
 * Video Generation Provider Registry
 *
 * Defines providers that support the /v1/videos/generations endpoint.
 * Supports local providers plus hosted task-based APIs such as Runway.
 */

import { parseModelFromRegistry, getAllModelsFromRegistry } from "./registryUtils.ts";
import { RUNWAYML_SUPPORTED_VIDEO_MODELS } from "./runway.ts";

interface VideoModel {
  id: string;
  name: string;
}

interface VideoProvider {
  id: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  format: string;
  models: VideoModel[];
}

export const VIDEO_PROVIDERS: Record<string, VideoProvider> = {
  comfyui: {
    id: "comfyui",
    baseUrl: "http://localhost:8188",
    authType: "none",
    authHeader: "none",
    format: "comfyui",
    models: [
      { id: "animatediff", name: "AnimateDiff" },
      { id: "svd-xt", name: "Stable Video Diffusion XT" },
    ],
  },

  sdwebui: {
    id: "sdwebui",
    baseUrl: "http://localhost:7860",
    authType: "none",
    authHeader: "none",
    format: "sdwebui-video",
    models: [{ id: "animatediff-webui", name: "AnimateDiff (WebUI)" }],
  },

  runwayml: {
    id: "runwayml",
    baseUrl: "https://api.dev.runwayml.com/v1",
    authType: "bearer",
    authHeader: "Authorization",
    format: "runwayml",
    models: RUNWAYML_SUPPORTED_VIDEO_MODELS,
  },

  alibaba: {
    id: "alibaba",
    alias: "ali",
    // DashScope (Alibaba Cloud Model Studio) async video-synthesis API. Reuses
    // the stored alibaba provider Bearer apiKey — no separate credential flow.
    baseUrl: "https://dashscope-intl.aliyuncs.com/api/v1",
    statusUrl: "https://dashscope-intl.aliyuncs.com/api/v1/tasks",
    authType: "apikey",
    authHeader: "bearer",
    format: "dashscope-video",
    models: [{ id: "wan2.7-t2v", name: "Wan 2.7 T2V" }],
  },
};

/**
 * Get video provider config by ID
 */
export function getVideoProvider(providerId: string): VideoProvider | null {
  return VIDEO_PROVIDERS[providerId] || null;
}

/**
 * Parse video model string (format: "provider/model" or just "model")
 */
export function parseVideoModel(modelStr: string | null) {
  return parseModelFromRegistry(modelStr, VIDEO_PROVIDERS);
}

/**
 * Get all video models as a flat list
 */
export function getAllVideoModels() {
  return getAllModelsFromRegistry(VIDEO_PROVIDERS);
}
