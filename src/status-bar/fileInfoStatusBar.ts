import * as vscode from 'vscode';
import { formatLengthFun, formatLengthMetric, formatLengthUS, formatLengthTime } from '../utils/utils';

type FormatMode = 'fun' | 'metric' | 'us' | 'time';

export class FileInfoStatusBar implements vscode.Disposable {
    private statusBarItem: vscode.StatusBarItem;
    private disposables: vscode.Disposable[] = [];
    private formatMode: FormatMode = 'fun'; // Default mode

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right, 
            300
        );

        this.setupStatusBar();
        this.registerEventListeners();
        this.registerCommands();
    }

    private setupStatusBar(): void {
        this.statusBarItem.command = 'howlong.cycleFormat';
        this.statusBarItem.tooltip = "Click to change format";
        this.statusBarItem.show();
        this.updateStatusBar(); // Initial update
    }

    private registerCommands(): void {
        const commandDisposable = vscode.commands.registerCommand('howlong.cycleFormat', () => {
            this.cycleFormatMode();
        });

        const calibrateCommand = vscode.commands.registerCommand('howlong.calibrate', () => {
            this.calibrateLength();
        });

        this.disposables.push(commandDisposable, calibrateCommand);
    }

    private cycleFormatMode(): void {
        switch (this.formatMode) {
            case 'fun':
                this.formatMode = 'metric';
                break;
            case 'metric':
                this.formatMode = 'us';
                break;
            case 'us':
                this.formatMode = 'time';
                break;
            case 'time':
                this.formatMode = 'fun';
                break;
        }
        this.updateStatusBar();
    }

    private async calibrateLength(): Promise<void> {
        const choice = await vscode.window.showInformationMessage(
            "Calibration: Measure how long 100 characters are on your screen.",
            "📋 Copy test text",
            "✏️ Enter size"
        );

        if (choice === "📋 Copy test text") {
            // Provide exactly 100 characters for measurement
            const testText = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(3) + "ABCDEFGHIJKLMNOPQRSTUV"; // 100 chars
            await vscode.env.clipboard.writeText(testText);
            vscode.window.showInformationMessage("100 characters copied to clipboard. Paste into your editor and measure with a ruler.");
            return;
        }

        if (choice === "✏️ Enter size") {
            const input = await vscode.window.showInputBox({
                prompt: "Enter measured length of 100 characters (e.g., '12.5 cm' or '5 in')",
                placeHolder: "e.g., 12.5 cm",
                validateInput: (value) => {
                    const regex = /^(\d+(\.\d+)?)\s*(cm|in)$/i;
                    if (!regex.test(value.trim())) {
                        return "Please enter a number followed by 'cm' or 'in' (e.g., 12.5 cm)";
                    }
                    return null;
                }
            });

            if (!input) return;

            const match = input.trim().match(/^(\d+(\.\d+)?)\s*(cm|in)$/i);
            if (!match) return;

            let length = parseFloat(match[1]);
            const unit = match[3].toLowerCase();

            if (unit === "in") {
                length *= 2.54; // convert inches → cm
            }

            // cm per char
            const actualCmPerChar = length / 100;

            await vscode.workspace.getConfiguration().update(
                'fileLength.cmPerCharacter', 
                actualCmPerChar, 
                vscode.ConfigurationTarget.Workspace
            );

            vscode.window.showInformationMessage(`Calibration saved: ${actualCmPerChar.toFixed(4)} cm/char`);
            this.updateStatusBar();
        }
    }



    private getCmPerCharacter(): number {
        return vscode.workspace.getConfiguration().get('fileLength.cmPerCharacter', 17.78 / 58);
    }

    private registerEventListeners(): void {
        const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(
            () => this.updateStatusBar()
        );

        const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(
            () => this.updateStatusBar()
        );

        this.disposables.push(activeEditorDisposable, documentChangeDisposable);
    }

    private updateStatusBar(): void {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            this.statusBarItem.text = "No file";
            return;
        }

        const fileLength = activeEditor.document.getText().length;
        const cm = this.getCmPerCharacter() * fileLength;
        
        // Format based on current mode
        let formattedText: string;
        switch (this.formatMode) {
            case 'fun':
                formattedText = formatLengthFun(cm);
                break;
            case 'metric':
                formattedText = formatLengthMetric(cm);
                break;
            case 'us':
                formattedText = formatLengthUS(cm * 0.393701); // Convert cm to inches
                break;
            case 'time':
                formattedText = formatLengthTime(cm);
                break;
        }

        this.statusBarItem.text = formattedText;
        this.statusBarItem.tooltip = `File length: ${fileLength} chars (Click to cycle format)`;
    }

    dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}