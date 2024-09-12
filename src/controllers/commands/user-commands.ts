/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2024 NVIDIA Corporation
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

import { ConfigurationManager } from '../../services/configuration-manager';
import { ExtensionUtils } from '../../services/extension-utils';
import { UserCommandsController } from '../user-commands-controller';
import * as vscode from 'vscode';

export function registerUserCommands(context: vscode.ExtensionContext,
    configurationManager: ConfigurationManager,
    userCommandsController: UserCommandsController
): void {
    // Traverses through the configuration and registers commands with method names.
    const customButtons = configurationManager.getCustomButtons();
    if (customButtons === undefined) {
        return;
    }
    customButtons.forEach(section => {
        const buttons = section.buttons;
        if (buttons !== undefined) {
            buttons.forEach(button => {
                const disposableCommand = vscode.commands.registerCommand(button.methodName, async (command: string) => {
                    await userCommandsController.runCustomTask(button.command);
                });
                context.subscriptions.push(disposableCommand);
            });
        }
    });

    const extensionName = ExtensionUtils.getExtensionName(context);
    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.customButton`, (node: vscode.TreeItem) => {
        const command = node.command?.command;
        const args = node.command?.arguments;
        if (command && args) {
            vscode.commands.executeCommand(command, ...args);
        } else if (command) {
            vscode.commands.executeCommand(command);
        }
    }));

}