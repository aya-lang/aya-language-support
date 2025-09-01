import * as vscode from 'vscode';
import { exec } from 'child_process';
import * as path from 'path';

let diagnosticCollection: vscode.DiagnosticCollection;
let checkTimer: NodeJS.Timer | undefined;
let evaluationDecorations: vscode.TextEditorDecorationType;
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    console.log('Aya extension is now active!');

    // Create diagnostic collection for syntax errors
    diagnosticCollection = vscode.languages.createDiagnosticCollection('aya');
    context.subscriptions.push(diagnosticCollection);

    // Create output channel for multiline results
    outputChannel = vscode.window.createOutputChannel('Aya Evaluation');
    context.subscriptions.push(outputChannel);

    // Create decoration type for evaluation results
    evaluationDecorations = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            color: '#999999',
            fontStyle: 'italic'
        }
    });
    context.subscriptions.push(evaluationDecorations);

    // Register check command
    const checkCommand = vscode.commands.registerCommand('aya.check', () => {
        checkAyaSyntax();
    });

    // Register run command
    const runCommand = vscode.commands.registerCommand('aya.run', () => {
        runAyaScript();
    });

    // Register evaluate line command
    const evaluateLineCommand = vscode.commands.registerCommand('aya.evaluateLine', () => {
        evaluateCurrentLine();
    });

    // Register keybinding for shift+enter (mapped to evaluateLineKeybinding)
    const keybindingCommand = vscode.commands.registerCommand('aya.evaluateLineKeybinding', () => {
        evaluateCurrentLine();
    });

    // Register evaluate file command
    const evaluateFileCommand = vscode.commands.registerCommand('aya.evaluateFile', () => {
        evaluateEntireFile();
    });

    // Register keybinding for ctrl+shift+enter (mapped to evaluateFileKeybinding)
    const evaluateFileKeybindingCommand = vscode.commands.registerCommand('aya.evaluateFileKeybinding', () => {
        evaluateEntireFile();
    });

    // Register document change listener for automatic linting
    const changeListener = vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document.languageId === 'aya') {
            scheduleCheck(event.document);
            // Clear evaluation decorations when document changes
            clearEvaluationDecorations();
        }
    });

    // Register document open listener
    const openListener = vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'aya') {
            scheduleCheck(document);
        }
    });

    // Register active editor change listener to clear decorations
    const editorChangeListener = vscode.window.onDidChangeActiveTextEditor(() => {
        clearEvaluationDecorations();
    });

    context.subscriptions.push(
        checkCommand, 
        runCommand, 
        evaluateLineCommand,
        keybindingCommand,
        evaluateFileCommand,
        evaluateFileKeybindingCommand,
        changeListener, 
        openListener,
        editorChangeListener
    );
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

function evaluateCurrentLine() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        return;
    }

    const jarPath = getAyaJarPath();
    if (!jarPath) return;

    const document = editor.document;
    const position = editor.selection.active;
    const lineNumber = position.line;
    const lineText = document.lineAt(lineNumber).text.trim();

    if (!lineText) {
        return; // Don't evaluate empty lines
    }

    // Clear previous decorations
    clearEvaluationDecorations();

    // Show evaluation in progress
    const lineLength = document.lineAt(lineNumber).text.length;
    const progressDecoration: vscode.DecorationOptions = {
        range: new vscode.Range(lineNumber, lineLength, lineNumber, lineLength),
        renderOptions: {
            after: {
                contentText: ' .# ...',
                color: '#888888'
            }
        }
    };
    editor.setDecorations(evaluationDecorations, [progressDecoration]);

    // Execute the line using aya -e
    const command = `java -jar "${jarPath}" . -e '${lineText.replace("'", "\\'")}'`;
    
    exec(command, (error, stdout, stderr) => {
        // Clear progress decoration
        clearEvaluationDecorations();

        let resultText = '';
        let hasMultipleLines = false;
        let fullOutput = '';

        if (error) {
            // Check if there's useful error info in stdout or stderr
            const errorOutput = stdout || stderr || error.message;
            const errorLines = errorOutput.trim().split('\n');
            fullOutput = errorOutput.trim();
            hasMultipleLines = errorLines.length > 1;
            resultText = ` .# Error: ${errorLines[0].trim()}`;
        } else {
            // Process stdout result
            const outputLines = stdout.trim().split('\n');
            fullOutput = stdout.trim();
            hasMultipleLines = outputLines.length > 1;
            
            if (hasMultipleLines) {
                resultText = ` .# => ${outputLines[0]} [+${outputLines.length - 1} more lines - see Aya Evaluation panel]`;
            } else {
                resultText = ` .# => ${outputLines[0]}`;
            }
        }

        // If there are multiple lines, show full output in output channel
        if (hasMultipleLines) {
            outputChannel.clear();
            outputChannel.appendLine(`Evaluation of line ${lineNumber + 1}: ${lineText}`);
            outputChannel.appendLine(''.repeat(50));
            outputChannel.appendLine(fullOutput);
            outputChannel.appendLine(''.repeat(50));
            
            // Show the output channel
            outputChannel.show(true); // true = preserve focus on editor
        }

        // Create decoration for the result with appropriate color
        let decorationColor: string;
        if (error) {
            decorationColor = '#ff6b6b'; // Red for errors
        } else if (hasMultipleLines) {
            decorationColor = '#f39c12'; // Orange/yellow for multiline results
        } else {
            decorationColor = '#4ecdc4'; // Teal/cyan for single line results
        }

        const resultDecoration: vscode.DecorationOptions = {
            range: new vscode.Range(lineNumber, lineLength, lineNumber, lineLength),
            renderOptions: {
                after: {
                    contentText: resultText,
                    color: decorationColor,
                    fontStyle: 'italic'
                }
            }
        };

        editor.setDecorations(evaluationDecorations, [resultDecoration]);

        // Auto-clear decoration after 5 seconds
        setTimeout(() => {
            clearEvaluationDecorations();
        }, 5000);
    });
}

function evaluateEntireFile() {
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
    const fileName = path.basename(filePath);
    
    // Clear and show output channel
    outputChannel.clear();
    outputChannel.appendLine(`Evaluating file: ${fileName}`);
    outputChannel.appendLine(''.repeat(60));
    outputChannel.show(true); // preserve focus on editor

    // Show progress in status bar
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Evaluating Aya file...",
        cancellable: false
    }, async (progress) => {
        return new Promise<void>((resolve) => {
            const command = `java -jar "${jarPath}" . "${filePath}"`;
            
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    const errorOutput = stdout || stderr || error.message;
                    outputChannel.appendLine(`Error executing file:`);
                    outputChannel.appendLine(errorOutput.trim());
                    
                    // Show error notification
                    vscode.window.showErrorMessage(`Aya file evaluation failed: ${errorOutput.split('\n')[0].trim()}`);
                } else {
                    outputChannel.appendLine(`Output:`);
                    outputChannel.appendLine(stdout.trim() || '(no output)');
                }
                
                outputChannel.appendLine(''.repeat(60));
                resolve();
            });
        });
    });
}

function clearEvaluationDecorations() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(evaluationDecorations, []);
    }
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
    if (evaluationDecorations) {
        evaluationDecorations.dispose();
    }
    if (outputChannel) {
        outputChannel.dispose();
    }
}