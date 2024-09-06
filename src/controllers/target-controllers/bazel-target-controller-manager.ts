import { AnyActionController } from './any-action-controller';
import { BazelTargetController } from './bazel-target-controller';
import { BuildController } from './build-controller';
import { DebugController } from './debug-controller';
import { RunController } from './run-controller';
import { TestController } from './test-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
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
        bazelEnvironment: BazelEnvironment
    ) {
        const buildController = new BuildController(context, configurationManager, taskService, bazelEnvironment);
        this.controllers.set('build', buildController);
        this.controllers.set('run', new RunController(context, configurationManager, taskService, bazelService, bazelController, buildController, bazelEnvironment));
        this.controllers.set('test', new TestController(context, configurationManager, taskService, shellService));
        this.controllers.set('debug', new DebugController(context, configurationManager, bazelService, bazelEnvironment, buildController));
        this.controllers.set('*', new AnyActionController(context, configurationManager, taskService));
    }

    public getController(action: string): BazelTargetController | undefined {
        if (this.controllers.has(action))
            return this.controllers.get(action);
        return this.controllers.get('*');
    }
}