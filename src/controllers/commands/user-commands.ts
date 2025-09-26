////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2021-2025 NVIDIA Corporation
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
////////////////////////////////////////////////////////////////////////////////////

import { ConfigurationManager, UserCustomButton } from '../../services/configuration-manager';
import { Console } from '../../services/console';
import { ExtensionUtils } from '../../services/extension-utils';
import { UserCommandsController } from '../user-commands-controller';
import * as vscode from 'vscode';

export function registerCustomButtons(context: vscode.ExtensionContext,
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
                try {
                    const disposableCommand = vscode.commands.registerCommand(button.methodName, async (commandOrButton: string | UserCustomButton) => {
                        // Support both string (backward compatibility) and button object
                        if (typeof commandOrButton === 'string') {
                            await userCommandsController.runCustomTask(commandOrButton);
                        } else {
                            await userCommandsController.runCustomTask(commandOrButton.command, commandOrButton.problemMatcher);
                        }
                    });
                    context.subscriptions.push(disposableCommand);
                } catch (error) {
                    Console.error(error);
                }
            });
        }
    });
}

export function registerUserCommands(context: vscode.ExtensionContext,
    configurationManager: ConfigurationManager,
    userCommandsController: UserCommandsController
): void {
    registerCustomButtons(context, configurationManager, userCommandsController);

    const extensionName = ExtensionUtils.getExtensionName(context);
    context.subscriptions.push(vscode.commands.registerCommand(`${extensionName}.customButton`, (button: UserCustomButton) => {
        const registeredCommand = button.methodName;
        vscode.commands.executeCommand(registeredCommand, button);
    }));

}