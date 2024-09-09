/////////////////////////////////////////////////////////////////////////////////////////
// MIT License
//
// Copyright (c) 2024 NVIDIA Corporation
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

import { BazelController } from './bazel-controller';
import { registerAnyActionCommands } from './commands/any-action-commands';
import { registerBazelCommands } from './commands/bazel-commands';
import { registerBuildCommands } from './commands/build-commands';
import { registerDebugCommands } from './commands/debug-commands';
import { registerMultiPropTreeItemCommands } from './commands/multi-prop-tree-item-commands';
import { registerRunCommands } from './commands/run-commands';
import { registerSinglePropTreeItemCommands } from './commands/single-prop-tree-item-commands';
import { registerTestCommands } from './commands/test-commands';
import { registerTreeDataProviderCommands } from './commands/tree-data-provider-commands';
import { AnyActionController } from './target-controllers/any-action-controller';
import { BazelTargetControllerManager } from './target-controllers/bazel-target-controller-manager';
import { BuildController } from './target-controllers/build-controller';
import { DebugController } from './target-controllers/debug-controller';
import { RunController } from './target-controllers/run-controller';
import { TestController } from './target-controllers/test-controller';
import { BazelEnvironment } from '../models/bazel-environment';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { LaunchConfigService } from '../services/launch-config-service';
import { BazelTargetTreeProvider } from '../ui/bazel-target-tree-provider';
import * as vscode from 'vscode';

export function registerCommands(context: vscode.ExtensionContext,
    bazelController: BazelController,
    bazelTargetControllerManager: BazelTargetControllerManager,
    launchConfigService: LaunchConfigService,
    bazelEnvironment: BazelEnvironment,
    bazelTargetManager: BazelTargetManager,
    bazelTreeDataProvider: BazelTargetTreeProvider
) {
    registerTreeDataProviderCommands(context);
    registerMultiPropTreeItemCommands(context);
    registerSinglePropTreeItemCommands(context);
    registerBazelCommands(context, bazelController);
    const buildController = bazelTargetControllerManager.getController('build') as BuildController;
    const runController = bazelTargetControllerManager.getController('run') as RunController;
    const testController = bazelTargetControllerManager.getController('test') as TestController;
    const debugController = bazelTargetControllerManager.getController('debug') as DebugController;
    const anyActionController = bazelTargetControllerManager.getController('*') as AnyActionController;
    registerBuildCommands(context, buildController, bazelEnvironment, bazelTargetManager, bazelTreeDataProvider);
    registerRunCommands(context, runController, launchConfigService, bazelEnvironment, bazelTreeDataProvider);
    registerDebugCommands(context, debugController);
    registerTestCommands(context, testController, runController, bazelEnvironment, bazelTreeDataProvider);
    registerAnyActionCommands(context, anyActionController);
}

