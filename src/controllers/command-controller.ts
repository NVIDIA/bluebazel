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

import { BazelController } from './bazel-controller';
import { BazelTargetOperationsController } from './bazel-target-operations-controller';
import { registerBazelCommands } from './commands/bazel-commands';
import { registerBazelTargetOperationsCommands } from './commands/bazel-target-operations-commands';
import { registerDebugCommands } from './commands/debug-commands';
import { registerMultiPropTreeItemCommands } from './commands/multi-prop-tree-item-commands';
import { registerSinglePropTreeItemCommands } from './commands/single-prop-tree-item-commands';
import { registerTreeDataProviderCommands } from './commands/tree-data-provider-commands';
import { registerUserCommands } from './commands/user-commands';
import { BazelTargetControllerManager } from './target-controllers/bazel-target-controller-manager';
import { DebugController } from './target-controllers/debug-controller';
import { UserCommandsController } from './user-commands-controller';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { ConfigurationManager } from '../services/configuration-manager';
import { BazelTargetTreeProvider } from '../ui/bazel-target-tree-provider';
import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext,
    configurationManager: ConfigurationManager,
    userCommandsController: UserCommandsController,
    bazelController: BazelController,
    bazelTargetControllerManager: BazelTargetControllerManager,
    bazelTargetOpsController: BazelTargetOperationsController,
    bazelTargetManager: BazelTargetManager,
    bazelTreeDataProvider: BazelTargetTreeProvider
) {
    registerTreeDataProviderCommands(context);
    registerMultiPropTreeItemCommands(context, bazelTreeDataProvider);
    registerSinglePropTreeItemCommands(context, bazelTreeDataProvider);
    registerBazelCommands(context, bazelController);
    registerBazelTargetOperationsCommands(context, bazelTargetOpsController, bazelTargetManager);
    registerDebugCommands(context, bazelTargetControllerManager.getController('debug') as DebugController);
    registerUserCommands(context, configurationManager, userCommandsController);
}

