"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const processor_1 = require("./processor");
let outputChannel;
// Guard prevents the write-back save from re-triggering processing.
let isProcessing = false;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel("Todo Manager");
    outputChannel.appendLine("Todo Manager is active.");
    const disposable = vscode.workspace.onDidSaveTextDocument(async (doc) => {
        // Skip saves that we ourselves triggered via doc.save() below.
        if (isProcessing) {
            return;
        }
        const config = vscode.workspace.getConfiguration("todoManager");
        const enabled = config.get("enabled", true);
        if (!enabled) {
            return;
        }
        const filePath = config.get("filePath", "");
        if (!filePath) {
            outputChannel.appendLine("[warn] todoManager.filePath is not set.");
            return;
        }
        const normalizedSaved = path.normalize(doc.fileName);
        const normalizedTarget = path.normalize(filePath);
        if (normalizedSaved.toLowerCase() !== normalizedTarget.toLowerCase()) {
            return;
        }
        outputChannel.appendLine(`[save] Triggered on ${doc.fileName}`);
        // processTodoFile reads the file from disk, runs all processing steps,
        // updates todo-meta.json, and returns the new content as a string.
        const output = (0, processor_1.processTodoFile)(filePath, outputChannel);
        if (output === null) {
            return;
        }
        // Apply the new content through VS Code's own edit API so we never
        // touch the file directly while VS Code still holds it open.
        isProcessing = true;
        try {
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, fullRange, output);
            const applied = await vscode.workspace.applyEdit(edit);
            if (!applied) {
                outputChannel.appendLine("[error] applyEdit returned false — document may be read-only.");
                return;
            }
            // Persist to disk (this triggers onDidSaveTextDocument again, but
            // isProcessing is still true so we skip it).
            await doc.save();
            outputChannel.appendLine("[info] Write-back complete.");
        }
        catch (e) {
            outputChannel.appendLine(`[error] Write-back failed: ${e}`);
        }
        finally {
            isProcessing = false;
        }
    });
    context.subscriptions.push(disposable);
    context.subscriptions.push(outputChannel);
}
function deactivate() {
    // nothing to clean up
}
//# sourceMappingURL=extension.js.map