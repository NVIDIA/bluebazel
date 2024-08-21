import { BazelAction, BazelTarget } from '../models/bazel-target';
import { BazelTargetManager } from '../models/bazel-target-manager';
import { BazelService } from '../services/bazel-service';
import { BazelTargetTreeProvider } from '../ui/bazel-target-tree-provider';
import { BazelTargetControllerManager } from './target-controllers/bazel-target-controller-manager';
import * as vscode from 'vscode';

export class BazelTargetOperationsController {
    constructor(
        private context: vscode.ExtensionContext,
        private bazelService: BazelService,
        private bazelTargetControllerManager: BazelTargetControllerManager,
        private bazelTargetManager: BazelTargetManager,
        private bazelTreeProvider: BazelTargetTreeProvider
    ) {}

    public pickTargetFromAction(action: BazelAction) {
        const target = new BazelTarget(this.context, this.bazelService, '', '', action);
        this.pickTarget(target);
    }

    public async pickTarget(oldTarget: BazelTarget) {
        const controller = this.getController(oldTarget.action);
        const pickedTarget = await controller.pickTarget(oldTarget);

        if (pickedTarget) {
            if (oldTarget.detail !== '') {
                this.bazelTargetManager.updateTarget(pickedTarget.clone(), oldTarget);
            } else {
                const clonedTarget = pickedTarget.clone();
                this.bazelTargetManager.addTarget(clonedTarget);
            }
            this.bazelTreeProvider.refresh();
        }
    }

    public async copyTarget(target: BazelTarget) {
        const clonedTarget = target.clone(true);
        this.bazelTargetManager.addTarget(clonedTarget);
        this.bazelTreeProvider.refresh();
    }

    public removeTarget(target: BazelTarget) {
        this.bazelTargetManager.removeTarget(target);
        this.bazelTreeProvider.refresh();
    }

    public async copyCommandToClipboard(target: BazelTarget) {
        const controller = this.getController(target.action);
        const command = await controller.getExecuteCommand(target);
        vscode.env.clipboard.writeText(command || '');
        vscode.window.showInformationMessage('Copied to clipboard');
    }

    public async executeTarget(target: BazelTarget) {
        const controller = this.getController(target.action);
        controller.execute(target);
    }

    private getController(action: BazelAction) {
        const controller = this.bazelTargetControllerManager.getController(action);
        if (!controller) {
            vscode.window.showErrorMessage(`Action ${action} is unsupported`);
            throw new Error(`No controller for action ${action}`);
        }
        return controller;
    }
}
