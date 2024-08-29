import * as vscode from 'vscode';
import { BazelTarget } from './bazel-target';

export class BazelEnvironmentModel {
    private runTargets: BazelTarget[] = [];
    private envVars: { [key: string]: string } = {};
    private selectedRunTarget: BazelTarget;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.loadRunTargets();
        this.loadEnvVars();
        const runTarget = this.context.workspaceState.get<BazelTarget>('selectedRunTarget', new BazelTarget('', '', '', this.context.workspaceState));
        this.selectedRunTarget = runTarget;
    }

    // Load run targets from storage
    private loadRunTargets() {
        const storedTargets = this.context.workspaceState.get<BazelTarget[]>('bazelRunTargets', []);
        this.runTargets = storedTargets;
    }

    // Load environment variables from storage or configuration
    private loadEnvVars() {
        const storedEnvVars = this.context.workspaceState.get<{ [key: string]: string }>('bazelEnvVars', {});
        this.envVars = storedEnvVars;
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
    public getEnvVars(): { [key: string]: string } {
        return this.envVars;
    }

    public updateEnvVars(key: string, value: string) {
        this.envVars[key] = value;
        this.context.workspaceState.update('bazelEnvVars', this.envVars);
    }

    public getSelectedRunTarget(): BazelTarget {
        return this.selectedRunTarget;
    }

    public updateSelectedRunTarget(target: BazelTarget) {
        this.selectedRunTarget = target;
        this.context.workspaceState.update('selectedRunTarget', this.selectedRunTarget);
    }

}