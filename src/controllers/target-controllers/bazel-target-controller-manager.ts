import { AnyActionController } from './any-action-controller';
import { BazelTargetController } from './bazel-target-controller';
import { BuildController } from './build-controller';
import { DebugController } from './debug-controller';
import { RunController } from './run-controller';
import { TestController } from './test-controller';
import { BazelEnvironment } from '../../models/bazel-environment';
import { BazelTargetManager } from '../../models/bazel-target-manager';
import { BazelService } from '../../services/bazel-service';
import { ConfigurationManager } from '../../services/configuration-manager';
import { LaunchConfigService } from '../../services/launch-config-service';
import { ShellService } from '../../services/shell-service';
import { TaskService } from '../../services/task-service';
import { BazelTargetTreeProvider } from '../../ui/bazel-target-tree-provider';
import { BazelController } from '../bazel-controller';
import * as vscode from 'vscode';


export class BazelTargetControllerManager {
    private controllers: Map<string, BazelTargetController> = new Map();

    constructor(context: vscode.ExtensionContext,
        configurationManager: ConfigurationManager,
        taskService: TaskService,
        shellService: ShellService,
        bazelService: BazelService,
        launchConfigService: LaunchConfigService,
        bazelController: BazelController,
        bazelEnvironment: BazelEnvironment,
        bazelTargetManager: BazelTargetManager,
        bazelTreeProvider: BazelTargetTreeProvider
    ) {
        const buildController = new BuildController(context, configurationManager, taskService, bazelService, bazelTargetManager, bazelTreeProvider);
        const runController = new RunController(context, configurationManager, taskService,
            bazelService, launchConfigService, bazelController, buildController,
            bazelEnvironment, bazelTargetManager, bazelTreeProvider);
        this.controllers.set('build', buildController);
        this.controllers.set('run', runController);
        this.controllers.set('test', new TestController(context, configurationManager, taskService, shellService, bazelService,
            runController, bazelTargetManager, bazelTreeProvider));
        this.controllers.set('debug', new DebugController(context, configurationManager, bazelService, buildController, bazelEnvironment));
        this.controllers.set('*', new AnyActionController(context, configurationManager, taskService, bazelService, bazelTargetManager, bazelTreeProvider));
    }

    public getController(action: string): BazelTargetController | undefined {
        if (this.controllers.has(action))
            return this.controllers.get(action);
        return this.controllers.get('*');
    }
}