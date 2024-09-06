import { BazelTarget } from './bazel-target';
import { ConfigurationManager } from '../services/configuration-manager';
import { EnvironmentService } from '../services/environment-service';
import * as vscode from 'vscode';


export class BazelEnvironment {
    private runTargets: BazelTarget[] = [];
    private envVars: string[] = [];
    private selectedRunTarget: BazelTarget;
    private selectedBuildTarget: BazelTarget;
    private selectedTestTarget: BazelTarget;

    constructor(private readonly context: vscode.ExtensionContext,
        private readonly configurationManager: ConfigurationManager
    ) {
        this.loadRunTargets();
        this.loadEnvVars();
        const runTarget = this.context.workspaceState.get<BazelTarget>('selectedRunTarget', new BazelTarget(context, '', '', ''));
        this.selectedRunTarget = runTarget;
        const buildTarget = this.context.workspaceState.get<BazelTarget>('selectedBuildTarget', new BazelTarget(context, '', '', ''));
        this.selectedBuildTarget = buildTarget;
        const testTarget = this.context.workspaceState.get<BazelTarget>('selectedTestTarget', new BazelTarget(context, '', '', ''));
        this.selectedTestTarget = testTarget;
    }

    // Load run targets from storage
    private loadRunTargets() {
        const storedTargets = this.context.workspaceState.get<BazelTarget[]>('bazelRunTargets', []);
        this.runTargets = storedTargets;
    }

    // Load environment variables from storage or configuration
    private async loadEnvVars() {
        const result = await EnvironmentService.fetchSetupEnvironment(this.context, this.configurationManager.getSetupEnvironmentCommand());
        this.context.workspaceState.update('setupEnvVars', result);
        this.envVars = result;
    }

    // Methods to manage run targets
    public getRunTargets(): BazelTarget[] {
        return this.runTargets;
    }

    public updateRunTargets(targets: BazelTarget[]) {
        this.runTargets = targets;
        this.context.workspaceState.update('bazelRunTargets', this.runTargets);
    }

    // Methods to manage environment variables
    public getEnvVars(): string[] {
        return this.envVars;
    }

    public getSelectedRunTarget(): BazelTarget {
        return this.selectedRunTarget;
    }

    public updateSelectedRunTarget(target: BazelTarget) {
        this.selectedRunTarget = target;
        this.context.workspaceState.update('selectedRunTarget', this.selectedRunTarget);
    }

    public getSelectedBuildTarget(): BazelTarget {
        return this.selectedBuildTarget;
    }

    public updateSelectedBuildTarget(target: BazelTarget) {
        this.selectedBuildTarget = target;
        this.context.workspaceState.update('selectedBuildTarget', this.selectedBuildTarget);
    }


    public getSelectedTestTarget(): BazelTarget {
        return this.selectedTestTarget;
    }

    public updateSelectedTestTarget(target: BazelTarget) {
        this.selectedTestTarget = target;
        this.context.workspaceState.update('selectedTestTarget', this.selectedTestTarget);
    }


}