"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.deactivate = exports.activate = void 0;
var vscode = require("vscode");
var child_process_1 = require("child_process");
var path = require("path");
var diagnosticCollection;
var checkTimer;
var evaluationDecorations;
var outputChannel;
function activate(context) {
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
    var checkCommand = vscode.commands.registerCommand('aya.check', function () {
        checkAyaSyntax();
    });
    // Register run command
    var runCommand = vscode.commands.registerCommand('aya.run', function () {
        runAyaScript();
    });
    // Register evaluate line command
    var evaluateLineCommand = vscode.commands.registerCommand('aya.evaluateLine', function () {
        evaluateCurrentLine();
    });
    // Register keybinding for shift+enter (mapped to evaluateLineKeybinding)
    var keybindingCommand = vscode.commands.registerCommand('aya.evaluateLineKeybinding', function () {
        evaluateCurrentLine();
    });
    // Register evaluate file command
    var evaluateFileCommand = vscode.commands.registerCommand('aya.evaluateFile', function () {
        evaluateEntireFile();
    });
    // Register keybinding for ctrl+shift+enter (mapped to evaluateFileKeybinding)
    var evaluateFileKeybindingCommand = vscode.commands.registerCommand('aya.evaluateFileKeybinding', function () {
        evaluateEntireFile();
    });
    // Register document change listener for automatic linting
    var changeListener = vscode.workspace.onDidChangeTextDocument(function (event) {
        if (event.document.languageId === 'aya') {
            scheduleCheck(event.document);
            // Clear evaluation decorations when document changes
            clearEvaluationDecorations();
        }
    });
    // Register document open listener
    var openListener = vscode.workspace.onDidOpenTextDocument(function (document) {
        if (document.languageId === 'aya') {
            scheduleCheck(document);
        }
    });
    // Register active editor change listener to clear decorations
    var editorChangeListener = vscode.window.onDidChangeActiveTextEditor(function () {
        clearEvaluationDecorations();
    });
    context.subscriptions.push(checkCommand, runCommand, evaluateLineCommand, keybindingCommand, evaluateFileCommand, evaluateFileKeybindingCommand, changeListener, openListener, editorChangeListener);
}
exports.activate = activate;
function getAyaJarPath() {
    var config = vscode.workspace.getConfiguration('aya');
    var jarPath = config.get('jarPath', '');
    if (!jarPath) {
        vscode.window.showErrorMessage('Please configure the path to aya.jar in settings (aya.jarPath)');
        return '';
    }
    return jarPath;
}
function runAyaScript() {
    var editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        vscode.window.showErrorMessage('No Aya file is currently active');
        return;
    }
    var jarPath = getAyaJarPath();
    if (!jarPath)
        return;
    var document = editor.document;
    // Save the file if it has unsaved changes
    if (document.isDirty) {
        document.save();
    }
    var filePath = document.fileName;
    var terminal = vscode.window.createTerminal('Aya Script');
    terminal.sendText("java -jar \"".concat(jarPath, "\" . \"").concat(filePath, "\""));
    terminal.show();
}
function evaluateCurrentLine() {
    var editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        return;
    }
    var jarPath = getAyaJarPath();
    if (!jarPath)
        return;
    var document = editor.document;
    var position = editor.selection.active;
    var lineNumber = position.line;
    var lineText = document.lineAt(lineNumber).text.trim();
    if (!lineText) {
        return; // Don't evaluate empty lines
    }
    // Clear previous decorations
    clearEvaluationDecorations();
    // Show evaluation in progress
    var lineLength = document.lineAt(lineNumber).text.length;
    var progressDecoration = {
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
    var command = "java -jar \"".concat(jarPath, "\" . -e '").concat(lineText.replace("'", "\\'"), "'");
    (0, child_process_1.exec)(command, function (error, stdout, stderr) {
        // Clear progress decoration
        clearEvaluationDecorations();
        var resultText = '';
        var hasMultipleLines = false;
        var fullOutput = '';
        if (error) {
            // Check if there's useful error info in stdout or stderr
            var errorOutput = stdout || stderr || error.message;
            var errorLines = errorOutput.trim().split('\n');
            fullOutput = errorOutput.trim();
            hasMultipleLines = errorLines.length > 1;
            resultText = " .# Error: ".concat(errorLines[0].trim());
        }
        else {
            // Process stdout result
            var outputLines = stdout.trim().split('\n');
            fullOutput = stdout.trim();
            hasMultipleLines = outputLines.length > 1;
            if (hasMultipleLines) {
                resultText = " .# => ".concat(outputLines[0], " [+").concat(outputLines.length - 1, " more lines - see Aya Evaluation panel]");
            }
            else {
                resultText = " .# => ".concat(outputLines[0]);
            }
        }
        // If there are multiple lines, show full output in output channel
        if (hasMultipleLines) {
            outputChannel.clear();
            outputChannel.appendLine("Evaluation of line ".concat(lineNumber + 1, ": ").concat(lineText));
            outputChannel.appendLine(''.repeat(50));
            outputChannel.appendLine(fullOutput);
            outputChannel.appendLine(''.repeat(50));
            // Show the output channel
            outputChannel.show(true); // true = preserve focus on editor
        }
        // Create decoration for the result with appropriate color
        var decorationColor;
        if (error) {
            decorationColor = '#ff6b6b'; // Red for errors
        }
        else if (hasMultipleLines) {
            decorationColor = '#f39c12'; // Orange/yellow for multiline results
        }
        else {
            decorationColor = '#4ecdc4'; // Teal/cyan for single line results
        }
        var resultDecoration = {
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
        setTimeout(function () {
            clearEvaluationDecorations();
        }, 5000);
    });
}
function evaluateEntireFile() {
    var _this = this;
    var editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        vscode.window.showErrorMessage('No Aya file is currently active');
        return;
    }
    var jarPath = getAyaJarPath();
    if (!jarPath)
        return;
    var document = editor.document;
    // Save the file if it has unsaved changes
    if (document.isDirty) {
        document.save();
    }
    var filePath = document.fileName;
    var fileName = path.basename(filePath);
    // Clear and show output channel
    outputChannel.clear();
    outputChannel.appendLine("Evaluating file: ".concat(fileName));
    outputChannel.appendLine(''.repeat(60));
    outputChannel.show(true); // preserve focus on editor
    // Show progress in status bar
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Window,
        title: "Evaluating Aya file...",
        cancellable: false
    }, function (progress) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) {
                    var command = "java -jar \"".concat(jarPath, "\" . \"").concat(filePath, "\"");
                    (0, child_process_1.exec)(command, function (error, stdout, stderr) {
                        if (error) {
                            var errorOutput = stdout || stderr || error.message;
                            outputChannel.appendLine("Error executing file:");
                            outputChannel.appendLine(errorOutput.trim());
                            // Show error notification
                            vscode.window.showErrorMessage("Aya file evaluation failed: ".concat(errorOutput.split('\n')[0].trim()));
                        }
                        else {
                            outputChannel.appendLine("Output:");
                            outputChannel.appendLine(stdout.trim() || '(no output)');
                        }
                        outputChannel.appendLine(''.repeat(60));
                        resolve();
                    });
                })];
        });
    }); });
}
function clearEvaluationDecorations() {
    var editor = vscode.window.activeTextEditor;
    if (editor) {
        editor.setDecorations(evaluationDecorations, []);
    }
}
function checkAyaSyntax() {
    var editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'aya') {
        return;
    }
    var jarPath = getAyaJarPath();
    if (!jarPath)
        return;
    var document = editor.document;
    checkDocumentSyntax(document, jarPath);
}
function scheduleCheck(document) {
    var config = vscode.workspace.getConfiguration('aya');
    var enableLinting = config.get('enableLinting', true);
    if (!enableLinting)
        return;
    var jarPath = getAyaJarPath();
    if (!jarPath)
        return;
    // Clear previous timer
    if (checkTimer) {
        clearTimeout(checkTimer);
    }
    // Schedule new check after 1 second of inactivity
    checkTimer = setTimeout(function () {
        checkDocumentSyntax(document, jarPath);
    }, 1000);
}
function checkDocumentSyntax(document, jarPath) {
    if (document.isDirty) {
        document.save().then(function () {
            performSyntaxCheck(document, jarPath);
        });
    }
    else {
        performSyntaxCheck(document, jarPath);
    }
}
function performSyntaxCheck(document, jarPath) {
    var filePath = document.fileName;
    var command = "java -jar \"".concat(jarPath, "\" . -c \"").concat(filePath, "\"");
    (0, child_process_1.exec)(command, function (error, stdout, stderr) {
        var diagnostics = [];
        if (error && stdout) {
            // Parse error output: filename:lineNumber:columnNumber : errorMessage
            var lines = stdout.split('\n');
            for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
                var line = lines_1[_i];
                if (line.trim()) {
                    var match = line.match(/^.*:(\d+):(\d+)\s*:\s*(.+)$/);
                    if (match) {
                        var lineNumber = parseInt(match[1]) - 1; // VS Code uses 0-based line numbers
                        var columnNumber = parseInt(match[2]) - 1; // VS Code uses 0-based column numbers
                        var errorMessage = match[3].trim();
                        // Create range starting from the error column to end of line
                        var range = new vscode.Range(lineNumber, columnNumber, lineNumber, Number.MAX_VALUE);
                        var diagnostic = new vscode.Diagnostic(range, errorMessage, vscode.DiagnosticSeverity.Error);
                        diagnostics.push(diagnostic);
                    }
                }
            }
        }
        diagnosticCollection.set(document.uri, diagnostics);
    });
}
function deactivate() {
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
exports.deactivate = deactivate;
