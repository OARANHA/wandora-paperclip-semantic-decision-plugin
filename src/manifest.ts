import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_MODEL,
  EXPORT_NAMES,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
} from "./constants.js";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Wandora Semantic Decision",
  description: "Advisory, bounded semantic decisions for Paperclip digital workforces using TypeSafe/Jev.",
  author: "OARANHA / Wandora",
  categories: ["connector"],
  capabilities: [
    "issues.read",
    "agents.read",
    "plugin.state.read",
    "plugin.state.write",
    "http.outbound",
    "secrets.read-ref",
    "activity.log.write",
    "ui.action.register",
    "ui.detailTab.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      apiKeyRef: {
        type: ["string", "object"],
        format: "secret-ref",
        title: "TypeSafe API Key",
        description: "Company-scoped secret used only by the plugin worker to call the official TypeSafe API.",
      },
      model: {
        type: "string",
        title: "Model",
        default: DEFAULT_MODEL,
        description: "Jev model name or pinned version.",
      },
    },
    required: ["apiKeyRef"],
  },
  ui: {
    slots: [
      {
        type: "toolbarButton",
        id: SLOT_IDS.toolbarButton,
        displayName: "Analyze work",
        exportName: EXPORT_NAMES.toolbarButton,
        entityTypes: ["issue"],
      },
      {
        type: "taskDetailView",
        id: SLOT_IDS.taskDetailView,
        displayName: "Semantic decision",
        exportName: EXPORT_NAMES.taskDetailView,
        entityTypes: ["issue"],
      },
    ],
  },
};

export default manifest;
