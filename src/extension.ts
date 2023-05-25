/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2023 NVIDIA Corporation
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
/////////////////////////////////////////////////////////////////////////////////////////
import * as vscode from 'vscode';
import { BazelController } from './controller';
import { BazelTreeDataProvider } from './treeView';
import { ConfigurationManager } from './configurationManager';
import { registerBuildCommands } from './buildCommands';
import { registerRunCommands } from './runCommands';
import { registerTestCommands } from './testCommands';
import * as common from './common';
import { BazelModel } from './model';

let bazelTree: BazelTreeDataProvider;
let bazelModel: BazelModel;
let bazelController: BazelController;
let extensionConfiguration = new ConfigurationManager();

export function activate(context: vscode.ExtensionContext) {

    extensionConfiguration = new ConfigurationManager();

    bazelModel = new BazelModel(context.workspaceState);

    bazelController = new BazelController(context,
        extensionConfiguration,
        bazelModel);

    bazelTree = new BazelTreeDataProvider(
        context,
        extensionConfiguration,
        bazelModel,
        bazelController
    );

    vscode.commands.registerCommand('bluebazel.collapseAll', () => {
        vscode.commands.executeCommand('workbench.actions.treeView.bluebazelView.collapseAll');
    });

    registerBuildCommands(context,
        bazelController,
        bazelModel,
        bazelTree);

    registerRunCommands(context,
        bazelController,
        bazelModel,
        bazelTree);

    registerTestCommands(context,
        bazelController,
        bazelModel,
        bazelTree);


    context.subscriptions.push(vscode.commands.registerCommand('bluebazel.customButton', (node: vscode.TreeItem) => {
        const command = node.command?.command;
        const args = node.command?.arguments;
        if (command && args) {
            vscode.commands.executeCommand(command, ...args);
        } else if (command) {
            vscode.commands.executeCommand(command);
        }
    }));

    vscode.window.registerTreeDataProvider('bluebazelView', bazelTree);

    vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('bluebazel')) {
            bazelTree.refresh();

            const action = 'Reload';

            vscode.window
                .showInformationMessage(
                    'Reload window in order for changes in bazel extension configuration to take effect.',
                    action
                )
                .then(selectedAction => {
                    if (selectedAction === action) {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
        }
    });

    // Register custom commands
    extensionConfiguration.registerCommands(bazelController, context);
}
