
import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;
let checkTimer: NodeJS.Timer | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Aya extension is now active!');

    // Create diagnostic collection for syntax errors
    diagnosticCollection = vscode.languages.createDiagnosticCollection('aya');
    context.subscriptions.push(diagnosticCollection);

    // Register check command
    const checkCommand = vscode.commands.registerCommand('aya.check', () => {
        checkAyaSyntax();
    });

    // Register check command
    const runCommand = vscode.commands.registerCommand('aya.run', () => {
        runAyaScript();
    });

    // Register document change listener for automatic linting
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'aya') {
            scheduleCheck(event.document);
        }
    });

    // Register document open listener
    const openListener = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'aya') {
            scheduleCheck(document);
        }
    });

    context.subscriptions.push(checkCommand, changeListener, openListener);
context.subscriptions.push(runCommand);
}

function getAyaJarPath(): string {
    const config = vscode.workspace.getConfiguration('aya');
    const jarPath = config.get<string>('jarPath', '');
    
    if (!jarPath) {
        vscode.window.showErrorMessage('Please configure the path to aya.jar in settings (aya.jarPath)');
        return '';
    }
    
    return jarPath;
}

function runAyaScript() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        vscode.window.showErrorMessage('No Aya file is currently active');
        return;
    }

    const jarPath = getAyaJarPath();
    if (!jarPath) return;

    const document = editor.document;
    
    // Save the file if it has unsaved changes
    if (document.isDirty) {
        document.save();
    }

    const filePath = document.fileName;
    const terminal = vscode.window.createTerminal('Aya Script');
    
    terminal.sendText(`java -jar "${jarPath}" . "${filePath}"`);
    terminal.show();
}

function checkAyaSyntax() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        return;
    }

    const jarPath = getAyaJarPath();
    if (!jarPath) return;

    const document = editor.document;
    checkDocumentSyntax(document, jarPath);
}

function scheduleCheck(document: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration('aya');
    const enableLinting = config.get<boolean>('enableLinting', true);
    
    if (!enableLinting) return;

    const jarPath = getAyaJarPath();
    if (!jarPath) return;

    // Clear previous timer
    if (checkTimer) {
        clearTimeout(checkTimer);
    }

    // Schedule new check after 1 second of inactivity
    checkTimer = setTimeout(() => {
        checkDocumentSyntax(document, jarPath);
    }, 1000);
}

function checkDocumentSyntax(document: vscode.TextDocument, jarPath: string) {
    if (document.isDirty) {
        document.save().then(() => {
            performSyntaxCheck(document, jarPath);
        });
    } else {
        performSyntaxCheck(document, jarPath);
    }
}


function performSyntaxCheck(document: vscode.TextDocument, jarPath: string) {
   const filePath = document.fileName;
   const command = `java -jar "${jarPath}" . -c "${filePath}"`;

   exec(command, (error, stdout, stderr) => {
       const diagnostics: vscode.Diagnostic[] = [];

       if (error && stdout) {
           // Parse error output: filename:lineNumber:columnNumber : errorMessage
           const lines = stdout.split('\n');
           for (const line of lines) {
               if (line.trim()) {
                   const match = line.match(/^.*:(\d+):(\d+)\s*:\s*(.+)$/);
                   if (match) {
                       const lineNumber = parseInt(match[1]) - 1; // VS Code uses 0-based line numbers
                       const columnNumber = parseInt(match[2]) - 1; // VS Code uses 0-based column numbers
                       const errorMessage = match[3].trim();
                       
                       // Create range starting from the error column to end of line
                       const range = new vscode.Range(
                           lineNumber, 
                           columnNumber, 
                           lineNumber, 
                           Number.MAX_VALUE
                       );
                       
                       const diagnostic = new vscode.Diagnostic(
                           range,
                           errorMessage,
                           vscode.DiagnosticSeverity.Error
                       );
                       diagnostics.push(diagnostic);
                   }
               }
           }
       }

       diagnosticCollection.set(document.uri, diagnostics);
   });
}


export function deactivate() {
    if (checkTimer) {
        clearTimeout(checkTimer);
    }
}