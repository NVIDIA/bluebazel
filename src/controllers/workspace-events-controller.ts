////////////////////////////////////////////////////////////////////////////////////
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
////////////////////////////////////////////////////////////////////////////////////
import { registerCustomButtons } from './commands/user-commands';
import { UserCommandsController } from './user-commands-controller';
import { ConfigurationManager } from '../services/configuration-manager';
import { ExtensionUtils } from '../services/extension-utils';
import { BazelTargetTreeProvider } from '../ui/bazel-target-tree-provider';
import * as vscode from 'vscode';

export class WorkspaceEventsController {
    constructor(private context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager,
        private readonly userCommandsController: UserCommandsController,
        private readonly bazelTree: BazelTargetTreeProvider) {
        this.registerConfigurationChangeHandler();
    }

    private registerConfigurationChangeHandler() {
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(ExtensionUtils.getExtensionName(this.context))) {
                registerCustomButtons(this.context, this.configurationManager, this.userCommandsController);
                this.bazelTree.refresh();
            }
        });
    }
}