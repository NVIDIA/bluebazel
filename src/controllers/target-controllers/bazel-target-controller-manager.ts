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

import { AnyActionController } from './any-action-controller';
import { BazelTargetController } from './bazel-target-controller';
import { BuildController } from './build-controller';
import { DebugController } from './debug-controller';
import { RunController } from './run-controller';
import { TestController } from './test-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelTargetStateManager } from '../../models/bazel-target-state-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { ShellService } from '../../services/shell-service';
import { TaskService } from '../../services/task-service';
import { BazelController } from '../bazel-controller';
import * as vscode from 'vscode';


export class BazelTargetControllerManager {
    private controllers: Map<string, BazelTargetController> = new Map();

    constructor(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager,
        taskService: TaskService,
        shellService: ShellService,
        bazelService: BazelService,
        bazelController: BazelController,
        bazelEnvironment: BazelEnvironment,
        bazelTargetManager: BazelTargetManager,
        bazelTargetStateManager: BazelTargetStateManager
    ) {
        const buildController = new BuildController(context,
            configurationManager,
            taskService,
            bazelTargetManager,
            bazelTargetStateManager);

        const runController = new RunController(context,
            configurationManager,
            taskService,
            bazelService,
            buildController,
            bazelTargetStateManager);

        this.controllers.set('build', buildController);
        this.controllers.set('run', runController);

        this.controllers.set('test', new TestController(context,
            configurationManager,
            taskService,
            bazelTargetStateManager));

        this.controllers.set('debug', new DebugController(context,
            configurationManager,
            taskService,
            bazelService,
            buildController,
            bazelEnvironment,
            bazelTargetStateManager));

        this.controllers.set('*', new AnyActionController(context,
            configurationManager,
            taskService,
            bazelTargetStateManager));
    }

    public getController(action: string): BazelTargetController | undefined {
        if (this.controllers.has(action))
            return this.controllers.get(action);
        return this.controllers.get('*');
    }
}