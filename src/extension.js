"use strict";
exports.__esModule = true;
exports.deactivate = exports.activate = void 0;
var vscode = require("vscode");
var child_process_1 = require("child_process");
var diagnosticCollection;
var checkTimer;
function activate(context) {
    console.log('Aya extension is now active!');
    // Create diagnostic collection for syntax errors
    diagnosticCollection = vscode.languages.createDiagnosticCollection('aya');
    context.subscriptions.push(diagnosticCollection);
    // Register check command
    var checkCommand = vscode.commands.registerCommand('aya.check', function () {
        checkAyaSyntax();
    });
    // Register check command
    var runCommand = vscode.commands.registerCommand('aya.run', function () {
        runAyaScript();
    });
    // Register document change listener for automatic linting
    var changeListener = vscode.workspace.onDidChangeTextDocument(function (event) {
        if (event.document.languageId === 'aya') {
            scheduleCheck(event.document);
        }
    });
    // Register document open listener
    var openListener = vscode.workspace.onDidOpenTextDocument(function (document) {
        if (document.languageId === 'aya') {
            scheduleCheck(document);
        }
    });
    context.subscriptions.push(checkCommand, changeListener, openListener);
    context.subscriptions.push(runCommand);
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
}
exports.deactivate = deactivate;
