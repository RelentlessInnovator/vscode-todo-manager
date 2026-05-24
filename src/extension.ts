import * as vscode from "vscode";
import * as path from "path";
import { processTodoFile } from "./processor";

let outputChannel: vscode.OutputChannel;

// Guard prevents the write-back save from re-triggering processing.
let isProcessing = false;

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel("Todo Manager");
  outputChannel.appendLine("Todo Manager is active.");

  const disposable = vscode.workspace.onDidSaveTextDocument(async (doc: vscode.TextDocument) => {
    // Skip saves that we ourselves triggered via doc.save() below.
    if (isProcessing) { return; }

    const config = vscode.workspace.getConfiguration("todoManager");
    const enabled: boolean = config.get("enabled", true);
    if (!enabled) { return; }

    const filePath: string = config.get("filePath", "");
    if (!filePath) {
      outputChannel.appendLine("[warn] todoManager.filePath is not set.");
      return;
    }

    const normalizedSaved = path.normalize(doc.fileName);
    const normalizedTarget = path.normalize(filePath);
    if (normalizedSaved.toLowerCase() !== normalizedTarget.toLowerCase()) { return; }

    outputChannel.appendLine(`[save] Triggered on ${doc.fileName}`);

    // processTodoFile reads the file from disk, runs all processing steps,
    // updates todo-meta.json, and returns the new content as a string.
    const output = processTodoFile(filePath, outputChannel);
    if (output === null) { return; }

    // Apply the new content through VS Code's own edit API so we never
    // touch the file directly while VS Code still holds it open.
    isProcessing = true;
    try {
      const fullRange = new vscode.Range(
        doc.positionAt(0),
        doc.positionAt(doc.getText().length)
      );
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
    } catch (e) {
      outputChannel.appendLine(`[error] Write-back failed: ${e}`);
    } finally {
      isProcessing = false;
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(outputChannel);
}

export function deactivate(): void {
  // nothing to clean up
}
